import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { GitCodeRepository, PullRequestOperationLogsSnapshot } from '../../common/models';
import { PullRequestService } from '../../gitcode/services/pullRequestService';

export interface PullRequestOperationLogsChangeEvent {
	repositoryKey: string;
	pullRequestNumber: number;
}

type LogsKey = `${string}#${number}`;

export class PullRequestOperationLogsStore implements vscode.Disposable {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<PullRequestOperationLogsChangeEvent | undefined>();
	private readonly snapshotPromises = new Map<LogsKey, Promise<PullRequestOperationLogsSnapshot>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly pullRequestService: PullRequestService,
	) {}

	async getOrFetch(
		repository: GitCodeRepository,
		pullRequestNumber: number,
	): Promise<PullRequestOperationLogsSnapshot> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.makeKey(repository, pullRequestNumber);
		const existingPromise = this.snapshotPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.pullRequestService
			.listPullRequestOperationLogs(repository, pullRequestNumber)
			.then(
				(logs): PullRequestOperationLogsSnapshot => ({
					repositoryKey: repository.fullName,
					pullRequestNumber,
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

	async refresh(repositoryKey: string, pullRequestNumber: number): Promise<void> {
		const key = this.makeKeyFromParts(repositoryKey, pullRequestNumber);
		this.snapshotPromises.delete(key);
		this.onDidChangeEmitter.fire({ repositoryKey, pullRequestNumber });
	}

	clear(): void {
		this.snapshotPromises.clear();
		this.onDidChangeEmitter.fire(undefined);
	}

	dispose(): void {
		this.snapshotPromises.clear();
		this.onDidChangeEmitter.dispose();
	}

	private makeKey(repository: GitCodeRepository, pullRequestNumber: number): LogsKey {
		return `${repository.fullName}#${pullRequestNumber}`;
	}

	private makeKeyFromParts(repositoryKey: string, pullRequestNumber: number): LogsKey {
		return `${repositoryKey}#${pullRequestNumber}`;
	}
}
