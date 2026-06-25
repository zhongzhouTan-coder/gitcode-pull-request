import { GitCodeRepository, IssueComment } from '../../common/models';
import { GitCodeClient } from '../client/gitcodeClient';
import { mapIssueComments } from '../mappers/issueCommentMapper';

/**
 * Fetches issue comments from the GitCode API.
 */
export class IssueCommentService {
	constructor(private readonly client: GitCodeClient) {}

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
}
