import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { GitCodeRepository, IssueCommentsSnapshot } from '../../common/models';
import { IssueCommentService } from '../../gitcode/services/issueCommentService';

export class IssueCommentsStore {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
	private readonly commentPromises = new Map<string, Promise<IssueCommentsSnapshot>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly commentService: IssueCommentService,
	) {}

	async getComments(
		repository: GitCodeRepository,
		issueNumber: number,
	): Promise<IssueCommentsSnapshot> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.getKey(repository, issueNumber);
		const existingPromise = this.commentPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.commentService
			.listIssueComments(repository, issueNumber)
			.then((comments) => {
				const snapshot: IssueCommentsSnapshot = {
					repositoryKey: repository.fullName,
					issueNumber,
					comments,
					loadedAt: Date.now(),
				};
				return snapshot;
			})
			.catch((error) => {
				this.commentPromises.delete(key);
				throw error;
			});

		this.commentPromises.set(key, requestPromise);
		return requestPromise;
	}

	async refresh(repository: GitCodeRepository, issueNumber: number): Promise<void> {
		this.commentPromises.delete(this.getKey(repository, issueNumber));
		this.onDidChangeEmitter.fire();
	}

	clear(): void {
		this.commentPromises.clear();
	}

	private getKey(repository: GitCodeRepository, issueNumber: number): string {
		return `${repository.fullName}#${issueNumber}`;
	}
}
