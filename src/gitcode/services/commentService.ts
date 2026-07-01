import { CreatePullRequestCommentInput, CreatePullRequestCommentResult, EditPullRequestCommentInput, GitCodeRepository, PullRequestComment, PullRequestDiffComment, PullRequestDiffCommentDetail, RevisePullRequestCommentStatusInput } from '../../common/models';
import { GitCodeWriteClient } from '../client/gitcodeClient';
import { mapCreatePullRequestCommentInput, mapCreatePullRequestCommentResult, mapListComment, mapCommentDetail, mergeCommentDetail } from '../mappers/commentMapper';
import { Logger } from '../../common/logger';
import { listPagedRecords } from './pagination';

export interface ListPullRequestCommentsOptions {
	limit?: number;
	newestFirst?: boolean;
}

/**
 * Fetches and enriches pull request comments from the GitCode API.
 *
 * The list-comments endpoint provides comment bodies, authors, and line ranges.
 * Diff comments are enriched via the get-comment detail endpoint for path,
 * snapshot SHAs, and outdated state.
 */
export class CommentService {
	constructor(
		private readonly client: GitCodeWriteClient,
		private readonly logger: Logger,
	) {}

	async createPullRequestComment(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		input: CreatePullRequestCommentInput,
	): Promise<CreatePullRequestCommentResult> {
		const trimmedBody = input.body.trim();
		if (!trimmedBody) {
			throw new Error('Comment body is required.');
		}

		if (input.kind !== 'pullRequest' && !input.path.trim()) {
			throw new Error('Comment path is required.');
		}

		if (input.kind === 'diff' && (!Number.isInteger(input.position) || input.position <= 0)) {
			throw new Error('Comment position must be a positive line number.');
		}

		const payload = mapCreatePullRequestCommentInput({
			...input,
			body: trimmedBody,
		});
		const response = await this.client.post<unknown>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/comments`,
			payload,
		);

		return mapCreatePullRequestCommentResult(response as Record<string, unknown>, trimmedBody);
	}

	/**
	 * List all comments for a pull request.
	 * PR-level comments are returned directly.
	 * Diff comments are enriched asynchronously via concurrent get-comment requests.
	 */
	async listPullRequestComments(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		options: ListPullRequestCommentsOptions = {},
	): Promise<PullRequestComment[]> {
		const response = await this.listPullRequestCommentRecords(repository, pullRequestNumber);

		if (!Array.isArray(response)) {
			return [];
		}

		// Phase 1: Map all records, separating PR comments from diff comments
		const generalComments: PullRequestComment[] = [];
		const diffComments: PullRequestDiffComment[] = [];

		for (const item of response) {
			const mapped = mapListComment(item as Record<string, unknown>);
			if (!mapped) {
				continue;
			}

			if (mapped.kind === 'pullRequest') {
				generalComments.push(mapped);
			} else {
				diffComments.push(mapped);
			}
		}

		let comments: PullRequestComment[] = [...generalComments, ...diffComments];
		if (options.newestFirst) {
			comments = comments.sort((a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
		}

		if (options.limit !== undefined) {
			comments = comments.slice(0, options.limit);
		}

		// Phase 2: Enrich diff comments (limited concurrency)
		const selectedDiffIds = new Map<string, PullRequestDiffComment>();
		for (const comment of comments) {
			if (comment.kind === 'diff') {
				selectedDiffIds.set(comment.id, comment);
			}
		}
		const enrichedDiffs = await this.enrichDiffComments(repository, [...selectedDiffIds.values()]);
		const enrichedById = new Map(enrichedDiffs.map((comment) => [comment.id, comment]));

		return comments.map((comment) => enrichedById.get(comment.id) ?? comment);
	}

	private async listPullRequestCommentRecords(
		repository: GitCodeRepository,
		pullRequestNumber: number,
	): Promise<unknown[]> {
		return listPagedRecords<unknown>(
			this.client,
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/comments`,
		);
	}

	/**
	 * Get a single diff comment detail by ID.
	 */
	async getPullRequestCommentDetail(
		repository: GitCodeRepository,
		commentId: string,
	): Promise<PullRequestDiffCommentDetail> {
		const response = await this.client.get<unknown>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/comments/${commentId}`,
		);

		const detail = mapCommentDetail(response as Record<string, unknown>);
		if (!detail) {
			throw new Error(`Failed to map comment detail for comment ${commentId}`);
		}

		return detail;
	}

	/**
	 * Enrich diff comments with location data from the get-comment endpoint.
	 * Limits concurrency to avoid overwhelming the API.
	 * A failed enrichment leaves the list comment unchanged (visible in overview, not inline).
	 */
	private async enrichDiffComments(
		repository: GitCodeRepository,
		comments: PullRequestDiffComment[],
	): Promise<(PullRequestDiffComment | PullRequestComment)[]> {
		const CONCURRENCY = 4;
		const results: (PullRequestDiffComment | PullRequestComment)[] = [];

		for (let i = 0; i < comments.length; i += CONCURRENCY) {
			const batch = comments.slice(i, i + CONCURRENCY);
			const batchResults = await Promise.allSettled(
				batch.map(async (comment) => {
					try {
						const detail = await this.getPullRequestCommentDetail(repository, comment.id);
						return mergeCommentDetail(comment, detail);
					} catch (error) {
						this.logger.debug(
							`Failed to enrich diff comment ${comment.id}: ${error instanceof Error ? error.message : String(error)}`,
						);
						// Keep the list comment as-is on enrichment failure
						return comment;
					}
				}),
			);

			for (const result of batchResults) {
				if (result.status === 'fulfilled') {
					results.push(result.value);
				} else {
					// Should not happen with the inner try/catch, but guard anyway
					this.logger.error(`Unexpected enrichment failure: ${String(result.reason)}`);
				}
			}
		}

		return results;
	}

	/**
	 * Revise the resolved status of a pull request diff discussion.
	 *
	 * PUT /api/v5/repos/:owner/:repo/pulls/:number/comments/:discussion_id
	 * Body: { "resolved": true | false }
	 */
	async revisePullRequestCommentStatus(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		input: RevisePullRequestCommentStatusInput,
	): Promise<void> {
		if (!input.discussionId) {
			throw new Error('discussionId is required.');
		}

		const path = `/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/comments/${encodeURIComponent(input.discussionId)}`;
		const body = { resolved: input.resolved };

		await this.client.put<unknown>(
			path,
			body,
		);
	}

	/**
	 * Edit an existing pull request comment body.
	 *
	 * PATCH /api/v5/repos/:owner/:repo/pulls/comments/:comment_id
	 * Body: { "body": "Updated comment content" }
	 *
	 * The API returns 200 OK. Treat a successful response as confirmation
	 * and refresh the comments store afterward.
	 */
	async editPullRequestComment(
		repository: GitCodeRepository,
		input: EditPullRequestCommentInput,
	): Promise<void> {
		const trimmedBody = input.body.trim();
		if (!trimmedBody) {
			throw new Error('Comment body is required.');
		}

		if (!input.commentId) {
			throw new Error('commentId is required.');
		}

		const path = `/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/comments/${encodeURIComponent(input.commentId)}`;
		const body = { body: input.body };

		await this.client.patch<unknown>(path, body);
	}
}
