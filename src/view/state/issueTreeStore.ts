import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { ExtensionConfiguration } from '../../common/configuration';
import { NotSignedInError, RepositoryNotOnGitCodeError, RepositoryResolutionError } from '../../common/errors';
import { RepositoryContextService } from '../../common/git/repositoryContext';
import { GitCodeRepository, IssueSummary } from '../../common/models';
import { GitCodeRepositoryResolver } from '../../gitcode/resolver/gitcodeRepositoryResolver';
import { IssueService } from '../../gitcode/services/issueService';

export type IssueCategoryKey = 'myIssues' | 'createdIssues' | 'recentIssues';

export interface IssueCategoryState {
	key: IssueCategoryKey;
	label: string;
	repository: GitCodeRepository;
}

export type IssueTreeRefreshTarget =
	| { type: 'all' }
	| { type: 'repository'; repositoryKey: string };

export class IssueTreeStore {
	private static readonly repositoryWaitTimeoutMs = 120000;
	private static readonly repositoryInitialLoadingTimeoutMs = 5000;
	private static readonly repositoryRetryDelayMs = 500;
	private readonly onDidChangeEmitter = new vscode.EventEmitter<IssueTreeRefreshTarget | void>();
	private repositoriesPromise?: Promise<GitCodeRepository[]>;
	private repositoryReadinessPromise?: Promise<void>;
	private repositoryReadinessCompleted = false;
	private repositoryRetryTimer?: ReturnType<typeof setTimeout>;
	private readonly issueListPromises = new Map<string, Promise<IssueSummary[]>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly repositoryContext: RepositoryContextService,
		private readonly repositoryResolver: GitCodeRepositoryResolver,
		private readonly issueService: IssueService,
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

	getCategories(repository: GitCodeRepository): IssueCategoryState[] {
		return [
			{
				key: 'myIssues',
				label: 'My Issues',
				repository,
			},
			{
				key: 'createdIssues',
				label: 'Created Issues',
				repository,
			},
			{
				key: 'recentIssues',
				label: 'Recent Issues',
				repository,
			},
		];
	}

	async getIssues(
		repository: GitCodeRepository,
		category: IssueCategoryKey,
	): Promise<IssueSummary[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const listKey = this.getIssueListKey(repository, category, session.accountName);
		const existingPromise = this.issueListPromises.get(listKey);
		if (existingPromise) {
			return existingPromise;
		}

		const filters = this.buildCategoryFilters(category, session.accountName);

		const requestPromise = this.issueService
			.listIssues(repository, filters)
			.catch((error) => {
				this.issueListPromises.delete(listKey);
				throw error;
			});

		this.issueListPromises.set(listKey, requestPromise);
		return requestPromise;
	}

	private buildCategoryFilters(
		category: IssueCategoryKey,
		accountName: string,
	): {
		state: 'open';
		sort: 'updated';
		direction: 'desc';
		perPage: number;
		assignee?: string;
		creator?: string;
	} {
		const base = {
			state: 'open' as const,
			sort: 'updated' as const,
			direction: 'desc' as const,
			perPage: this.configuration.getIssuesPageSize(),
		};

		switch (category) {
			case 'myIssues':
				return { ...base, assignee: accountName };
			case 'createdIssues':
				return { ...base, creator: accountName };
			case 'recentIssues':
				return { ...base };
		}
	}

	async refreshAll(): Promise<void> {
		this.repositoriesPromise = undefined;
		this.issueListPromises.clear();
		if (!this.configuration.getRepositoryOverride()) {
			this.repositoryReadinessCompleted = false;
		}
		this.onDidChangeEmitter.fire({ type: 'all' });
	}

	async refreshRepository(repositoryKey: string): Promise<void> {
		for (const key of [...this.issueListPromises.keys()]) {
			if (key.startsWith(`${repositoryKey}:`)) {
				this.issueListPromises.delete(key);
			}
		}

		this.onDidChangeEmitter.fire({ type: 'repository', repositoryKey });
	}

	private startRepositoryReadinessWait(): void {
		if (!this.repositoryReadinessPromise) {
			this.repositoryReadinessPromise = this.repositoryContext
				.waitForRepository(IssueTreeStore.repositoryWaitTimeoutMs, { logTimeout: false })
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

		const deadline = Date.now() + IssueTreeStore.repositoryInitialLoadingTimeoutMs;
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

				await this.delay(Math.min(IssueTreeStore.repositoryRetryDelayMs, remainingMs));
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
		}, IssueTreeStore.repositoryRetryDelayMs);
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

	private getIssueListKey(repository: GitCodeRepository, category: IssueCategoryKey, accountName: string): string {
		return `${repository.fullName}:${category}:${accountName}`;
	}
}
