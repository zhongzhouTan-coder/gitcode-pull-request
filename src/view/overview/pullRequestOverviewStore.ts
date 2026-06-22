import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { GitCodeRepository, PullRequestDetail } from '../../common/models';
import { PullRequestService } from '../../gitcode/services/pullRequestService';

export class PullRequestOverviewStore {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
	private readonly detailPromises = new Map<string, Promise<PullRequestDetail>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly pullRequestService: PullRequestService,
	) {}

	async getDetail(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestDetail> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.getKey(repository, pullRequestNumber);
		const existingPromise = this.detailPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.pullRequestService
			.getPullRequest(repository, pullRequestNumber)
			.catch((error) => {
				this.detailPromises.delete(key);
				throw error;
			});

		this.detailPromises.set(key, requestPromise);
		return requestPromise;
	}

	async refresh(repository: GitCodeRepository, pullRequestNumber: number): Promise<void> {
		this.detailPromises.delete(this.getKey(repository, pullRequestNumber));
		this.onDidChangeEmitter.fire();
	}

	private getKey(repository: GitCodeRepository, pullRequestNumber: number): string {
		return `${repository.fullName}#${pullRequestNumber}`;
	}
}
