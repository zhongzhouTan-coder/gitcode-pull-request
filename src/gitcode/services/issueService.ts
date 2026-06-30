import { CreateIssueInput, CreatedIssueSummary, GitCodeRepository, IssueDetail, IssueRelatedPullRequest, IssueSummary } from '../../common/models';
import { GitCodeWriteClient } from '../client/gitcodeClient';
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
	constructor(private readonly client: GitCodeWriteClient) {}

	async createIssue(repository: GitCodeRepository, input: CreateIssueInput): Promise<CreatedIssueSummary> {
		const response = await this.client.post<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/issues`,
			this.mapCreateIssueInput(repository, input),
		);

		return {
			...mapIssue(response),
			htmlUrl: typeof response?.html_url === 'string'
				? response.html_url
				: typeof response?.web_url === 'string'
					? response.web_url
					: typeof response?.url === 'string'
						? response.url
						: undefined,
		};
	}

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

	private mapCreateIssueInput(repository: GitCodeRepository, input: CreateIssueInput): Record<string, unknown> {
		const body: Record<string, unknown> = {
			repo: repository.name,
			title: input.title,
			body: input.body,
			security_hole: input.securityHole,
		};

		if (input.assignees.length > 0) {
			body.assignee = input.assignees.join(',');
		}

		if (input.milestoneNumber !== undefined) {
			body.milestone = input.milestoneNumber;
		}

		if (input.labels.length > 0) {
			body.labels = input.labels.join(',');
		}

		if (input.templatePath !== undefined) {
			body.template_path = input.templatePath;
		}

		return body;
	}
}
