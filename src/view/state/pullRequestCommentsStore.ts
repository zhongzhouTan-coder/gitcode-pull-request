import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { CreatePullRequestCommentInput, CreatePullRequestCommentResult, EditPullRequestCommentInput, GitCodeRepository, PullRequestCommentsSnapshot, PullRequestCommentEditOperation, PullRequestCommentStatusOperation, RevisePullRequestCommentStatusInput } from '../../common/models';
import { CommentService } from '../../gitcode/services/commentService';

export interface CommentChangeEvent {
	repositoryKey: string;
	pullRequestNumber: number;
}

export type CommentsChangeEvent = CommentChangeEvent | undefined;

type CommentKey = `${string}#${number}`;

/**
 * Caches pull request comment snapshots by repository and PR number.
 * Concurrent requests share the same in-flight promise.
 * Emits targeted change events on invalidation or refresh.
 */
export class PullRequestCommentsStore implements vscode.Disposable {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<CommentsChangeEvent>();
	private readonly snapshotPromises = new Map<CommentKey, Promise<PullRequestCommentsSnapshot>>();
	private readonly pendingOperations = new Map<string, Promise<PullRequestCommentStatusOperation>>();
	private readonly pendingEditOperations = new Map<string, Promise<PullRequestCommentEditOperation>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly commentService: CommentService,
	) {}

	/**
	 * Return a cached snapshot or fetch it from the API.
	 */
	async getOrFetch(
		repository: GitCodeRepository,
		pullRequestNumber: number,
	): Promise<PullRequestCommentsSnapshot> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.makeKey(repository, pullRequestNumber);
		const existingPromise = this.snapshotPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.commentService
			.listPullRequestComments(repository, pullRequestNumber)
			.then(
				(comments): PullRequestCommentsSnapshot => ({
					repositoryKey: repository.fullName,
					pullRequestNumber,
					comments,
					loadedAt: Date.now(),
				}),
			)
			.catch((error) => {
				this.snapshotPromises.delete(key);
				throw error;
			});

		this.snapshotPromises.set(key, requestPromise);
		return requestPromise;
	}

	/**
	 * Invalidate the cache entry and optionally refetch.
	 */
	async refresh(repositoryKey: string, pullRequestNumber: number): Promise<void> {
		const key = this.makeKeyFromParts(repositoryKey, pullRequestNumber);
		this.snapshotPromises.delete(key);
		this.onDidChangeEmitter.fire({ repositoryKey, pullRequestNumber });
	}

	async submitComment(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		input: CreatePullRequestCommentInput,
	): Promise<CreatePullRequestCommentResult> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const result = await this.commentService.createPullRequestComment(
			repository,
			pullRequestNumber,
			input,
		);
		await this.refresh(repository.fullName, pullRequestNumber);
		return result;
	}

	/**
	 * Edit an existing pull request comment body.
	 *
	 * Serializes concurrent edit operations per commentId so that duplicate
	 * requests are ignored while one is already running.
	 *
	 * Returns the operation result for UI feedback. On success the store
	 * is refreshed from the API; on failure the previous snapshot is kept
	 * and the edit text is preserved.
	 */
	async editComment(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		input: EditPullRequestCommentInput,
	): Promise<PullRequestCommentEditOperation> {
		// Serialize concurrent edits per commentId
		const existing = this.pendingEditOperations.get(input.commentId);
		if (existing) {
			return existing;
		}

		const operationPromise = this.executeEditComment(repository, pullRequestNumber, input);
		this.pendingEditOperations.set(input.commentId, operationPromise);

		try {
			return await operationPromise;
		} finally {
			this.pendingEditOperations.delete(input.commentId);
		}
	}

	/**
	 * Revise the resolved status of a pull request diff discussion.
	 *
	 * Serializes concurrent operations per discussionId so that duplicate
	 * requests are ignored while one is already running.
	 *
	 * Returns the operation result for UI feedback. On success the store
	 * is refreshed from the API; on failure the previous snapshot is kept.
	 */
	async reviseCommentStatus(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		input: RevisePullRequestCommentStatusInput,
	): Promise<PullRequestCommentStatusOperation> {
		// If there is already a pending operation for this discussion, return it
		const existing = this.pendingOperations.get(input.discussionId);
		if (existing) {
			return existing;
		}

		const operationPromise = this.executeReviseCommentStatus(repository, pullRequestNumber, input);
		this.pendingOperations.set(input.discussionId, operationPromise);

		try {
			return await operationPromise;
		} finally {
			this.pendingOperations.delete(input.discussionId);
		}
	}

	private async executeReviseCommentStatus(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		input: RevisePullRequestCommentStatusInput,
	): Promise<PullRequestCommentStatusOperation> {
		const session = await this.authService.getSession();
		if (!session) {
			return {
				discussionId: input.discussionId,
				resolved: input.resolved,
				status: 'failed',
				error: 'Sign in to GitCode first.',
			};
		}

		// Validate that the target comment exists and is a diff comment
		const snapshot = await this.getOrFetch(repository, pullRequestNumber);
		const comment = snapshot.comments.find((c) => c.discussionId === input.discussionId);

		if (!comment) {
			return {
				discussionId: input.discussionId,
				resolved: input.resolved,
				status: 'failed',
				error: 'Comment not found.',
			};
		}

		if (comment.kind !== 'diff') {
			return {
				discussionId: input.discussionId,
				resolved: input.resolved,
				status: 'failed',
				error: 'Only diff comments can be resolved or unresolved.',
			};
		}

		// Validate that the requested state differs from current
		if (comment.resolved === input.resolved) {
			return {
				discussionId: input.discussionId,
				resolved: input.resolved,
				status: 'failed',
				error: 'Comment is already in the requested state.',
			};
		}

		try {
			await this.commentService.revisePullRequestCommentStatus(
				repository,
				pullRequestNumber,
				input,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to revise comment status.';
			return {
				discussionId: input.discussionId,
				resolved: input.resolved,
				status: 'failed',
				error: message,
			};
		}

		// On success, refresh the store so consumers re-render from API state
		try {
			await this.refresh(repository.fullName, pullRequestNumber);
		} catch {
			// Status changed but refresh failed — still report success to the caller
		}

		return {
			discussionId: input.discussionId,
			resolved: input.resolved,
			status: 'pending',
		};
	}

	private async executeEditComment(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		input: EditPullRequestCommentInput,
	): Promise<PullRequestCommentEditOperation> {
		const session = await this.authService.getSession();
		if (!session) {
			return {
				commentId: input.commentId,
				body: input.body,
				status: 'failed',
				error: 'Sign in to GitCode first.',
			};
		}

		// Validate body is not empty
		if (!input.body.trim()) {
			return {
				commentId: input.commentId,
				body: input.body,
				status: 'failed',
				error: 'Comment body is required.',
			};
		}

		try {
			await this.commentService.editPullRequestComment(repository, input);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to edit comment.';
			return {
				commentId: input.commentId,
				body: input.body,
				status: 'failed',
				error: message,
			};
		}

		// On success, refresh the store so consumers re-render from API state
		try {
			await this.refresh(repository.fullName, pullRequestNumber);
		} catch {
			// Comment edited but refresh failed — still report success to the caller
		}

		return {
			commentId: input.commentId,
			body: input.body,
			status: 'pending',
		};
	}

	/**
	 * Invalidate without emitting a change event (used when clearing all state).
	 */
	invalidate(repositoryKey: string, pullRequestNumber: number): void {
		const key = this.makeKeyFromParts(repositoryKey, pullRequestNumber);
		this.snapshotPromises.delete(key);
	}

	/**
	 * Clear all cached snapshots and notify consumers to discard derived state.
	 */
	clear(): void {
		this.snapshotPromises.clear();
		this.onDidChangeEmitter.fire(undefined);
	}

	dispose(): void {
		this.snapshotPromises.clear();
		this.pendingOperations.clear();
		this.pendingEditOperations.clear();
		this.onDidChangeEmitter.dispose();
	}

	private makeKey(repository: GitCodeRepository, pullRequestNumber: number): CommentKey {
		return `${repository.fullName}#${pullRequestNumber}`;
	}

	private makeKeyFromParts(repositoryKey: string, pullRequestNumber: number): CommentKey {
		return `${repositoryKey}#${pullRequestNumber}`;
	}
}
