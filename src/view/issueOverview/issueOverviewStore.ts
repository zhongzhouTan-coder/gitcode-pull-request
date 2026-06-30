import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { EditIssueInput, EditIssueOptions, GitCodeRepository, IssueDetail } from '../../common/models';
import { IssueService } from '../../gitcode/services/issueService';
import { RepositoryService } from '../../gitcode/services/repositoryService';

export class IssueOverviewStore {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
	private readonly detailPromises = new Map<string, Promise<IssueDetail>>();
	private readonly editOptionsPromises = new Map<string, Promise<EditIssueOptions>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly issueService: IssueService,
		private readonly repositoryService?: RepositoryService,
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

	async getEditOptions(repository: GitCodeRepository): Promise<EditIssueOptions> {
		if (!this.repositoryService) {
			return { assignees: [], labels: [], milestones: [] };
		}

		const key = repository.fullName;
		const existingPromise = this.editOptionsPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = Promise.all([
			this.repositoryService.listMembers(repository, { perPage: 100 }),
			this.repositoryService.listLabels(repository, { perPage: 100 }),
			this.repositoryService.listMilestones(repository, { state: 'all', perPage: 100 }),
		]).then(([assignees, labels, milestones]) => ({
			assignees,
			labels,
			milestones,
		})).catch((error) => {
			this.editOptionsPromises.delete(key);
			throw error;
		});

		this.editOptionsPromises.set(key, requestPromise);
		return requestPromise;
	}

	async editIssue(
		repository: GitCodeRepository,
		issueNumber: number,
		input: EditIssueInput,
	): Promise<IssueDetail> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const result = await this.issueService.editIssue(repository, issueNumber, input);
		this.detailPromises.delete(this.getKey(repository, issueNumber));
		this.onDidChangeEmitter.fire();

		return result;
	}

	async refresh(repository: GitCodeRepository, issueNumber: number): Promise<void> {
		this.detailPromises.delete(this.getKey(repository, issueNumber));
		this.onDidChangeEmitter.fire();
	}

	private getKey(repository: GitCodeRepository, issueNumber: number): string {
		return `${repository.fullName}#${issueNumber}`;
	}
}
