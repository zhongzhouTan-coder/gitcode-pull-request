import { GitCodeRepository, IssueDetail, IssueRelatedPullRequest, IssueSummary } from '../../common/models';
import { GitCodeClient } from '../client/gitcodeClient';
import { mapIssue } from '../mappers/issueMapper';
import { mapIssueDetail } from '../mappers/issueDetailMapper';
import { mapIssueRelatedPullRequests } from '../mappers/issueRelatedPullRequestMapper';

export interface IssueFilters {
	state?: 'open' | 'closed' | 'all';
	sort?: 'created' | 'updated' | 'comments';
	direction?: 'asc' | 'desc';
	perPage?: number;
	page?: number;
}

export class IssueService {
	constructor(private readonly client: GitCodeClient) {}

	async listIssues(repository: GitCodeRepository, filters: IssueFilters = {}): Promise<IssueSummary[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/issues`,
			{
				state: filters.state ?? 'open',
				sort: filters.sort ?? 'updated',
				direction: filters.direction ?? 'desc',
				per_page: filters.perPage,
				page: filters.page,
			},
		);

		return response.map((issue) => mapIssue(issue));
	}

	async getIssue(repository: GitCodeRepository, issueNumber: number): Promise<IssueDetail> {
		const response = await this.client.get<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/issues/${issueNumber}`,
		);

		return mapIssueDetail(response);
	}

	async listIssueRelatedPullRequests(
		repository: GitCodeRepository,
		issueNumber: number,
	): Promise<IssueRelatedPullRequest[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/issues/${issueNumber}/pull_requests`,
		);

		if (!Array.isArray(response)) {
			return [];
		}

		return mapIssueRelatedPullRequests(response);
	}
}
