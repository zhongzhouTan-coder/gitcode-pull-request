import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { EditPullRequestInput, EditPullRequestOptions, GitCodeRepository, GitCodeUser, PullRequestDetail, PullRequestRelatedIssue, AddedPullRequestRelatedIssue, IssueSummary } from '../../common/models';
import { PullRequestService } from '../../gitcode/services/pullRequestService';
import { RepositoryService } from '../../gitcode/services/repositoryService';
import { IssueService } from '../../gitcode/services/issueService';

export class PullRequestOverviewStore {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
	private readonly detailPromises = new Map<string, Promise<PullRequestDetail>>();
	private readonly relatedIssuesPromises = new Map<string, Promise<PullRequestRelatedIssue[]>>();
	private readonly editOptionsPromises = new Map<string, Promise<EditPullRequestOptions>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly pullRequestService: PullRequestService,
		private readonly repositoryService?: RepositoryService,
		private readonly issueService?: IssueService,
	) {}

	async getCurrentUserLogin(): Promise<string | undefined> {
		return (await this.authService.getSession())?.accountName;
	}

	async getDetail(repository: GitCodeRepository, pullRequestNumber: number, forceRefresh = false): Promise<PullRequestDetail> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.getKey(repository, pullRequestNumber);
		if (forceRefresh) {
			this.detailPromises.delete(key);
		}

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

	async getRelatedIssues(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestRelatedIssue[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.getKey(repository, pullRequestNumber);
		const existingPromise = this.relatedIssuesPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.pullRequestService
			.listPullRequestRelatedIssues(repository, pullRequestNumber)
			.catch((error) => {
				this.relatedIssuesPromises.delete(key);
				throw error;
			});

		this.relatedIssuesPromises.set(key, requestPromise);
		return requestPromise;
	}

	async getEditOptions(repository: GitCodeRepository): Promise<EditPullRequestOptions> {
		if (!this.repositoryService) {
			return { labels: [], milestones: [] };
		}

		const key = repository.fullName;
		const existingPromise = this.editOptionsPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = Promise.all([
			this.repositoryService.listLabels(repository, { perPage: 100 }),
			this.repositoryService.listMilestones(repository, { state: 'all', perPage: 100 }),
		]).then(([labels, milestones]) => ({ labels, milestones }))
		.catch((error) => {
			this.editOptionsPromises.delete(key);
			throw error;
		});

		this.editOptionsPromises.set(key, requestPromise);
		return requestPromise;
	}

	async editPullRequest(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		input: EditPullRequestInput,
	): Promise<PullRequestDetail> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const result = await this.pullRequestService.editPullRequest(repository, pullRequestNumber, input);

		// Invalidate the cached detail so the overview reloads fresh data
		const key = this.getKey(repository, pullRequestNumber);
		this.detailPromises.delete(key);
		this.onDidChangeEmitter.fire();

		return result;
	}

	async listSelectableReviewers(repository: GitCodeRepository, pullRequestNumber: number): Promise<GitCodeUser[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		return this.pullRequestService.listSelectableReviewers(repository, pullRequestNumber);
	}

	async addReviewers(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<GitCodeUser[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const result = await this.pullRequestService.addReviewers(repository, pullRequestNumber, logins);

		const key = this.getKey(repository, pullRequestNumber);
		this.detailPromises.delete(key);
		this.onDidChangeEmitter.fire();

		return result;
	}

	async removeReviewers(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<void> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		await this.pullRequestService.removeReviewers(repository, pullRequestNumber, logins);

		const key = this.getKey(repository, pullRequestNumber);
		this.detailPromises.delete(key);
		this.onDidChangeEmitter.fire();
	}

	async refresh(repository: GitCodeRepository, pullRequestNumber: number): Promise<void> {
		const key = this.getKey(repository, pullRequestNumber);
		this.detailPromises.delete(key);
		this.relatedIssuesPromises.delete(key);
		this.onDidChangeEmitter.fire();
	}

	async addRelatedIssues(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		issueNumbers: readonly number[],
	): Promise<AddedPullRequestRelatedIssue[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const result = await this.pullRequestService.addRelatedIssues(repository, pullRequestNumber, issueNumbers);

		// Invalidate the related issue cache so the overview reloads fresh data
		const key = this.getKey(repository, pullRequestNumber);
		this.relatedIssuesPromises.delete(key);
		this.onDidChangeEmitter.fire();

		return result;
	}

	async removeRelatedIssues(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		issueNumbers: readonly number[],
	): Promise<void> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		await this.pullRequestService.removeRelatedIssues(repository, pullRequestNumber, issueNumbers);

		// Invalidate the related issue cache so the overview reloads fresh data
		const key = this.getKey(repository, pullRequestNumber);
		this.relatedIssuesPromises.delete(key);
		this.onDidChangeEmitter.fire();
	}

	async listLinkableIssues(repository: GitCodeRepository): Promise<IssueSummary[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		if (!this.issueService) {
			return [];
		}

		return this.issueService.listIssues(repository, {
			state: 'open',
			sort: 'updated',
			direction: 'desc',
			perPage: 100,
		});
	}

	async listSelectableTesters(repository: GitCodeRepository): Promise<GitCodeUser[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		return this.pullRequestService.listSelectableTesters(repository);
	}

	async addTesters(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<GitCodeUser[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const result = await this.pullRequestService.addTesters(repository, pullRequestNumber, logins);

		const key = this.getKey(repository, pullRequestNumber);
		this.detailPromises.delete(key);
		this.onDidChangeEmitter.fire();

		return result;
	}

	async removeTesters(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<void> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		await this.pullRequestService.removeTesters(repository, pullRequestNumber, logins);

		const key = this.getKey(repository, pullRequestNumber);
		this.detailPromises.delete(key);
		this.onDidChangeEmitter.fire();
	}

	async listSelectableAssignees(repository: GitCodeRepository): Promise<GitCodeUser[]> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		if (!this.repositoryService) {
			return [];
		}

		return this.repositoryService.listMembers(repository, { perPage: 100 });
	}

	async addAssignees(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<void> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		await this.pullRequestService.addAssignees(repository, pullRequestNumber, logins);

		const key = this.getKey(repository, pullRequestNumber);
		this.detailPromises.delete(key);
		this.onDidChangeEmitter.fire();
	}

	async removeAssignees(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<void> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		await this.pullRequestService.removeAssignees(repository, pullRequestNumber, logins);

		const key = this.getKey(repository, pullRequestNumber);
		this.detailPromises.delete(key);
		this.onDidChangeEmitter.fire();
	}

	private getKey(repository: GitCodeRepository, pullRequestNumber: number): string {
		return `${repository.fullName}#${pullRequestNumber}`;
	}
}
