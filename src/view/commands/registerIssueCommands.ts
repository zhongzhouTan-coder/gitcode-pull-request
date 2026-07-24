import * as vscode from 'vscode';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { AuthService } from '../../authentication/authService';
import { RepositoryContextService } from '../../common/git/repositoryContext';
import { LocalGitService, issueBranchSlug } from '../../common/git/localGitService';
import { GitRepository } from '../../common/git/gitTypes';
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
import { CreateIssueHelper } from '../createIssue/createIssueHelper';
import { PermissionStore } from '../state/permissionStore';
import { requirePermission } from '../permissions/permissionChecks';
import { createBranchDeniedMessage } from '../permissions/permissionMessages';
import {
	resolveIssueContext,
	resolveIssueCommandContext,
	getIssueGitRepository,
	pickIssueBranchBase,
} from './issueCommandHelpers';

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
