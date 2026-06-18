import { GitCodeRepository, PullRequestSummary } from '../../common/models';
import { GitCodeClient } from '../client/gitcodeClient';
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
}
