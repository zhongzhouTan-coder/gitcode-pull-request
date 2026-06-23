import { GitCodeRepository, PullRequestDetail, PullRequestDiffSnapshot, PullRequestFileChange, PullRequestFilesJsonDto, PullRequestSummary } from '../../common/models';
import { GitCodeClient } from '../client/gitcodeClient';
import { mapDiffSnapshot } from '../mappers/pullRequestDiffSnapshotMapper';
import { mapPullRequestDetail } from '../mappers/pullRequestDetailMapper';
import { mapPullRequestFiles } from '../mappers/pullRequestFileMapper';
import { mapPullRequest } from '../mappers/pullRequestMapper';

export interface PullRequestFilters {
	state?: 'open' | 'closed';
	perPage?: number;
}

export class PullRequestService {
	constructor(private readonly client: GitCodeClient) {}

	async listPullRequests(repository: GitCodeRepository, filters: PullRequestFilters = {}): Promise<PullRequestSummary[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls`,
			{
				state: filters.state ?? 'open',
				per_page: filters.perPage,
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
}
