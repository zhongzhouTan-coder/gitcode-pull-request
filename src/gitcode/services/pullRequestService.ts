import { CreatePullRequestInput, CreatedPullRequestSummary, EditPullRequestInput, GitCodeRepository, PullRequestDetail, PullRequestDiffSnapshot, PullRequestFileChange, PullRequestFilesJsonDto, PullRequestRelatedIssue, PullRequestSummary } from '../../common/models';
import { GitCodeWriteClient } from '../client/gitcodeClient';
import { mapDiffSnapshot } from '../mappers/pullRequestDiffSnapshotMapper';
import { mapPullRequestDetail } from '../mappers/pullRequestDetailMapper';
import { mapPullRequestFiles } from '../mappers/pullRequestFileMapper';
import { mapCreatePullRequestInput, mapCreatedPullRequest, mapEditPullRequestInput, mapPullRequest } from '../mappers/pullRequestMapper';
import { mapPullRequestRelatedIssues } from '../mappers/pullRequestRelatedIssueMapper';

export interface PullRequestFilters {
	state?: 'open' | 'closed';
	perPage?: number;
	base?: string;
}

export class PullRequestService {
	constructor(private readonly client: GitCodeWriteClient) {}

	async listPullRequests(repository: GitCodeRepository, filters: PullRequestFilters = {}): Promise<PullRequestSummary[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls`,
			{
				state: filters.state ?? 'open',
				per_page: filters.perPage,
				base: filters.base,
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
		const response = await this.client.get<any[]>(
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
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/issues`,
		);

		return mapPullRequestRelatedIssues(response);
	}
}
