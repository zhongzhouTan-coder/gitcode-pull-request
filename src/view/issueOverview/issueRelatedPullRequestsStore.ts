import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { GitCodeRepository, IssueRelatedPullRequestsSnapshot } from '../../common/models';
import { IssueService } from '../../gitcode/services/issueService';

export class IssueRelatedPullRequestsStore {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
	private readonly pullRequestPromises = new Map<string, Promise<IssueRelatedPullRequestsSnapshot>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly issueService: IssueService,
	) {}

	async getPullRequests(
		repository: GitCodeRepository,
		issueNumber: number,
	): Promise<IssueRelatedPullRequestsSnapshot> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.getKey(repository, issueNumber);
		const existingPromise = this.pullRequestPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.issueService
			.listIssueRelatedPullRequests(repository, issueNumber)
			.then((pullRequests) => {
				const snapshot: IssueRelatedPullRequestsSnapshot = {
					repositoryKey: repository.fullName,
					issueNumber,
					pullRequests,
					loadedAt: Date.now(),
				};
				return snapshot;
			})
			.catch((error) => {
				this.pullRequestPromises.delete(key);
				throw error;
			});

		this.pullRequestPromises.set(key, requestPromise);
		return requestPromise;
	}

	async refresh(repository: GitCodeRepository, issueNumber: number): Promise<void> {
		this.pullRequestPromises.delete(this.getKey(repository, issueNumber));
		this.onDidChangeEmitter.fire();
	}

	clear(): void {
		this.pullRequestPromises.clear();
	}

	private getKey(repository: GitCodeRepository, issueNumber: number): string {
		return `${repository.fullName}#${issueNumber}:relatedPullRequests`;
	}
}
