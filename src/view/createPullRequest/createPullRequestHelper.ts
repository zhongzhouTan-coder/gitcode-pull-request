import * as vscode from 'vscode';
import { Logger } from '../../common/logger';
import { GitCodeRepository, CreatePullRequestInitialIssueContext, CreatePullRequestPermissions } from '../../common/models';
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
import { createBranchDeniedMessage } from '../permissions/permissionMessages';
import { CreatePullRequestViewProvider } from './createPullRequestViewProvider';

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
	) {}

	async create(): Promise<void> {
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
		const issueContext = this.buildIssueContext(repository);

		const sourceRepository = repositories.find((r) => r.remoteName === 'origin') ?? repository;

		// Build permission view model for the provider
		let permissions: CreatePullRequestPermissions = { canCreatePullRequest: true, canCreateBranch: false };
		try {
			const canCreateBranch = await checkPermission(this.permissionStore, sourceRepository, {
				scope: 'branch',
				action: 'create',
				message: createBranchDeniedMessage,
			});
			permissions = { canCreatePullRequest: true, canCreateBranch };
		} catch {
			// If we can't check branch permission, default to disabled
		}

		// Initialize the sidebar provider with the resolved data
		await this.provider.initialize(repositories, repository, sourceBranch, gitRepo, issueContext, permissions);
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

	handleCreateSuccess(repository: GitCodeRepository, prNumber: number): void {
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
