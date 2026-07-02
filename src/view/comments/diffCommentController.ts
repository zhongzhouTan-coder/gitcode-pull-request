import * as vscode from 'vscode';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { CreatePullRequestCommentInput, EditPullRequestCommentInput, GitCodeRepository, PullRequestCommentsSnapshot } from '../../common/models';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { applyCommentThread, createCommentThread, selectCommentsForDocument } from './commentThreadFactory';
import { parsePrUri } from '../diff/prUriHelpers';
import { PullRequestDiffStore } from '../diff/pullRequestDiffStore';

function createRepository(owner: string, repo: string): GitCodeRepository {
	return {
		remoteName: '',
		owner,
		name: repo,
		fullName: `${owner}/${repo}`,
		webUrl: '',
	};
}

export function createCommentingRanges(lineCount: number): vscode.CommentingRanges | undefined {
	if (lineCount < 1) {
		return undefined;
	}

	return {
		enableFileComments: true,
		ranges: [new vscode.Range(0, 0, lineCount - 1, 0)],
	};
}

export function validateDiffCommentDraft(
	documentUri: vscode.Uri,
	range: vscode.Range | undefined,
	body: string,
	currentHeadSha?: string,
): string[] {
	const parsed = parsePrUri(documentUri);
	if (!parsed) {
		return ['Only pull request diff documents support comments.'];
	}

	if (parsed.side !== 'head') {
		return ['Comments are only supported on the head side of a pull request diff.'];
	}

	if (!parsed.sha) {
		return ['Comments require the current pull request diff snapshot. Refresh the diff and try again.'];
	}

	if (currentHeadSha && parsed.sha !== currentHeadSha) {
		return ['This diff is out of date. Refresh the pull request diff before commenting.'];
	}

	if (!parsed.path) {
		return ['Comments require a file path.'];
	}

	if (!body.trim()) {
		return ['Comment body is required.'];
	}

	if (range && range.start.line < 0) {
		return ['Comments require a valid line number.'];
	}

	return [];
}

export function createDiffCommentInput(
	documentUri: vscode.Uri,
	range: vscode.Range | undefined,
	body: string,
): CreatePullRequestCommentInput {
	const errors = validateDiffCommentDraft(documentUri, range, body);
	if (errors.length) {
		throw new Error(errors.join(' '));
	}

	const parsed = parsePrUri(documentUri);
	if (!parsed) {
		throw new Error('Only pull request diff documents support comments.');
	}

	if (!range) {
		return {
			kind: 'file',
			body,
			path: parsed.path,
			positionType: 'binary',
		};
	}

	return {
		kind: 'diff',
		body,
		path: parsed.path,
		position: range.start.line + 1,
		positionType: 'text',
	};
}

interface CommentThreadKey {
	repositoryKey: string;
	pullRequestNumber: number;
	path: string;
	side: 'base' | 'head';
	discussionId: string;
}

function threadKeyToString(key: CommentThreadKey): string {
	return `${key.repositoryKey}#${key.pullRequestNumber}:${key.path}:${key.side}:${key.discussionId}`;
}

function isCommentReply(value: unknown): value is vscode.CommentReply {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Partial<vscode.CommentReply>;
	return Boolean(
		candidate.thread
		&& candidate.thread.uri instanceof vscode.Uri
		&& typeof candidate.text === 'string',
	);
}

/**
 * Owns one vscode.CommentController and manages the lifecycle of inline
 * comment threads for open `gitcode-pr` diff documents.
 *
 * Follows the pattern:
 * 1. Watch opened/closed PR diff documents.
 * 2. For each open document, compute desired threads from the shared store.
 * 3. Reuse existing threads with the same key; create new ones; dispose stale ones.
 */
export class DiffCommentController implements vscode.Disposable {
	private readonly controller: vscode.CommentController;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly activeThreads = new Map<string, vscode.CommentThread>();
	private readonly threadMetadata = new Map<vscode.CommentThread, {
		repository: GitCodeRepository;
		pullRequestNumber: number;
		discussionId: string;
		commentId: string;
	}>();
	private readonly trackedDocs = new Set<string>();

	constructor(
		private readonly commentsStore: PullRequestCommentsStore,
		private readonly diffStore: PullRequestDiffStore,
		private readonly logger: Logger,
	) {
		this.controller = vscode.comments.createCommentController(
			'gitcode-pull-request-comments',
			'GitCode Pull Request Comments',
		);
		this.controller.options = {
			prompt: 'Submit comment',
			placeHolder: 'Write a comment',
		};
		this.controller.commentingRangeProvider = {
			provideCommentingRanges: (document) => this.provideCommentingRanges(document),
		};

		this.disposables.push(
			this.controller,
			vscode.commands.registerCommand(COMMAND_ID.submitPullRequestDiffComment, async (reply?: vscode.CommentReply) => {
				if (!isCommentReply(reply)) {
					await vscode.window.showWarningMessage('Use this command from a pull request comment thread.');
					return;
				}
				await this.handleCommentReply(reply);
			}),
			vscode.commands.registerCommand(COMMAND_ID.editPullRequestDiffComment, async (thread?: vscode.CommentThread) => {
				await this.handleEditComment(thread);
			}),
			vscode.commands.registerCommand(COMMAND_ID.resolveDiffComment, async (thread?: vscode.CommentThread) => {
				await this.handleResolveThread(thread);
			}),
			vscode.commands.registerCommand(COMMAND_ID.unresolveDiffComment, async (thread?: vscode.CommentThread) => {
				await this.handleUnresolveThread(thread);
			}),
			vscode.window.onDidChangeVisibleTextEditors(() => {
				void this.updateThreads();
			}),
			vscode.workspace.onDidCloseTextDocument((doc) => {
				this.handleDocumentClosed(doc);
			}),
			this.commentsStore.onDidChange(() => {
				void this.updateThreads();
			}),
		);
	}

	dispose(): void {
		this.disposeAllThreads();
		for (const d of this.disposables) {
			d.dispose();
		}
	}

	private disposeAllThreads(): void {
		for (const thread of this.activeThreads.values()) {
			thread.dispose();
		}
		this.activeThreads.clear();
		this.threadMetadata.clear();
		this.trackedDocs.clear();
	}

	private async provideCommentingRanges(
		document: vscode.TextDocument,
	): Promise<vscode.Range[] | vscode.CommentingRanges | undefined> {
		const parsed = parsePrUri(document.uri);
		if (!parsed || parsed.side !== 'head' || !parsed.path || !parsed.sha) {
			return undefined;
		}

		const currentHeadSha = await this.getCurrentHeadSha(createRepository(parsed.owner, parsed.repo), parsed.pullRequestNumber, true);
		if (!currentHeadSha || parsed.sha !== currentHeadSha) {
			return undefined;
		}

		return createCommentingRanges(document.lineCount);
	}

	private async handleCommentReply(reply: vscode.CommentReply): Promise<void> {
		// Check if this is a reply to an existing discussion thread
		const threadMeta = this.threadMetadata.get(reply.thread);
		if (threadMeta) {
			await this.handleDiscussionReply(reply, threadMeta);
			return;
		}

		// New top-level diff comment
		const parsed = parsePrUri(reply.thread.uri);
		const repository = parsed ? createRepository(parsed.owner, parsed.repo) : undefined;
		const currentHeadSha = repository && parsed
			? await this.getCurrentHeadSha(repository, parsed.pullRequestNumber, true)
			: undefined;
		if (parsed && !currentHeadSha) {
			await vscode.window.showWarningMessage('Unable to verify the current pull request diff snapshot. Refresh the diff and try again.');
			return;
		}

		const errors = validateDiffCommentDraft(reply.thread.uri, reply.thread.range, reply.text, currentHeadSha);
		if (errors.length) {
			await vscode.window.showWarningMessage(errors.join(' '));
			return;
		}

		if (!parsed) {
			await vscode.window.showWarningMessage('Only pull request diff documents support comments.');
			return;
		}

		if (!repository) {
			await vscode.window.showWarningMessage('Only pull request diff documents support comments.');
			return;
		}

		const input = createDiffCommentInput(reply.thread.uri, reply.thread.range, reply.text);
		const previousCanReply = reply.thread.canReply;
		const previousLabel = reply.thread.label;

		reply.thread.canReply = false;
		reply.thread.label = 'Submitting comment...';

		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Submitting pull request comment',
				},
				() => this.commentsStore.submitComment(repository, parsed.pullRequestNumber, input),
			);

			reply.thread.dispose();
		} catch (error) {
			reply.thread.canReply = previousCanReply;
			reply.thread.label = previousLabel;
			const message = error instanceof Error ? error.message : 'Failed to submit pull request comment.';
			this.logger.error(`Failed to submit diff comment for PR #${parsed.pullRequestNumber}: ${message}`);
			await vscode.window.showErrorMessage(message);
		}
	}

	private async handleDiscussionReply(
		reply: vscode.CommentReply,
		meta: { repository: GitCodeRepository; pullRequestNumber: number; discussionId: string; commentId: string },
	): Promise<void> {
		const text = reply.text;
		if (!text.trim()) {
			await vscode.window.showWarningMessage('Reply body is required.');
			return;
		}

		const previousCanReply = reply.thread.canReply;
		const previousLabel = reply.thread.label;

		reply.thread.canReply = false;
		reply.thread.label = 'Submitting reply...';

		try {
			const result = await this.commentsStore.replyToComment(
				meta.repository,
				meta.pullRequestNumber,
				{ discussionId: meta.discussionId, body: text },
			);

			if (result.status === 'failed') {
				reply.thread.canReply = previousCanReply;
				reply.thread.label = previousLabel;
				await vscode.window.showErrorMessage(result.error ?? 'Failed to submit reply.');
				return;
			}

			// On success the store refreshes; update threads to show the new reply
			await this.updateThreads();
		} catch (error) {
			reply.thread.canReply = previousCanReply;
			reply.thread.label = previousLabel;
			const message = error instanceof Error ? error.message : 'Failed to submit reply.';
			this.logger.error(`Failed to reply to discussion ${meta.discussionId} on PR #${meta.pullRequestNumber}: ${message}`);
			await vscode.window.showErrorMessage(message);
		}
	}

	private async handleResolveThread(thread?: vscode.CommentThread): Promise<void> {
		await this.handleThreadStatusChange(thread, true);
	}

	private async handleUnresolveThread(thread?: vscode.CommentThread): Promise<void> {
		await this.handleThreadStatusChange(thread, false);
	}

	private async handleThreadStatusChange(thread: vscode.CommentThread | undefined, resolved: boolean): Promise<void> {
		if (!thread) {
			await vscode.window.showWarningMessage('No comment thread is active.');
			return;
		}

		const metadata = this.threadMetadata.get(thread);
		if (!metadata) {
			await vscode.window.showWarningMessage('Unable to identify the pull request comment thread.');
			return;
		}

		const previousState = thread.state;
		const previousLabel = thread.label;

		thread.state = resolved
			? vscode.CommentThreadState.Resolved
			: vscode.CommentThreadState.Unresolved;
		thread.label = resolved ? 'Resolving...' : 'Reopening...';

		try {
			const result = await this.commentsStore.reviseCommentStatus(
				metadata.repository,
				metadata.pullRequestNumber,
				{ discussionId: metadata.discussionId, resolved },
			);

			if (result.status === 'failed') {
				thread.state = previousState;
				thread.label = previousLabel;
				await vscode.window.showErrorMessage(result.error ?? 'Failed to revise comment status.');
			} else {
				await this.updateThreads();
			}
		} catch (error) {
			thread.state = previousState;
			thread.label = previousLabel;
			const message = error instanceof Error ? error.message : 'Failed to revise comment status.';
			await vscode.window.showErrorMessage(message);
		}
	}

	private async handleEditComment(thread?: vscode.CommentThread): Promise<void> {
		if (!thread) {
			await vscode.window.showWarningMessage('No comment thread is active.');
			return;
		}

		const metadata = this.threadMetadata.get(thread);
		if (!metadata) {
			await vscode.window.showWarningMessage('Unable to identify the pull request comment thread.');
			return;
		}

		// Use the existing comment body as the initial value
		const commentBody = thread.comments.length > 0 ? thread.comments[0].body : '';
		const currentBody = typeof commentBody === 'string' ? commentBody : (commentBody as vscode.MarkdownString).value ?? '';
		const newBody = await vscode.window.showInputBox({
			title: 'Edit Comment',
			value: currentBody,
			prompt: 'Edit your comment body',
			placeHolder: 'Enter the updated comment text',
			validateInput: (value: string) => {
				if (!value.trim()) {
					return 'Comment body is required.';
				}
				return undefined;
			},
		});

		if (newBody === undefined) {
			// User cancelled
			return;
		}

		if (newBody === currentBody) {
			// No change
			return;
		}

		const result = await this.commentsStore.editComment(
			metadata.repository,
			metadata.pullRequestNumber,
			{ commentId: metadata.commentId, body: newBody },
		);

		if (result.status === 'failed') {
			await vscode.window.showErrorMessage(result.error ?? 'Failed to edit comment.');
			return;
		}

		// On success the store refreshes via editComment
		await this.updateThreads();
	}

	private async getCurrentHeadSha(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		forceRefresh = false,
	): Promise<string | undefined> {
		try {
			const snapshot = forceRefresh
				? await this.diffStore.refresh(repository, pullRequestNumber)
				: await this.diffStore.getOrFetch(repository, pullRequestNumber);
			return snapshot.refs.headSha || undefined;
		} catch (error) {
			this.logger.debug(
				`Failed to load diff snapshot for PR #${pullRequestNumber} (${repository.fullName}): ${error instanceof Error ? error.message : String(error)}`,
			);
			return undefined;
		}
	}

	private handleDocumentClosed(doc: vscode.TextDocument): void {
		// Remove threads for this document URI
		const uriStr = doc.uri.toString();
		for (const [key, thread] of this.activeThreads.entries()) {
			if (thread.uri.toString() === uriStr) {
				thread.dispose();
				this.activeThreads.delete(key);
				this.threadMetadata.delete(thread);
			}
		}
		this.trackedDocs.delete(uriStr);
	}

	private async updateThreads(): Promise<void> {
		const parsedEditors: Array<{
			uri: vscode.Uri;
			owner: string;
			repo: string;
			pr: number;
			path: string;
			side: 'base' | 'head';
			sha?: string;
		}> = [];

		// Collect all visible PR diff editors
		for (const editor of vscode.window.visibleTextEditors) {
			const uri = editor.document.uri;
			const uriStr = uri.toString();
			if (uri.scheme !== 'gitcode-pr') {
				continue;
			}

			this.trackedDocs.add(uriStr);

			const parsed = parsePrUri(uri);
			if (parsed && (parsed.side === 'base' || parsed.side === 'head')) {
				parsedEditors.push({
					uri,
					owner: parsed.owner,
					repo: parsed.repo,
					pr: parsed.pullRequestNumber,
					path: parsed.path,
					side: parsed.side,
					sha: parsed.sha,
				});
			}
		}

		// Compute desired threads
		const desiredKeys = new Map<string, { key: CommentThreadKey; uri: vscode.Uri }>();

		for (const editor of parsedEditors) {
			const repoKey = `${editor.owner}/${editor.repo}`;

			let snapshot: PullRequestCommentsSnapshot | undefined;
			try {
				snapshot = await this.commentsStore.getOrFetch(
					{ remoteName: '', owner: editor.owner, name: editor.repo, fullName: repoKey, webUrl: '' },
					editor.pr,
				);
			} catch (error) {
				this.logger.debug(
					`Failed to fetch comments for PR #${editor.pr} (${repoKey}): ${error instanceof Error ? error.message : String(error)}`,
				);
				continue;
			}

			const matching = selectCommentsForDocument(snapshot, editor.path, editor.side, editor.sha);
			for (const comment of matching) {
				const key: CommentThreadKey = {
					repositoryKey: repoKey,
					pullRequestNumber: editor.pr,
					path: editor.path,
					side: editor.side,
					discussionId: comment.discussionId,
				};
				desiredKeys.set(threadKeyToString(key), { key, uri: editor.uri });
			}
		}

		// Build the new set of threads
		const newActive = new Map<string, vscode.CommentThread>();

		for (const [strKey, { key, uri }] of desiredKeys.entries()) {
			const existing = this.activeThreads.get(strKey);
			const repoKey = key.repositoryKey;
			const [owner, repo] = repoKey.split('/');
			if (!owner || !repo) {
				continue;
			}

			try {
				const snapshot = await this.commentsStore.getOrFetch(
					{ remoteName: '', owner, name: repo, fullName: repoKey, webUrl: '' },
					key.pullRequestNumber,
				);

				const comment = snapshot.comments.find(
					(c) => c.kind === 'diff' && c.discussionId === key.discussionId,
				);

				if (comment && comment.kind === 'diff') {
					if (existing) {
						applyCommentThread(existing, comment, comment.body);
						newActive.set(strKey, existing);
						// Update metadata with commentId
						const existingMeta = this.threadMetadata.get(existing);
						if (existingMeta) {
							existingMeta.commentId = comment.id;
						}
					} else {
						const thread = createCommentThread(this.controller, comment, uri, comment.body);
						if (thread) {
							newActive.set(strKey, thread);
							this.threadMetadata.set(thread, {
								repository: { remoteName: '', owner, name: repo, fullName: repoKey, webUrl: '' },
								pullRequestNumber: key.pullRequestNumber,
								discussionId: key.discussionId,
								commentId: comment.id,
							});
						}
					}
				}
			} catch {
				// Comment not bound inline — skip
			}
		}

		// Dispose stale threads
		for (const [strKey, thread] of this.activeThreads.entries()) {
			if (!newActive.has(strKey)) {
				thread.dispose();
				this.threadMetadata.delete(thread);
			}
		}

		this.activeThreads.clear();
		for (const [key, thread] of newActive.entries()) {
			this.activeThreads.set(key, thread);
		}

		// Clean up tracked docs that are no longer open
		for (const uriStr of this.trackedDocs) {
			const found = vscode.window.visibleTextEditors.some((e) => e.document.uri.toString() === uriStr);
			if (!found) {
				this.trackedDocs.delete(uriStr);
			}
		}
	}
}
