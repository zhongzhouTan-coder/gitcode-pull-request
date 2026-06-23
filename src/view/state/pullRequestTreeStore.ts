import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { ExtensionConfiguration } from '../../common/configuration';
import { NotSignedInError } from '../../common/errors';
import { GitCodeRepository, PullRequestFileChange, PullRequestSummary } from '../../common/models';
import { GitCodeRepositoryResolver } from '../../gitcode/resolver/gitcodeRepositoryResolver';
import { PullRequestService } from '../../gitcode/services/pullRequestService';

export type PullRequestCategoryKey = 'allOpen';

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
	private readonly onDidChangeEmitter = new vscode.EventEmitter<TreeRefreshTarget | void>();
	private repositoriesPromise?: Promise<GitCodeRepository[]>;
	private readonly pullRequestListPromises = new Map<string, Promise<PullRequestSummary[]>>();
	private readonly pullRequestFilesPromises = new Map<string, Promise<PullRequestFileChange[]>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly repositoryResolver: GitCodeRepositoryResolver,
		private readonly pullRequestService: PullRequestService,
		private readonly configuration: ExtensionConfiguration,
	) {}

	async getRepositories(): Promise<GitCodeRepository[]> {
		if (!this.repositoriesPromise) {
			this.repositoriesPromise = this.repositoryResolver.resolveAll();
		}

		return this.repositoriesPromise;
	}

	getCategories(repository: GitCodeRepository): PullRequestCategoryState[] {
		return [
			{
				key: 'allOpen',
				label: 'All Open',
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

		const listKey = this.getPullRequestListKey(repository, category);
		const existingPromise = this.pullRequestListPromises.get(listKey);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.pullRequestService
			.listPullRequests(repository, {
				state: 'open',
				perPage: this.configuration.getPullRequestPageSize(),
			})
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

	private getPullRequestFilesKey(repository: GitCodeRepository, pullRequestNumber: number): string {
		return `${repository.fullName}#${pullRequestNumber}:files`;
	}

	private getPullRequestListKey(repository: GitCodeRepository, category: PullRequestCategoryKey): string {
		return `${repository.fullName}:${category}`;
	}
}
