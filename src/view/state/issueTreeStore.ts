import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { ExtensionConfiguration } from '../../common/configuration';
import { NotSignedInError } from '../../common/errors';
import { GitCodeRepository, IssueSummary } from '../../common/models';
import { GitCodeRepositoryResolver } from '../../gitcode/resolver/gitcodeRepositoryResolver';
import { IssueService } from '../../gitcode/services/issueService';

export type IssueCategoryKey = 'allOpen';

export interface IssueCategoryState {
	key: IssueCategoryKey;
	label: string;
	repository: GitCodeRepository;
}

export type IssueTreeRefreshTarget =
	| { type: 'all' }
	| { type: 'repository'; repositoryKey: string };

export class IssueTreeStore {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<IssueTreeRefreshTarget | void>();
	private repositoriesPromise?: Promise<GitCodeRepository[]>;
	private readonly issueListPromises = new Map<string, Promise<IssueSummary[]>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly repositoryResolver: GitCodeRepositoryResolver,
		private readonly issueService: IssueService,
		private readonly configuration: ExtensionConfiguration,
	) {}

	async getRepositories(): Promise<GitCodeRepository[]> {
		if (!this.repositoriesPromise) {
			this.repositoriesPromise = this.repositoryResolver.resolveAll();
		}

		return this.repositoriesPromise;
	}

	getCategories(repository: GitCodeRepository): IssueCategoryState[] {
		return [
			{
				key: 'allOpen',
				label: 'All Open',
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

		const listKey = this.getIssueListKey(repository, category);
		const existingPromise = this.issueListPromises.get(listKey);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.issueService
			.listIssues(repository, {
				state: 'open',
				sort: 'updated',
				direction: 'desc',
				perPage: this.configuration.getIssuesPageSize(),
			})
			.catch((error) => {
				this.issueListPromises.delete(listKey);
				throw error;
			});

		this.issueListPromises.set(listKey, requestPromise);
		return requestPromise;
	}

	async refreshAll(): Promise<void> {
		this.repositoriesPromise = undefined;
		this.issueListPromises.clear();
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

	private getIssueListKey(repository: GitCodeRepository, category: IssueCategoryKey): string {
		return `${repository.fullName}:${category}`;
	}
}
