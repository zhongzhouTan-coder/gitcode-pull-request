import * as assert from 'assert';
import { AuthService } from '../authentication/authService';
import { GitCodeRepository } from '../common/models';
import { CommentService } from '../gitcode/services/commentService';
import { PullRequestCommentsStore } from '../view/state/pullRequestCommentsStore';

suite('PullRequestCommentsStore', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	test('clear invalidates all snapshots and notifies consumers', async () => {
		let calls = 0;
		let notifications = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const commentService = {
			listPullRequestComments: async () => {
				calls += 1;
				return [];
			},
		} as unknown as CommentService;

		const store = new PullRequestCommentsStore(authService, commentService);
		store.onDidChange((event) => {
			assert.strictEqual(event, undefined);
			notifications += 1;
		});

		await store.getOrFetch(repository, 2);
		store.clear();
		await store.getOrFetch(repository, 2);

		assert.strictEqual(calls, 2);
		assert.strictEqual(notifications, 1);
		store.dispose();
	});

	test('submitComment creates the comment and refreshes the snapshot', async () => {
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const calls: string[] = [];
		const commentService = {
			createPullRequestComment: async () => {
				calls.push('create');
				return { id: 'comment-1', body: 'Hello' };
			},
		} as unknown as CommentService;

		const store = new PullRequestCommentsStore(authService, commentService);
		let changeEventRepository = '';
		store.onDidChange((event) => {
			if (event) {
				changeEventRepository = event.repositoryKey;
			}
		});

		const result = await store.submitComment(repository, 7, {
			kind: 'pullRequest',
			body: 'Hello',
		});

		assert.deepStrictEqual(result, { id: 'comment-1', body: 'Hello' });
		assert.deepStrictEqual(calls, ['create']);
		assert.strictEqual(changeEventRepository, 'org/repo');
		store.dispose();
	});

	test('editComment returns success on successful API call and refreshes', async () => {
		let editCalled = false;
		let refreshCalled = false;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const commentService = {
			editPullRequestComment: async () => {
				editCalled = true;
			},
			listPullRequestComments: async () => [],
		} as unknown as CommentService;

		const store = new PullRequestCommentsStore(authService, commentService);
		store.onDidChange((event) => {
			if (event) {
				refreshCalled = true;
			}
		});

		const result = await store.editComment(repository, 7, {
			commentId: 'comment-42',
			body: 'Updated body.',
		});

		assert.strictEqual(editCalled, true);
		assert.strictEqual(refreshCalled, true);
		assert.strictEqual(result.status, 'pending');
		assert.strictEqual(result.commentId, 'comment-42');
		store.dispose();
	});

	test('editComment returns failed when not signed in', async () => {
		const authService = {
			getSession: async () => null,
		} as unknown as AuthService;
		const commentService = {} as unknown as CommentService;

		const store = new PullRequestCommentsStore(authService, commentService);

		const result = await store.editComment(repository, 7, {
			commentId: 'comment-42',
			body: 'Updated body.',
		});

		assert.strictEqual(result.status, 'failed');
		assert.ok(result.error?.includes('Sign in'));
		store.dispose();
	});

	test('editComment returns failed when body is empty', async () => {
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
	} as unknown as AuthService;
		const commentService = {} as unknown as CommentService;

		const store = new PullRequestCommentsStore(authService, commentService);

		const result = await store.editComment(repository, 7, {
			commentId: 'comment-42',
			body: '   ',
		});

		assert.strictEqual(result.status, 'failed');
		assert.ok(result.error?.includes('required'));
		store.dispose();
	});

	test('editComment returns failed when API throws', async () => {
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const commentService = {
			editPullRequestComment: async () => {
				throw new Error('API error');
			},
		} as unknown as CommentService;

		const store = new PullRequestCommentsStore(authService, commentService);

		const result = await store.editComment(repository, 7, {
			commentId: 'comment-42',
			body: 'Updated body.',
		});

		assert.strictEqual(result.status, 'failed');
		assert.strictEqual(result.error, 'API error');
		store.dispose();
	});

	test('editComment serializes concurrent edits for the same commentId', async () => {
		let resolveEdit: (() => void) | undefined;
		let editCalls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const commentService = {
			editPullRequestComment: async () => {
				editCalls += 1;
				await new Promise<void>((resolve) => {
					resolveEdit = resolve;
				});
			},
			listPullRequestComments: async () => [],
		} as unknown as CommentService;

		const store = new PullRequestCommentsStore(authService, commentService);

		// Start first edit
		const edit1Promise = store.editComment(repository, 7, {
			commentId: 'comment-42',
			body: 'First edit.',
		});

		// Start second edit for the same commentId while first is pending
		const edit2Promise = store.editComment(repository, 7, {
			commentId: 'comment-42',
			body: 'Second edit.',
		});

		await new Promise<void>((resolve) => setImmediate(resolve));
		assert.strictEqual(editCalls, 1);

		// Resolve
		if (resolveEdit) {
			resolveEdit();
		}

		const [result1, result2] = await Promise.all([edit1Promise, edit2Promise]);
		assert.strictEqual(editCalls, 1);
		assert.deepStrictEqual(result1, result2);
		assert.strictEqual(result1.status, 'pending');
		store.dispose();
	});
});
