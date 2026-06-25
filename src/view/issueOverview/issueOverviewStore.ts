import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { GitCodeRepository, IssueDetail } from '../../common/models';
import { IssueService } from '../../gitcode/services/issueService';

export class IssueOverviewStore {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
	private readonly detailPromises = new Map<string, Promise<IssueDetail>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly issueService: IssueService,
	) {}

	async getDetail(repository: GitCodeRepository, issueNumber: number): Promise<IssueDetail> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.getKey(repository, issueNumber);
		const existingPromise = this.detailPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.issueService
			.getIssue(repository, issueNumber)
			.catch((error) => {
				this.detailPromises.delete(key);
				throw error;
			});

		this.detailPromises.set(key, requestPromise);
		return requestPromise;
	}

	async refresh(repository: GitCodeRepository, issueNumber: number): Promise<void> {
		this.detailPromises.delete(this.getKey(repository, issueNumber));
		this.onDidChangeEmitter.fire();
	}

	private getKey(repository: GitCodeRepository, issueNumber: number): string {
		return `${repository.fullName}#${issueNumber}`;
	}
}
