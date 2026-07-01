import * as assert from 'assert';
import * as vscode from 'vscode';
import { PullRequestCommentsSnapshot, PullRequestDiffComment } from '../common/models';
import { createCommentThread, selectCommentsForDocument } from '../view/comments/commentThreadFactory';

suite('CommentThreadFactory', () => {
	function createDiffComment(overrides: Partial<PullRequestDiffComment> = {}): PullRequestDiffComment {
		return {
			kind: 'diff',
			id: 'comment-1',
			discussionId: 'discussion-1',
			body: 'Thread body',
			author: {
				id: 'user-1',
				login: 'alice',
			},
			createdAt: '2026-06-30T10:00:00Z',
			updatedAt: '2026-06-30T10:00:00Z',
			replies: [],
			resolved: false,
			isOutdated: false,
			location: {
				path: 'src/example.ts',
				side: 'head',
				startLine: 24,
				endLine: 24,
				positionType: 'text',
			},
			...overrides,
		};
	}

	test('creates resolved VS Code threads for resolved diff comments', () => {
		const created: {
			uri: vscode.Uri;
			range: vscode.Range;
			comments: readonly vscode.Comment[];
		}[] = [];
		const thread = {
			collapsibleState: undefined,
			state: undefined,
			canReply: true,
			comments: [] as readonly vscode.Comment[],
		};
		const controller = {
			createCommentThread(uri: vscode.Uri, range: vscode.Range, comments: readonly vscode.Comment[]) {
				created.push({ uri, range, comments });
				return thread as unknown as vscode.CommentThread;
			},
		} as unknown as vscode.CommentController;

		const result = createCommentThread(
			controller,
			createDiffComment({ resolved: true }),
			vscode.Uri.file('/workspace/src/example.ts'),
			'Thread body',
		);

		assert.ok(result);
		assert.strictEqual(created.length, 1);
		assert.strictEqual(thread.state, vscode.CommentThreadState.Resolved);
		assert.strictEqual(thread.canReply, false);
		assert.strictEqual(thread.comments[0].contextValue, 'commentThread.resolved');
		assert.strictEqual(thread.comments[0].label, 'Resolved');
		assert.strictEqual(created[0].range.start.line, 23);
	});

	test('creates unresolved VS Code threads for open diff comments', () => {
		const thread = {
			collapsibleState: undefined,
			state: undefined,
			canReply: true,
			comments: [] as readonly vscode.Comment[],
		};
		const controller = {
			createCommentThread(_uri: vscode.Uri, _range: vscode.Range, _comments: readonly vscode.Comment[]) {
				return thread as unknown as vscode.CommentThread;
			},
		} as unknown as vscode.CommentController;

		createCommentThread(
			controller,
			createDiffComment(),
			vscode.Uri.file('/workspace/src/example.ts'),
			'Thread body',
		);

		assert.strictEqual(thread.state, vscode.CommentThreadState.Unresolved);
		assert.strictEqual(thread.comments[0].contextValue, 'commentThread.unresolved');
		assert.strictEqual(thread.comments[0].label, 'Unresolved');
	});

	test('preserves outdated labels when an outdated thread is projected directly', () => {
		const thread = {
			collapsibleState: undefined,
			state: undefined,
			canReply: true,
			comments: [] as readonly vscode.Comment[],
		};
		const controller = {
			createCommentThread(_uri: vscode.Uri, _range: vscode.Range, _comments: readonly vscode.Comment[]) {
				return thread as unknown as vscode.CommentThread;
			},
		} as unknown as vscode.CommentController;

		createCommentThread(
			controller,
			createDiffComment({ isOutdated: true }),
			vscode.Uri.file('/workspace/src/example.ts'),
			'Thread body',
		);

		assert.strictEqual(thread.comments[0].label, 'Outdated');
	});

	test('skips outdated comments when selecting comments for a document', () => {
		const snapshot: PullRequestCommentsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 7,
			loadedAt: Date.now(),
			comments: [
				createDiffComment({ id: 'resolved-open', resolved: true }),
				createDiffComment({ id: 'outdated', isOutdated: true }),
			],
		};

		const selected = selectCommentsForDocument(snapshot, 'src/example.ts', 'head');

		assert.deepStrictEqual(selected.map((comment) => comment.id), ['resolved-open']);
	});
});
