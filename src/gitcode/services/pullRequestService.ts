import { CreatePullRequestInput, CreatedPullRequestSummary, EditPullRequestInput, GitCodeRepository, PullRequestDetail, PullRequestDiffSnapshot, PullRequestFileChange, PullRequestFilesJsonDto, PullRequestOperationLog, PullRequestRelatedIssue, PullRequestSummary } from '../../common/models';
import { GitCodeDeleteClient } from '../client/gitcodeClient';
import { mapDiffSnapshot } from '../mappers/pullRequestDiffSnapshotMapper';
import { mapPullRequestDetail } from '../mappers/pullRequestDetailMapper';
import { mapPullRequestFiles } from '../mappers/pullRequestFileMapper';
import { mapPullRequestOperationLogs } from '../mappers/pullRequestOperationLogMapper';
import { mapCreatePullRequestInput, mapCreatedPullRequest, mapEditPullRequestInput, mapPullRequest } from '../mappers/pullRequestMapper';
import { mapPullRequestRelatedIssues } from '../mappers/pullRequestRelatedIssueMapper';
import { mapAddedPullRequestRelatedIssues } from '../mappers/addedPullRequestRelatedIssueMapper';
import { AddedPullRequestRelatedIssue } from '../../common/models';
import { listPagedRecords, pageQuery } from './pagination';

export interface PullRequestFilters {
	state?: 'open' | 'closed' | 'all';
	perPage?: number;
	page?: number;
	base?: string;
	sort?: 'created' | 'updated';
	direction?: 'asc' | 'desc';
	author?: string;
}

export class PullRequestService {
	constructor(private readonly client: GitCodeDeleteClient) {}

	async listPullRequests(repository: GitCodeRepository, filters: PullRequestFilters = {}): Promise<PullRequestSummary[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls`,
			{
				state: filters.state ?? 'open',
				...pageQuery(filters),
				base: filters.base,
				sort: filters.sort,
				direction: filters.direction,
				author: filters.author,
			},
		);

		return response.map((pullRequest) => mapPullRequest(pullRequest));
	}

	async getPullRequest(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestDetail> {
		const response = await this.client.get<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}`,
		);

		return mapPullRequestDetail(response);
	}

	async createPullRequest(
		repository: GitCodeRepository,
		input: CreatePullRequestInput,
	): Promise<CreatedPullRequestSummary> {
		const requestBody = mapCreatePullRequestInput(input);
		const response = await this.client.post<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls`,
			requestBody,
		);
		return mapCreatedPullRequest(response);
	}

	async editPullRequest(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		input: EditPullRequestInput,
	): Promise<PullRequestDetail> {
		const requestBody = mapEditPullRequestInput(input);
		const response = await this.client.patch<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}`,
			requestBody,
		);
		return mapPullRequestDetail(response);
	}

	async listPullRequestFiles(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestFileChange[]> {
		const response = await listPagedRecords<any>(
			this.client,
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/files`,
		);

		return mapPullRequestFiles(response);
	}

	async getPullRequestDiffSnapshot(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestDiffSnapshot> {
		const response = await this.client.get<PullRequestFilesJsonDto>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/files.json`,
		);

		return mapDiffSnapshot(response);
	}

	async listPullRequestRelatedIssues(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestRelatedIssue[]> {
		const response = await listPagedRecords<any>(
			this.client,
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/issues`,
		);

		return mapPullRequestRelatedIssues(response);
	}

	async listPullRequestOperationLogs(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestOperationLog[]> {
		const response = await listPagedRecords<any>(
			this.client,
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/operate_logs`,
		);

		return mapPullRequestOperationLogs(response);
	}

	async addRelatedIssues(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		issueNumbers: readonly number[],
	): Promise<AddedPullRequestRelatedIssue[]> {
		if (!issueNumbers.length) {
			throw new Error('At least one issue number is required.');
		}

		const response = await this.client.post<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/issues`,
			issueNumbers,
		);

		return mapAddedPullRequestRelatedIssues(response);
	}

	async removeRelatedIssues(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		issueNumbers: readonly number[],
	): Promise<void> {
		if (!issueNumbers.length) {
			throw new Error('At least one issue number is required.');
		}

		await this.client.delete(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/issues`,
			issueNumbers,
		);
	}
}
