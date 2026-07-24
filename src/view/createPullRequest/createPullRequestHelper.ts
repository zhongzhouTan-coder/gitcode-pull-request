import * as vscode from 'vscode';
import { Logger } from '../../common/logger';
import { GitCodeRepository, CreatePullRequestInitialIssueContext, CreatePullRequestInitialContext, CreatePullRequestPermissions } from '../../common/models';
import { RepositoryContextService } from '../../common/git/repositoryContext';
import { GitCodeRepositoryResolver } from '../../gitcode/resolver/gitcodeRepositoryResolver';
import { PullRequestService } from '../../gitcode/services/pullRequestService';
import { PullRequestTreeStore } from '../state/pullRequestTreeStore';
import { PullRequestOverviewPanel } from '../overview/pullRequestOverviewPanel';
import { PullRequestOverviewStore } from '../overview/pullRequestOverviewStore';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { CopilotIssueContextStore } from '../copilot/copilotIssueContextStore';
import { PermissionStore } from '../state/permissionStore';
import { checkPermission } from '../permissions/permissionChecks';
import { createBranchDeniedMessage, createPullRequestDeniedMessage, updatePullRequestDeniedMessage } from '../permissions/permissionMessages';
import { CreatePullRequestViewProvider } from './createPullRequestViewProvider';
import { PullRequestTemplateService } from './prTemplateService';

export class CreatePullRequestHelper implements vscode.Disposable {
	constructor(
		private readonly repositoryContext: RepositoryContextService,
		private readonly repositoryResolver: GitCodeRepositoryResolver,
		private readonly pullRequestService: PullRequestService,
		private readonly provider: CreatePullRequestViewProvider,
		private readonly treeStore: PullRequestTreeStore,
		private readonly overviewStore: PullRequestOverviewStore,
		private readonly commentsStore: PullRequestCommentsStore,
		private readonly copilotIssueContextStore: CopilotIssueContextStore,
		private readonly permissionStore: PermissionStore,
		private readonly logger: Logger,
		private readonly templateService: PullRequestTemplateService = new PullRequestTemplateService(),
	) {}

	async create(initialContext?: CreatePullRequestInitialContext): Promise<void> {
		// If explicit context is provided, use it
		if (initialContext?.repository && initialContext.sourceBranch) {
			await this.createWithContext(initialContext);
			return;
		}

		// Resolve the repository
		let repositories: GitCodeRepository[];
		try {
			repositories = await this.repositoryResolver.resolveAll();
		} catch (error) {
			vscode.window.showErrorMessage(
				error instanceof Error ? error.message : 'Failed to resolve GitCode repository.',
			);
			return;
		}

		if (!repositories.length) {
			vscode.window.showWarningMessage(
				'This workspace is not connected to a GitCode repository. Configure gitcode.repository or add a GitCode remote.',
			);
			return;
		}

		await this.permissionStore.refreshAll(repositories);

		let repository: GitCodeRepository;
		if (repositories.length === 1) {
			repository = repositories[0];
		} else {
			const pick = await vscode.window.showQuickPick(
				repositories.map((r) => ({
					label: r.fullName,
					description: `(${r.remoteName})`,
					repository: r,
				})),
				{
					placeHolder: 'Select a repository to create the pull request in',
					canPickMany: false,
				},
			);

			if (!pick) {
				return;
			}

			repository = pick.repository;
		}

		// Get the active branch
		let sourceBranch: string | undefined;
		let gitRepo;
		try {
			gitRepo = await this.repositoryContext.getActiveRepository();
			sourceBranch = gitRepo?.state?.HEAD?.name;
		} catch {
			// Will show error below
		}

		if (!sourceBranch) {
			vscode.window.showErrorMessage(
				'Cannot create a pull request because there is no active branch.',
			);
			return;
		}

		// Build issue context if a matching issue is selected
		const issueContext = initialContext?.issue ?? this.buildIssueContext(repository);

		const sourceRepository = repositories.find((r) => r.remoteName === 'origin') ?? repository;

		// Build permission view model for the provider
		let permissions: CreatePullRequestPermissions = {
			canCreatePullRequest: true,
			canEditPullRequest: true,
			canCreateBranch: false,
		};
		try {
			const [canCreatePullRequest, canEditPullRequest, canCreateBranch] = await Promise.all([
				checkPermission(this.permissionStore, sourceRepository, {
					scope: 'pr',
					action: 'create',
					message: createPullRequestDeniedMessage,
				}),
				checkPermission(this.permissionStore, repository, {
					scope: 'pr',
					action: 'update',
					message: updatePullRequestDeniedMessage,
				}),
				checkPermission(this.permissionStore, sourceRepository, {
					scope: 'branch',
					action: 'create',
					message: createBranchDeniedMessage,
				}),
			]);
			permissions = { canCreatePullRequest, canEditPullRequest, canCreateBranch };
		} catch {
			// If we can't check branch permission, default to disabled
		}

		// Initialize the sidebar provider with the resolved data
		await this.provider.initialize(repositories, repository, sourceBranch, gitRepo, issueContext, undefined, permissions);
	}

	private buildIssueContext(repository: GitCodeRepository): CreatePullRequestInitialIssueContext | undefined {
		const selected = this.copilotIssueContextStore.getSelected();
		if (!selected || selected.repository.fullName !== repository.fullName) {
			return undefined;
		}

		return {
			issueNumber: selected.issueNumber,
			issueTitle: selected.title,
			issueUrl: selected.url,
		};
	}

	private async createWithContext(initialContext: CreatePullRequestInitialContext): Promise<void> {
		const { repository, sourceBranch, issue } = initialContext;
		// Prefer explicitly provided localGitRepository, otherwise try to resolve
		// from VS Code's active git repository to enable template body building
		const localGitRepository = initialContext.localGitRepository
			?? await this.resolveActiveGitRepository();
		if (!repository || !sourceBranch) {
			vscode.window.showErrorMessage('Cannot create pull request: missing repository or branch context.');
			return;
		}

		// Resolve all repositories for permission checks
		let repositories: GitCodeRepository[];
		try {
			repositories = await this.repositoryResolver.resolveAll();
		} catch {
			repositories = [repository];
		}

		await this.permissionStore.refreshAll(repositories);

		const sourceRepository = repositories.find((r) => r.remoteName === 'origin') ?? repository;

		let permissions: CreatePullRequestPermissions = {
			canCreatePullRequest: true,
			canEditPullRequest: true,
			canCreateBranch: false,
		};
		try {
			const [canCreatePullRequest, canEditPullRequest, canCreateBranch] = await Promise.all([
				checkPermission(this.permissionStore, sourceRepository, {
					scope: 'pr',
					action: 'create',
					message: createPullRequestDeniedMessage,
				}),
				checkPermission(this.permissionStore, repository, {
					scope: 'pr',
					action: 'update',
					message: updatePullRequestDeniedMessage,
				}),
				checkPermission(this.permissionStore, sourceRepository, {
					scope: 'branch',
					action: 'create',
					message: createBranchDeniedMessage,
				}),
			]);
			permissions = { canCreatePullRequest, canEditPullRequest, canCreateBranch };
		} catch {
			// If we can't check, default to enabled
		}

		const issueContext: CreatePullRequestInitialIssueContext | undefined = issue ?? this.buildIssueContext(repository);
		const initialBody = initialContext.body
			?? await this.buildTemplateBody(localGitRepository, issueContext, sourceBranch, undefined, repository);

		await this.provider.initialize(repositories, repository, sourceBranch, localGitRepository, issueContext, initialBody, permissions);
	}

	private async resolveActiveGitRepository(): Promise<import('../../common/git/gitTypes').GitRepository | undefined> {
		try {
			return await this.repositoryContext.getActiveRepository();
		} catch {
			return undefined;
		}
	}

	private async buildTemplateBody(
		localGitRepository: import('../../common/git/gitTypes').GitRepository | undefined,
		issueContext: CreatePullRequestInitialIssueContext | undefined,
		sourceBranch: string,
		targetBranch: string | undefined,
		repository: GitCodeRepository,
	): Promise<string | undefined> {
		if (!localGitRepository) {
			return undefined;
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(localGitRepository.rootUri);
		if (!workspaceFolder) {
			return undefined;
		}

		return this.templateService.buildPrBodyFromTemplate(
			workspaceFolder,
			issueContext,
			sourceBranch,
			targetBranch,
			repository.fullName,
		);
	}

	handleCreateSuccess(repository: GitCodeRepository, prNumber: number): void {
		const selected = this.copilotIssueContextStore.getSelected();
		if (selected && selected.repository.fullName === repository.fullName) {
			// Update the selection context to note the created PR
			this.copilotIssueContextStore.select({
				repository,
				issueNumber: selected.issueNumber,
				title: selected.title,
				url: selected.url,
			});
		}

		// Refresh the tree
		this.treeStore.refreshRepository(repository.fullName).catch(() => {
			// Fallback to full refresh
			this.treeStore.refreshAll();
		});

		// Open the overview panel
		PullRequestOverviewPanel.createOrShow(
			{
				repository,
				pullRequestNumber: prNumber,
			},
			this.overviewStore,
			this.commentsStore,
			this.logger,
		);
	}

	dispose(): void {
		// Nothing to dispose — provider is owned by ViewController
	}
}
