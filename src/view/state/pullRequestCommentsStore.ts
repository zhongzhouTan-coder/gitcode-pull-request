import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { GitCodeRepository, PullRequestCommentsSnapshot } from '../../common/models';
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
		this.onDidChangeEmitter.dispose();
	}

	private makeKey(repository: GitCodeRepository, pullRequestNumber: number): CommentKey {
		return `${repository.fullName}#${pullRequestNumber}`;
	}

	private makeKeyFromParts(repositoryKey: string, pullRequestNumber: number): CommentKey {
		return `${repositoryKey}#${pullRequestNumber}`;
	}
}
