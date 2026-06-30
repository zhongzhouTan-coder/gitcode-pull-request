import * as vscode from 'vscode';
import { GitCodeRepository } from '../../common/models';
import { Logger } from '../../common/logger';
import { GitCodeRepositoryResolver } from '../../gitcode/resolver/gitcodeRepositoryResolver';
import { IssueService } from '../../gitcode/services/issueService';
import { RawContentService } from '../../gitcode/services/rawContentService';
import { RepositoryService } from '../../gitcode/services/repositoryService';
import { IssueOverviewPanel } from '../issueOverview/issueOverviewPanel';
import { IssueCommentsStore } from '../issueOverview/issueCommentsStore';
import { IssueOverviewStore } from '../issueOverview/issueOverviewStore';
import { IssueRelatedPullRequestsStore } from '../issueOverview/issueRelatedPullRequestsStore';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { IssueTreeStore } from '../state/issueTreeStore';
import { PullRequestOverviewStore } from '../overview/pullRequestOverviewStore';
import { CreateIssuePanel } from './createIssuePanel';

export class CreateIssueHelper {
	constructor(
		private readonly repositoryResolver: GitCodeRepositoryResolver,
		private readonly repositoryService: RepositoryService,
		private readonly rawContentService: RawContentService,
		private readonly issueService: IssueService,
		private readonly issueStore: IssueTreeStore,
		private readonly issueOverviewStore: IssueOverviewStore,
		private readonly issueCommentsStore: IssueCommentsStore,
		private readonly issueRelatedPrsStore: IssueRelatedPullRequestsStore,
		private readonly prOverviewStore: PullRequestOverviewStore,
		private readonly prCommentsStore: PullRequestCommentsStore,
		private readonly logger: Logger,
	) {}

	async create(): Promise<void> {
		let repositories: GitCodeRepository[];
		try {
			repositories = await this.repositoryResolver.resolveAll();
		} catch (error) {
			vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to resolve GitCode repository.');
			return;
		}

		if (!repositories.length) {
			vscode.window.showWarningMessage('This workspace is not connected to a GitCode repository. Configure gitcode.repository or add a GitCode remote.');
			return;
		}

		let repository: GitCodeRepository;
		if (repositories.length === 1) {
			repository = repositories[0];
		} else {
			const pick = await vscode.window.showQuickPick(
				repositories.map((candidate) => ({
					label: candidate.fullName,
					description: `(${candidate.remoteName})`,
					repository: candidate,
				})),
				{
					placeHolder: 'Select a repository to create the issue in',
					canPickMany: false,
				},
			);

			if (!pick) {
				return;
			}

			repository = pick.repository;
		}

		await CreateIssuePanel.createOrShow(repository, {
			repositoryService: this.repositoryService,
			rawContentService: this.rawContentService,
			issueService: this.issueService,
			logger: this.logger,
			callbacks: {
				onCreateSuccess: (repo, issueNumber, url) => this.handleCreateSuccess(repo, issueNumber, url),
			},
		});
	}

	handleCreateSuccess(repository: GitCodeRepository, issueNumber?: number, url?: string): void {
		this.issueStore.refreshRepository(repository.fullName).catch(() => {
			this.issueStore.refreshAll();
		});

		if (issueNumber && Number.isFinite(issueNumber) && issueNumber > 0) {
			void IssueOverviewPanel.createOrShow(
				{
					repository,
					issueNumber,
					url,
				},
				this.issueOverviewStore,
				this.issueCommentsStore,
				this.issueRelatedPrsStore,
				this.prOverviewStore,
				this.prCommentsStore,
				this.logger,
			);
			return;
		}

		if (url) {
			void vscode.env.openExternal(vscode.Uri.parse(url));
		}
	}
}