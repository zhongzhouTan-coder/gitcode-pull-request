import * as vscode from 'vscode';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { AuthService } from '../../authentication/authService';
import { RepositoryContextService } from '../../common/git/repositoryContext';
import { LocalGitService, issueBranchSlug } from '../../common/git/localGitService';
import { IssueTreeStore } from '../state/issueTreeStore';
import { IssueOverviewStore } from '../issueOverview/issueOverviewStore';
import { IssueCommentsStore } from '../issueOverview/issueCommentsStore';
import { IssueOperationLogsStore } from '../issueOverview/issueOperationLogsStore';
import { IssueRelatedPullRequestsStore } from '../issueOverview/issueRelatedPullRequestsStore';
import { IssueOverviewPanel } from '../issueOverview/issueOverviewPanel';
import { PullRequestOverviewStore } from '../overview/pullRequestOverviewStore';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { CopilotIssueContextStore } from '../copilot/copilotIssueContextStore';
import { IssueNode, IssueNodeContext, getIssueUrl } from '../tree/nodes/issueNode';
import { GitRemote, GitRepository } from '../../common/git/gitTypes';
import { parseGitCodeRemote } from '../../common/git/remoteParser';
import { CreateIssueHelper } from '../createIssue/createIssueHelper';
import { PermissionStore } from '../state/permissionStore';
import { requirePermission } from '../permissions/permissionChecks';
import { createBranchDeniedMessage } from '../permissions/permissionMessages';

interface RegisterIssueCommandsOptions {
	authService: AuthService;
	store: IssueTreeStore;
	issueOverviewStore: IssueOverviewStore;
	issueCommentsStore: IssueCommentsStore;
	issueOperationLogsStore: IssueOperationLogsStore;
	issueRelatedPrsStore: IssueRelatedPullRequestsStore;
	prOverviewStore: PullRequestOverviewStore;
	prCommentsStore: PullRequestCommentsStore;
	copilotIssueContextStore: CopilotIssueContextStore;
	repositoryContext: RepositoryContextService;
	createIssueHelper: CreateIssueHelper;
	permissionStore: PermissionStore;
	logger: Logger;
}

type IssueBranchBase = {
	label: string;
	description: string;
	startPoint?: string;
	remoteName?: string;
	branchName?: string;
};

type IssueCommandContext = {
	repository: IssueNodeContext['repository'];
	issueNumber: number;
	title: string;
	url?: string;
};

function resolveIssueContext(value: unknown): IssueNodeContext | undefined {
	if (!value) {
		return undefined;
	}

	// Direct context object (from item.command)
	if (isIssueNodeContext(value)) {
		return value;
	}

	// Tree node (from view/item/context)
	if (value instanceof IssueNode) {
		return value.context;
	}

	return undefined;
}

function isIssueNodeContext(value: unknown): value is IssueNodeContext {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return typeof candidate.repository === 'object'
		&& typeof candidate.issue === 'object';
}

function resolveIssueCommandContext(value: unknown): IssueCommandContext | undefined {
	const issueContext = resolveIssueContext(value);
	if (issueContext) {
		return {
			repository: issueContext.repository,
			issueNumber: issueContext.issue.number,
			title: issueContext.issue.title,
			url: issueContext.issue.url,
		};
	}

	if (!value || typeof value !== 'object') {
		return undefined;
	}

	const candidate = value as Record<string, unknown>;
	if (
		typeof candidate.repository === 'object'
		&& typeof candidate.issueNumber === 'number'
		&& typeof candidate.title === 'string'
	) {
		return {
			repository: candidate.repository as IssueCommandContext['repository'],
			issueNumber: candidate.issueNumber,
			title: candidate.title,
			url: typeof candidate.url === 'string' ? candidate.url : undefined,
		};
	}

	return undefined;
}

function splitRemoteBranch(remoteBranch: string, remotes: GitRemote[]): { remoteName: string; branchName: string } | undefined {
	const matchingRemote = [...remotes]
		.sort((a, b) => b.name.length - a.name.length)
		.find((remote) => remoteBranch === remote.name || remoteBranch.startsWith(`${remote.name}/`));

	if (!matchingRemote || remoteBranch === matchingRemote.name) {
		return undefined;
	}

	return {
		remoteName: matchingRemote.name,
		branchName: remoteBranch.slice(matchingRemote.name.length + 1),
	};
}

function repositoryMatchesIssue(gitRepo: GitRepository, issueRepository: IssueCommandContext['repository']): boolean {
	return gitRepo.state.remotes.some((remote) => {
		const remoteUrl = remote.fetchUrl ?? remote.pushUrl;
		if (!remoteUrl) {
			return false;
		}

		return parseGitCodeRemote(remoteUrl)?.fullName === issueRepository.fullName;
	});
}

async function getIssueGitRepository(
	repositoryContext: RepositoryContextService,
	issueRepository: IssueCommandContext['repository'],
	logger: Logger,
): Promise<GitRepository | undefined> {
	const gitApi = await repositoryContext.getGitApi();
	if (!gitApi) {
		return undefined;
	}

	const matchingRepositories = gitApi.repositories.filter((repository) => repositoryMatchesIssue(repository, issueRepository));
	if (!matchingRepositories.length) {
		logger.error(`No open local git repository matches GitCode repository ${issueRepository.fullName}.`);
		return undefined;
	}

	try {
		const activeRepository = await repositoryContext.getActiveRepository();
		if (activeRepository && matchingRepositories.includes(activeRepository)) {
			return activeRepository;
		}
	} catch (error) {
		logger.error(`Failed to get active repository: ${error instanceof Error ? error.message : String(error)}`);
	}

	return matchingRepositories[0];
}

async function pickIssueBranchBase(
	gitService: LocalGitService,
	gitRepo: GitRepository,
	logger: Logger,
): Promise<IssueBranchBase | undefined> {
	const currentBranch = await gitService.getCurrentBranch(gitRepo);
	const remotes = gitRepo.state.remotes;
	const remoteBranches = new Set<string>();

	try {
		for (const branch of await gitService.listRemoteBranches(gitRepo)) {
			remoteBranches.add(branch);
		}
	} catch (error) {
		logger.error(`Failed to list remote branches: ${error instanceof Error ? error.message : String(error)}`);
	}

	const remoteItems = [...remoteBranches]
		.map((branch): IssueBranchBase | undefined => {
			const parsed = splitRemoteBranch(branch, remotes);
			if (!parsed) {
				return undefined;
			}
			return {
				label: branch,
				description: 'Fetch before creating branch',
				startPoint: branch,
				remoteName: parsed.remoteName,
				branchName: parsed.branchName,
			};
		})
		.filter((item): item is IssueBranchBase => item !== undefined)
		.sort((a, b) => {
			const priority = (label: string): number => {
				switch (label) {
					case 'upstream/master': return 0;
					case 'origin/master': return 1;
					case 'upstream/main': return 2;
					case 'origin/main': return 3;
					default: return 4;
				}
			};
			return priority(a.label) - priority(b.label) || a.label.localeCompare(b.label);
		});

	const currentItem: IssueBranchBase = {
		label: currentBranch ? `Current branch (${currentBranch})` : 'Current branch',
		description: 'Do not fetch; create from current HEAD',
	};

	return vscode.window.showQuickPick(
		[...remoteItems, currentItem],
		{
			placeHolder: 'Select the base branch for the issue branch',
			ignoreFocusOut: true,
		},
	);
}

export function registerIssueCommands(options: RegisterIssueCommandsOptions): vscode.Disposable {
	const { authService, store, issueOverviewStore, issueCommentsStore, issueOperationLogsStore, issueRelatedPrsStore, prOverviewStore, prCommentsStore, copilotIssueContextStore, repositoryContext, createIssueHelper, permissionStore, logger } = options;

	const gitService = new LocalGitService();

	return vscode.Disposable.from(
		vscode.commands.registerCommand(COMMAND_ID.createIssue, async () => {
			await createIssueHelper.create();
		}),
		vscode.commands.registerCommand(COMMAND_ID.refreshIssues, async () => {
			await store.refreshAll();
		}),
		vscode.commands.registerCommand(COMMAND_ID.openIssue, async (context?: IssueNodeContext) => {
			const resolved = resolveIssueContext(context);
			if (!resolved) {
				return;
			}

			// Open the issue overview panel instead of browser
			await IssueOverviewPanel.createOrShow(
				{
					repository: resolved.repository,
					issueNumber: resolved.issue.number,
					url: resolved.issue.url,
				},
				issueOverviewStore,
				issueCommentsStore,
				issueOperationLogsStore,
				issueRelatedPrsStore,
				prOverviewStore,
				prCommentsStore,
				logger,
			);
		}),
		vscode.commands.registerCommand(COMMAND_ID.openIssueOnWeb, async (context?: IssueNodeContext) => {
			const resolved = resolveIssueContext(context);
			if (resolved) {
				const url = getIssueUrl(resolved);
				await vscode.env.openExternal(vscode.Uri.parse(url));
				return;
			}

			await IssueOverviewPanel.openCurrentOnWeb();
		}),
		vscode.commands.registerCommand(COMMAND_ID.refreshIssue, async () => {
			await IssueOverviewPanel.refreshCurrent();
		}),
		vscode.commands.registerCommand(COMMAND_ID.copyIssueUrl, async (context?: IssueNodeContext) => {
			const resolved = resolveIssueContext(context);
			if (!resolved) {
				return;
			}

			const url = getIssueUrl(resolved);
			await vscode.env.clipboard.writeText(url);
			vscode.window.showInformationMessage('Issue URL copied to clipboard');
		}),
		vscode.commands.registerCommand(
			COMMAND_ID.useIssueAsCopilotContext,
			async (context?: IssueNodeContext | IssueNode) => {
				const resolved = resolveIssueContext(context);
				if (!resolved) {
					logger.error('Cannot select issue for Copilot context: invalid command context.');
					return;
				}

				copilotIssueContextStore.select({
					repository: resolved.repository,
					issueNumber: resolved.issue.number,
					title: resolved.issue.title,
					url: resolved.issue.url,
				});

				vscode.window.showInformationMessage(
					`GitCode issue #${resolved.issue.number} selected for Copilot context.`,
				);
			},
		),
		vscode.commands.registerCommand(
			COMMAND_ID.createBranchForIssue,
			async (context?: IssueNodeContext | IssueNode) => {
				const resolved = resolveIssueCommandContext(context)
					?? resolveIssueCommandContext(copilotIssueContextStore.getSelected());
				if (!resolved) {
					vscode.window.showErrorMessage(
						'Open a GitCode issue or select one from the Issues tree before creating an issue branch.',
					);
					return;
				}

				// Check permission before creating branch
				const allowed = await requirePermission(permissionStore, resolved.repository, {
					scope: 'branch',
					action: 'create',
					message: createBranchDeniedMessage,
				});
				if (!allowed) {
					return;
				}

				let gitRepo: GitRepository | undefined;
				try {
					gitRepo = await getIssueGitRepository(repositoryContext, resolved.repository, logger);
				} catch (error) {
					logger.error(`Failed to get matching repository: ${error instanceof Error ? error.message : String(error)}`);
				}

				if (!gitRepo) {
					vscode.window.showErrorMessage(`Open the local repository for ${resolved.repository.fullName} before creating an issue branch.`);
					return;
				}

				// Suggest branch name
				const suggestedName = issueBranchSlug(resolved.issueNumber, resolved.title);

				const branchName = await vscode.window.showInputBox({
					prompt: 'Enter the branch name for this issue',
					value: suggestedName,
					validateInput: async (value) => {
						if (!value.trim()) {
							return 'Branch name cannot be empty.';
						}
						try {
							const exists = await gitService.branchExists(gitRepo!, value.trim());
							if (exists) {
								return `Branch "${value.trim()}" already exists.`;
							}
						} catch {
							// If we can't check, let git handle the error
						}
						return undefined;
					},
				});

				if (!branchName) {
					return;
				}

				const branchBase = await pickIssueBranchBase(gitService, gitRepo, logger);
				if (!branchBase) {
					return;
				}

				// Check for uncommitted changes
				let isDirty = false;
				try {
					isDirty = await gitService.hasUncommittedChanges(gitRepo);
				} catch {
					// Proceed anyway
				}

				if (isDirty) {
					const proceed = await vscode.window.showWarningMessage(
						'You have uncommitted changes. Creating a new branch may carry these changes over. Continue?',
						{ modal: true },
						'Continue',
					);
					if (proceed !== 'Continue') {
						return;
					}
				}

				if (branchBase.remoteName && branchBase.branchName) {
					try {
						await vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								title: `Fetching ${branchBase.label}`,
								cancellable: false,
							},
							() => gitService.fetchBranch(gitRepo, branchBase.remoteName!, branchBase.branchName!),
						);
					} catch (error) {
						vscode.window.showErrorMessage(
							`Failed to fetch ${branchBase.label}: ${error instanceof Error ? error.message : String(error)}`,
						);
						return;
					}
				}

				// Create and checkout the branch
				try {
					await gitService.createAndCheckoutBranch(gitRepo, branchName.trim(), branchBase.startPoint);
					const baseMessage = branchBase.startPoint ? ` from ${branchBase.startPoint}` : '';
					vscode.window.showInformationMessage(`Created and checked out branch "${branchName.trim()}"${baseMessage}.`);
				} catch (error) {
					vscode.window.showErrorMessage(
						`Failed to create branch: ${error instanceof Error ? error.message : String(error)}`,
					);
					return;
				}

				// Keep Copilot issue context aligned after creating an issue branch.
				if (resolved) {
					copilotIssueContextStore.select({
						repository: resolved.repository,
						issueNumber: resolved.issueNumber,
						title: resolved.title,
						url: resolved.url,
					});
				}
			},
		),
	);
}
