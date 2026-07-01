import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { ExtensionConfiguration } from '../../common/configuration';
import { NotSignedInError, RepositoryNotOnGitCodeError, RepositoryResolutionError } from '../../common/errors';
import { RepositoryContextService } from '../../common/git/repositoryContext';
import { GitCodeRepository, PullRequestFileChange, PullRequestSummary } from '../../common/models';
import { GitCodeRepositoryResolver } from '../../gitcode/resolver/gitcodeRepositoryResolver';
import { PullRequestService } from '../../gitcode/services/pullRequestService';

export type PullRequestCategoryKey = 'allOpen' | 'createdByMe';

export interface PullRequestCategoryState {
	key: PullRequestCategoryKey;
	label: string;
	repository: GitCodeRepository;
}

export type TreeRefreshTarget =
	| { type: 'all' }
	| { type: 'repository'; repositoryKey: string }
	| { type: 'pullRequestFiles'; repositoryKey: string; pullRequestNumber: number };

export class PullRequestTreeStore {
	private static readonly repositoryWaitTimeoutMs = 120000;
	private static readonly repositoryInitialLoadingTimeoutMs = 5000;
	private static readonly repositoryRetryDelayMs = 500;
	private readonly onDidChangeEmitter = new vscode.EventEmitter<TreeRefreshTarget | void>();
	private repositoriesPromise?: Promise<GitCodeRepository[]>;
	private repositoryReadinessPromise?: Promise<void>;
	private repositoryReadinessCompleted = false;
	private repositoryRetryTimer?: ReturnType<typeof setTimeout>;
	private readonly pullRequestListPromises = new Map<string, Promise<PullRequestSummary[]>>();
	private readonly pullRequestFilesPromises = new Map<string, Promise<PullRequestFileChange[]>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly repositoryContext: RepositoryContextService,
		private readonly repositoryResolver: GitCodeRepositoryResolver,
		private readonly pullRequestService: PullRequestService,
		private readonly configuration: ExtensionConfiguration,
	) {}

	async getRepositories(): Promise<GitCodeRepository[]> {
		if (!this.repositoriesPromise) {
			this.repositoriesPromise = this.resolveRepositoriesWithStartupRetry().catch((error) => {
				this.repositoriesPromise = undefined;
				throw error;
			});
		}

		return this.repositoriesPromise;
	}

	isWaitingForRepository(): boolean {
		return Boolean(this.repositoryReadinessPromise) && !this.repositoryReadinessCompleted;
	}

	getCategories(repository: GitCodeRepository): PullRequestCategoryState[] {
		return [
			{
				key: 'allOpen',
				label: 'All Open',
				repository,
			},
			{
				key: 'createdByMe',
				label: 'Created By Me',
				repository,
			},
		];
	}

	async getPullRequests(
		repository: GitCodeRepository,
		category: PullRequestCategoryKey,
	): Promise<PullRequestSummary[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const listKey = this.getPullRequestListKey(repository, category, session.accountName);
		const existingPromise = this.pullRequestListPromises.get(listKey);
		if (existingPromise) {
			return existingPromise;
		}

		const filters: Parameters<typeof this.pullRequestService.listPullRequests>[1] = {
			state: 'open',
			sort: 'updated',
			direction: 'desc',
			perPage: this.configuration.getPullRequestPageSize(),
		};

		if (category === 'createdByMe') {
			filters.author = session.accountName;
		}

		const requestPromise = this.pullRequestService
			.listPullRequests(repository, filters)
			.catch((error) => {
				this.pullRequestListPromises.delete(listKey);
				throw error;
			});

		this.pullRequestListPromises.set(listKey, requestPromise);
		return requestPromise;
	}

	async refreshAll(): Promise<void> {
		this.repositoriesPromise = undefined;
		this.pullRequestListPromises.clear();
		this.pullRequestFilesPromises.clear();
		if (!this.configuration.getRepositoryOverride()) {
			this.repositoryReadinessCompleted = false;
		}
		this.onDidChangeEmitter.fire({ type: 'all' });
	}

	async refreshRepository(repositoryKey: string): Promise<void> {
		for (const key of [...this.pullRequestListPromises.keys()]) {
			if (key.startsWith(`${repositoryKey}:`)) {
				this.pullRequestListPromises.delete(key);
			}
		}

		for (const key of [...this.pullRequestFilesPromises.keys()]) {
			if (key.startsWith(`${repositoryKey}#`)) {
				this.pullRequestFilesPromises.delete(key);
			}
		}

		this.onDidChangeEmitter.fire({ type: 'repository', repositoryKey });
	}

	async getPullRequestFiles(
		repository: GitCodeRepository,
		pullRequestNumber: number,
	): Promise<PullRequestFileChange[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.getPullRequestFilesKey(repository, pullRequestNumber);
		const existingPromise = this.pullRequestFilesPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.pullRequestService
			.listPullRequestFiles(repository, pullRequestNumber)
			.catch((error) => {
				this.pullRequestFilesPromises.delete(key);
				throw error;
			});

		this.pullRequestFilesPromises.set(key, requestPromise);
		return requestPromise;
	}

	async refreshPullRequestFiles(repositoryKey: string, pullRequestNumber: number): Promise<void> {
		const filesKey = `${repositoryKey}#${pullRequestNumber}:files`;
		this.pullRequestFilesPromises.delete(filesKey);
		this.onDidChangeEmitter.fire({ type: 'pullRequestFiles', repositoryKey, pullRequestNumber });
	}

	private startRepositoryReadinessWait(): void {
		if (!this.repositoryReadinessPromise) {
			this.repositoryReadinessPromise = this.repositoryContext
				.waitForRepository(PullRequestTreeStore.repositoryWaitTimeoutMs, { logTimeout: false })
				.then(() => {
					this.markRepositoryReady();
					this.onDidChangeEmitter.fire({ type: 'all' });
				})
				.catch(() => {
					this.markRepositoryReady();
					this.onDidChangeEmitter.fire({ type: 'all' });
				});
		}
	}

	private async resolveRepositoriesWithStartupRetry(): Promise<GitCodeRepository[]> {
		if (this.configuration.getRepositoryOverride()) {
			return this.repositoryResolver.resolveAll();
		}

		const deadline = Date.now() + PullRequestTreeStore.repositoryInitialLoadingTimeoutMs;
		while (true) {
			try {
				const repositories = await this.repositoryResolver.resolveAll();
				this.markRepositoryReady();
				return repositories;
			} catch (error) {
				if (!this.isRepositoryReadinessError(error)) {
					throw error;
				}

				this.startRepositoryReadinessWait();
				const remainingMs = deadline - Date.now();
				if (remainingMs <= 0) {
					this.repositoriesPromise = undefined;
					this.scheduleRepositoryRetry();
					return [];
				}

				await this.delay(Math.min(PullRequestTreeStore.repositoryRetryDelayMs, remainingMs));
			}
		}
	}

	private scheduleRepositoryRetry(): void {
		if (this.repositoryRetryTimer) {
			return;
		}

		this.repositoryRetryTimer = setTimeout(() => {
			this.repositoryRetryTimer = undefined;
			this.onDidChangeEmitter.fire({ type: 'all' });
		}, PullRequestTreeStore.repositoryRetryDelayMs);
	}

	private markRepositoryReady(): void {
		this.repositoryReadinessCompleted = true;
		this.repositoryReadinessPromise = undefined;
		if (this.repositoryRetryTimer) {
			clearTimeout(this.repositoryRetryTimer);
			this.repositoryRetryTimer = undefined;
		}
	}

	private isRepositoryReadinessError(error: unknown): boolean {
		return error instanceof RepositoryResolutionError || error instanceof RepositoryNotOnGitCodeError;
	}

	private async delay(milliseconds: number): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, milliseconds));
	}

	private getPullRequestFilesKey(repository: GitCodeRepository, pullRequestNumber: number): string {
		return `${repository.fullName}#${pullRequestNumber}:files`;
	}

	private getPullRequestListKey(repository: GitCodeRepository, category: PullRequestCategoryKey, accountName: string): string {
		return `${repository.fullName}:${category}:${accountName}`;
	}
}
