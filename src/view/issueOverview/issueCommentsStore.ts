import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { NotSignedInError } from '../../common/errors';
import { CreateIssueCommentInput, CreateIssueCommentResult, DeleteIssueCommentInput, EditIssueCommentInput, GitCodeRepository, IssueCommentDeleteOperation, IssueCommentEditOperation, IssueCommentsSnapshot } from '../../common/models';
import { IssueCommentService } from '../../gitcode/services/issueCommentService';

export class IssueCommentsStore {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
	private readonly commentPromises = new Map<string, Promise<IssueCommentsSnapshot>>();
	private readonly pendingDeleteOperations = new Map<string, Promise<IssueCommentDeleteOperation>>();
	private readonly pendingEditOperations = new Map<string, Promise<IssueCommentEditOperation>>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(
		private readonly authService: AuthService,
		private readonly commentService: IssueCommentService,
	) {}

	async getComments(
		repository: GitCodeRepository,
		issueNumber: number,
	): Promise<IssueCommentsSnapshot> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const key = this.getKey(repository, issueNumber);
		const existingPromise = this.commentPromises.get(key);
		if (existingPromise) {
			return existingPromise;
		}

		const requestPromise = this.commentService
			.listIssueComments(repository, issueNumber)
			.then((comments) => {
				const snapshot: IssueCommentsSnapshot = {
					repositoryKey: repository.fullName,
					issueNumber,
					comments,
					loadedAt: Date.now(),
				};
				return snapshot;
			})
			.catch((error) => {
				this.commentPromises.delete(key);
				throw error;
			});

		this.commentPromises.set(key, requestPromise);
		return requestPromise;
	}

	async submitComment(
		repository: GitCodeRepository,
		issueNumber: number,
		input: CreateIssueCommentInput,
	): Promise<CreateIssueCommentResult> {
		const session = await this.authService.getSession();
		if (!session) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const result = await this.commentService.createIssueComment(repository, issueNumber, input);
		await this.refresh(repository, issueNumber);
		return result;
	}

	/**
	 * Delete an issue comment and refresh the store.
	 *
	 * Serializes concurrent delete operations per commentId to avoid
	 * duplicate API calls. Returns the operation result so the panel
	 * can render appropriate feedback.
	 */
	async deleteComment(
		repository: GitCodeRepository,
		issueNumber: number,
		input: DeleteIssueCommentInput,
	): Promise<IssueCommentDeleteOperation> {
		const existing = this.pendingDeleteOperations.get(input.commentId);
		if (existing) {
			return existing;
		}

		const operationPromise = this.executeDeleteComment(repository, issueNumber, input);
		this.pendingDeleteOperations.set(input.commentId, operationPromise);

		try {
			return await operationPromise;
		} finally {
			this.pendingDeleteOperations.delete(input.commentId);
		}
	}

	/**
	 * Edit an issue comment and refresh the store.
	 *
	 * Serializes concurrent edit operations per commentId to avoid
	 * duplicate API calls. Returns the operation result so the panel
	 * can render appropriate feedback.
	 */
	async editComment(
		repository: GitCodeRepository,
		issueNumber: number,
		input: EditIssueCommentInput,
	): Promise<IssueCommentEditOperation> {
		const existing = this.pendingEditOperations.get(input.commentId);
		if (existing) {
			return existing;
		}

		const operationPromise = this.executeEditComment(repository, issueNumber, input);
		this.pendingEditOperations.set(input.commentId, operationPromise);

		try {
			return await operationPromise;
		} finally {
			this.pendingEditOperations.delete(input.commentId);
		}
	}

	async refresh(repository: GitCodeRepository, issueNumber: number): Promise<void> {
		this.commentPromises.delete(this.getKey(repository, issueNumber));
		this.onDidChangeEmitter.fire();
	}

	clear(): void {
		this.commentPromises.clear();
		this.pendingDeleteOperations.clear();
		this.pendingEditOperations.clear();
	}

	private getKey(repository: GitCodeRepository, issueNumber: number): string {
		return `${repository.fullName}#${issueNumber}`;
	}

	private async executeDeleteComment(
		repository: GitCodeRepository,
		issueNumber: number,
		input: DeleteIssueCommentInput,
	): Promise<IssueCommentDeleteOperation> {
		if (!input.commentId) {
			return {
				commentId: input.commentId,
				status: 'failed',
				error: 'Comment ID is required.',
			};
		}

		const session = await this.authService.getSession();
		if (!session) {
			return {
				commentId: input.commentId,
				status: 'failed',
				error: 'Sign in to GitCode first.',
			};
		}

		// Validate that the target comment exists in the current snapshot
		const snapshot = await this.getComments(repository, issueNumber);
		const comment = snapshot.comments.find((c) => c.id === input.commentId);

		if (!comment) {
			return {
				commentId: input.commentId,
				status: 'failed',
				error: 'Comment not found.',
			};
		}

		try {
			await this.commentService.deleteIssueComment(repository, input);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete comment.';
			return {
				commentId: input.commentId,
				status: 'failed',
				error: message,
			};
		}

		// On success, refresh so consumers re-render from API state
		try {
			await this.refresh(repository, issueNumber);
		} catch {
			// Comment deleted but refresh failed — still report success
		}

		return {
			commentId: input.commentId,
			status: 'pending', // The actual deletion has succeeded; "pending" status matches the design convention
		};
	}

	private async executeEditComment(
		repository: GitCodeRepository,
		issueNumber: number,
		input: EditIssueCommentInput,
	): Promise<IssueCommentEditOperation> {
		if (!input.commentId) {
			return {
				commentId: input.commentId,
				body: input.body,
				status: 'failed',
				error: 'Comment ID is required.',
			};
		}

		const trimmedBody = input.body.trim();
		if (!trimmedBody) {
			return {
				commentId: input.commentId,
				body: input.body,
				status: 'failed',
				error: 'Comment body is required.',
			};
		}

		const session = await this.authService.getSession();
		if (!session) {
			return {
				commentId: input.commentId,
				body: input.body,
				status: 'failed',
				error: 'Sign in to GitCode first.',
			};
		}

		// Validate that the target comment exists in the current snapshot
		const snapshot = await this.getComments(repository, issueNumber);
		const comment = snapshot.comments.find((c) => c.id === input.commentId);

		if (!comment) {
			return {
				commentId: input.commentId,
				body: input.body,
				status: 'failed',
				error: 'Comment not found.',
			};
		}

		// No-op when body hasn't changed
		if (comment.body === input.body) {
			return {
				commentId: input.commentId,
				body: input.body,
				status: 'pending',
			};
		}

		try {
			await this.commentService.editIssueComment(repository, input);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to edit comment.';
			return {
				commentId: input.commentId,
				body: input.body,
				status: 'failed',
				error: message,
			};
		}

		// On success, refresh so consumers re-render from API state
		try {
			await this.refresh(repository, issueNumber);
		} catch {
			// Comment edited but refresh failed — still report success
		}

		return {
			commentId: input.commentId,
			body: input.body,
			status: 'pending', // The actual edit has succeeded; "pending" status matches the design convention
		};
	}
}
