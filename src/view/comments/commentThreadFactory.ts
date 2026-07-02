import * as vscode from 'vscode';
import { PullRequestCommentsSnapshot, PullRequestDiffComment } from '../../common/models';

/**
 * Converts domain PullRequestDiffComment threads into VS Code comment types
 * for display in native diff editors via the provided CommentController.
 *
 * Comments are read-only. The parent comment and replies are rendered as
 * a single vscode.CommentThread.
 */
export function createCommentThread(
	controller: vscode.CommentController,
	comment: PullRequestDiffComment,
	documentUri: vscode.Uri,
	parentBody: string,
): vscode.CommentThread | undefined {
	const range = createRange(comment);
	if (!range) {
		return undefined;
	}

	const thread = controller.createCommentThread(documentUri, range, []);
	applyCommentThread(thread, comment, parentBody);

	return thread;
}

export function applyCommentThread(
	thread: vscode.CommentThread,
	comment: PullRequestDiffComment,
	parentBody: string,
): void {
	const range = createRange(comment);
	if (range) {
		thread.range = range;
	}

	const parentComment: vscode.Comment = {
		body: createMarkdownString(parentBody),
		author: createAuthor(comment.author),
		timestamp: new Date(comment.createdAt),
		mode: vscode.CommentMode.Preview,
		contextValue: comment.resolved ? 'commentThread.resolved' : 'commentThread.unresolved',
		label: createCommentLabel(comment),
	};

	const replies: vscode.Comment[] = comment.replies.map((reply) => ({
		body: createMarkdownString(reply.body),
		author: createAuthor(reply.author),
		timestamp: new Date(reply.createdAt),
		mode: vscode.CommentMode.Preview,
	}));

	thread.comments = [parentComment, ...replies];
	thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
	thread.state = comment.resolved
		? vscode.CommentThreadState.Resolved
		: vscode.CommentThreadState.Unresolved;
	thread.canReply = true;
	thread.label = undefined;
	thread.contextValue = comment.resolved ? 'gitcode.diffComment.resolved' : 'gitcode.diffComment.unresolved';
}

function createRange(comment: PullRequestDiffComment): vscode.Range | undefined {
	// API lines are one-based; VS Code uses zero-based
	const startLine = comment.location.startLine - 1;
	const endLine = comment.location.endLine - 1;

	if (startLine < 0 || endLine < 0) {
		return undefined;
	}

	// Clamp to valid range
	const safeStart = Math.min(startLine, endLine);
	const safeEnd = Math.max(startLine, endLine);

	return new vscode.Range(safeStart, 0, safeEnd, Number.MAX_SAFE_INTEGER);
}

function createAuthor(author: { login: string; name?: string; avatarUrl?: string }): vscode.CommentAuthorInformation {
	const result: vscode.CommentAuthorInformation = {
		name: author.name ?? author.login,
	};

	if (author.avatarUrl) {
		try {
			const iconUri = vscode.Uri.parse(author.avatarUrl);
			if (iconUri.scheme === 'https') {
				result.iconPath = iconUri;
			}
		} catch {
			// Invalid URL — use initials only
		}
	}

	return result;
}

function createMarkdownString(body: string): vscode.MarkdownString {
	const md = new vscode.MarkdownString(body);
	md.isTrusted = false;
	md.supportHtml = false;
	return md;
}

function createCommentLabel(comment: PullRequestDiffComment): string | undefined {
	if (comment.resolved) {
		return 'Resolved';
	}
	if (comment.isOutdated) {
		return 'Outdated';
	}
	return 'Unresolved';
}

/**
 * Extract locatable diff comments from a snapshot for a given file path and side.
 * Only returns comments with a matching path, non-outdated, and on the correct side.
 */
export function selectCommentsForDocument(
	snapshot: PullRequestCommentsSnapshot,
	filePath: string,
	side: 'base' | 'head',
	headSha?: string,
): PullRequestDiffComment[] {
	return snapshot.comments
		.filter((c): c is PullRequestDiffComment => {
			if (c.kind !== 'diff') {
				return false;
			}
			if (c.isOutdated) {
				return false;
			}
			const loc = c.location;
			if (!loc.path || loc.side !== side) {
				return false;
			}
			// Match file path (supports exact match or suffix match)
			if (loc.path !== filePath) {
				return false;
			}
			// If head SHA is provided, verify the comment matches it
			if (headSha && loc.headSha && loc.headSha !== headSha) {
				return false;
			}
			return true;
		});
}
