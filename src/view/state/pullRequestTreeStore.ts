import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { ExtensionConfiguration } from '../../common/configuration';
import { NotSignedInError } from '../../common/errors';
import { GitCodeRepository, PullRequestSummary } from '../../common/models';
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
	| { type: 'repository'; repositoryKey: string };

export class PullRequestTreeStore {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<TreeRefreshTarget | void>();
	private repositoriesPromise?: Promise<GitCodeRepository[]>;
	private readonly pullRequestListPromises = new Map<string, Promise<PullRequestSummary[]>>();

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
		this.onDidChangeEmitter.fire({ type: 'all' });
	}

	async refreshRepository(repositoryKey: string): Promise<void> {
		for (const key of [...this.pullRequestListPromises.keys()]) {
			if (key.startsWith(`${repositoryKey}:`)) {
				this.pullRequestListPromises.delete(key);
			}
		}

		this.onDidChangeEmitter.fire({ type: 'repository', repositoryKey });
	}

	private getPullRequestListKey(repository: GitCodeRepository, category: PullRequestCategoryKey): string {
		return `${repository.fullName}:${category}`;
	}
}
