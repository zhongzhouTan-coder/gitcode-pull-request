import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { GitCodeRepository, IssueOperationLogsSnapshot } from '../../common/models';
import { IssueOperationLogService } from '../../gitcode/services/issueOperationLogService';

export interface IssueOperationLogsChangeEvent {
	repositoryKey: string;
	issueNumber: number;
}

type LogsKey = `${string}#${number}`;

export class IssueOperationLogsStore implements vscode.Disposable {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<IssueOperationLogsChangeEvent | undefined>();
	private readonly snapshotPromises = new Map<LogsKey, Promise<IssueOperationLogsSnapshot>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly issueOperationLogService: IssueOperationLogService,
	) {}

	async getOrFetch(
		repository: GitCodeRepository,
		issueNumber: number,
	): Promise<IssueOperationLogsSnapshot> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.makeKey(repository, issueNumber);
		const existingPromise = this.snapshotPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.issueOperationLogService
			.listIssueOperationLogs(repository, issueNumber)
			.then(
				(logs): IssueOperationLogsSnapshot => ({
					repositoryKey: repository.fullName,
					issueNumber,
					logs,
					loadedAt: Date.now(),
				}),
			)
			.catch((error) => {
				this.snapshotPromises.delete(key);
				throw error;
			});

		this.snapshotPromises.set(key, requestPromise);
		return requestPromise;
	}

	async refresh(repository: GitCodeRepository, issueNumber: number): Promise<void> {
		this.snapshotPromises.delete(this.makeKey(repository, issueNumber));
		this.onDidChangeEmitter.fire({ repositoryKey: repository.fullName, issueNumber });
	}

	clear(): void {
		this.snapshotPromises.clear();
		this.onDidChangeEmitter.fire(undefined);
	}

	dispose(): void {
		this.snapshotPromises.clear();
		this.onDidChangeEmitter.dispose();
	}

	private makeKey(repository: GitCodeRepository, issueNumber: number): LogsKey {
		return `${repository.fullName}#${issueNumber}`;
	}
}