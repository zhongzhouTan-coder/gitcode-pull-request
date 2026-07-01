import { CreateIssueCommentInput, CreateIssueCommentResult, GitCodeRepository, IssueComment } from '../../common/models';
import { GitCodeWriteClient } from '../client/gitcodeClient';
import { mapCreateIssueCommentResult, mapIssueComments } from '../mappers/issueCommentMapper';

/**
 * Fetches issue comments from the GitCode API.
 */
export class IssueCommentService {
	constructor(private readonly client: GitCodeWriteClient) {}

	/**
	 * List all comments for an issue.
	 */
	async listIssueComments(
		repository: GitCodeRepository,
		issueNumber: number,
	): Promise<IssueComment[]> {
		const response = await this.client.get<unknown[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/issues/${issueNumber}/comments`,
		);

		if (!Array.isArray(response)) {
			return [];
		}

		return mapIssueComments(response as Record<string, unknown>[]);
	}

	/**
	 * Create a comment on an issue.
	 */
	async createIssueComment(
		repository: GitCodeRepository,
		issueNumber: number,
		input: CreateIssueCommentInput,
	): Promise<CreateIssueCommentResult> {
		const response = await this.client.post<Record<string, unknown>>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/issues/${issueNumber}/comments`,
			{ body: input.body },
		);

		return mapCreateIssueCommentResult(response);
	}
}
