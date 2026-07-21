import { CreateIssueCommentInput, CreateIssueCommentResult, DeleteIssueCommentInput, GitCodeRepository, IssueComment } from '../../common/models';
import { GitCodeDeleteClient } from '../client/gitcodeClient';
import { mapCreateIssueCommentResult, mapIssueComments } from '../mappers/issueCommentMapper';
import { listPagedRecords } from './pagination';

/**
 * Fetches issue comments from the GitCode API.
 */
export class IssueCommentService {
	constructor(private readonly client: GitCodeDeleteClient) {}

	/**
	 * List all comments for an issue.
	 */
	async listIssueComments(
		repository: GitCodeRepository,
		issueNumber: number,
	): Promise<IssueComment[]> {
		const response = await listPagedRecords<Record<string, unknown>>(
			this.client,
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/issues/${issueNumber}/comments`,
		);

		return mapIssueComments(response);
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

	/**
	 * Delete a comment from an issue.
	 */
	async deleteIssueComment(
		repository: GitCodeRepository,
		input: DeleteIssueCommentInput,
	): Promise<void> {
		if (!input.commentId) {
			throw new Error('Comment ID is required.');
		}

		await this.client.delete(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/issues/comments/${encodeURIComponent(input.commentId)}`,
		);
	}
}
