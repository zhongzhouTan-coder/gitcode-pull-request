import * as assert from 'assert';
import { GitCodeRepository, PullRequestCommentsSnapshot } from '../common/models';
import { Logger } from '../common/logger';
import { CommentService } from '../gitcode/services/commentService';
import { PullRequestCommentsStore } from '../view/state/pullRequestCommentsStore';
import { AuthService } from '../authentication/authService';

suite('CommentService — revisePullRequestCommentStatus', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	test('sends PUT to correct URL with resolved true', async () => {
		const calls: Array<{ path: string; body: unknown }> = [];
		const client = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(path: string, body?: unknown): Promise<T> => {
				calls.push({ path, body });
				return {} as T;
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
		};
		const logger = { debug: () => undefined, error: () => undefined } as unknown as Logger;
		const service = new CommentService(client, logger);

		await service.revisePullRequestCommentStatus(repository, 5, {
			discussionId: 'abc123',
			resolved: true,
		});

		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].path, '/api/v5/repos/org/repo/pulls/5/comments/abc123');
		assert.deepStrictEqual(calls[0].body, { resolved: true });
	});

	test('sends PUT with resolved false when marking unresolved', async () => {
		const calls: Array<{ body: unknown }> = [];
		const client = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(_path: string, body?: unknown): Promise<T> => {
				calls.push({ body });
				return {} as T;
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
		};
		const logger = { debug: () => undefined, error: () => undefined } as unknown as Logger;
		const service = new CommentService(client, logger);

		await service.revisePullRequestCommentStatus(repository, 5, {
			discussionId: 'xyz789',
			resolved: false,
		});

		assert.strictEqual(calls.length, 1);
		assert.deepStrictEqual(calls[0].body, { resolved: false });
	});

	test('rejects empty discussionId', async () => {
		const client = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Should not be called');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
		};
		const logger = { debug: () => undefined, error: () => undefined } as unknown as Logger;
		const service = new CommentService(client, logger);

		await assert.rejects(
			() => service.revisePullRequestCommentStatus(repository, 5, {
				discussionId: '',
				resolved: true,
			}),
			/discussionId is required\./,
		);
	});
});

suite('PullRequestCommentsStore — reviseCommentStatus', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	function createMockAuth(): AuthService {
		return {
			getSession: async () => ({ accessToken: 'token', scopes: [], account: { id: 'u1', label: 'user' } }),
			onDidChangeSessions: () => ({ dispose: () => undefined }),
		} as unknown as AuthService;
	}

	test('rejects status change for PR-level comments', async () => {
		const fullComments: PullRequestCommentsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 1,
			comments: [{
				kind: 'pullRequest',
				id: 'c1',
				discussionId: 'disc-1',
				body: 'Nice work',
				author: { id: 'u1', login: 'alice' },
				createdAt: '2026-01-01T00:00:00Z',
				updatedAt: '2026-01-01T00:00:00Z',
				replies: [],
			}],
			loadedAt: Date.now(),
		};

		const commentService = {
			listPullRequestComments: async () => fullComments.comments,
			createPullRequestComment: async () => { throw new Error('Not implemented'); },
			revisePullRequestCommentStatus: async () => { throw new Error('Should not be called'); },
		} as unknown as CommentService;

		const auth = createMockAuth();
		const store = new PullRequestCommentsStore(auth, commentService);

		const result = await store.reviseCommentStatus(repository, 1, {
			discussionId: 'disc-1',
			resolved: true,
		});

		assert.strictEqual(result.status, 'failed');
		assert.ok(result.error?.includes('Only diff comments'));
	});

	test('ignores duplicate pending requests for the same discussionId', async () => {
		let resolvePromise!: () => void;
		const blockingPromise = new Promise<void>((resolve) => { resolvePromise = resolve; });

		let callCount = 0;
		const commentService = {
			listPullRequestComments: async () => [{
				kind: 'diff',
				id: 'c2',
				discussionId: 'disc-2',
				body: 'Body',
				author: { id: 'u1', login: 'alice' },
				createdAt: '2026-01-01T00:00:00Z',
				updatedAt: '2026-01-01T00:00:00Z',
				replies: [],
				resolved: false,
				isOutdated: false,
				location: {
					path: 'src/a.ts',
					side: 'head' as const,
					startLine: 1,
					endLine: 1,
					positionType: 'text',
				},
			}],
			createPullRequestComment: async () => { throw new Error('Not implemented'); },
			revisePullRequestCommentStatus: async () => {
				callCount++;
				await blockingPromise;
			},
		} as unknown as CommentService;

		const auth = createMockAuth();
		const store = new PullRequestCommentsStore(auth, commentService);

		// Start the first operation (does not await)
		const firstOp = store.reviseCommentStatus(repository, 1, {
			discussionId: 'disc-2',
			resolved: true,
		});

		// Second call with same discussionId should return the same promise
		const secondOp = store.reviseCommentStatus(repository, 1, {
			discussionId: 'disc-2',
			resolved: true,
		});

		// Both should be the same pending promise
		assert.strictEqual(firstOp, secondOp);

		// Resolve the blocking promise
		resolvePromise();

		await firstOp;
		await secondOp;
		assert.strictEqual(callCount, 1);
	});

	test('refreshes comments after a successful mutation', async () => {
		let refreshed = false;
		const commentService = {
			listPullRequestComments: async () => [{
				kind: 'diff',
				id: 'c3',
				discussionId: 'disc-3',
				body: 'Body',
				author: { id: 'u1', login: 'alice' },
				createdAt: '2026-01-01T00:00:00Z',
				updatedAt: '2026-01-01T00:00:00Z',
				replies: [],
				resolved: false,
				isOutdated: false,
				location: {
					path: 'src/b.ts',
					side: 'head' as const,
					startLine: 5,
					endLine: 5,
					positionType: 'text',
				},
			}],
			createPullRequestComment: async () => { throw new Error('Not implemented'); },
			revisePullRequestCommentStatus: async () => {
				// Succeeds
			},
		} as unknown as CommentService;

		const auth = createMockAuth();
		const store = new PullRequestCommentsStore(auth, commentService);

		store.onDidChange(() => { refreshed = true; });

		await store.reviseCommentStatus(repository, 1, {
			discussionId: 'disc-3',
			resolved: true,
		});

		assert.ok(refreshed);
	});

	test('returns failed status when the API returns an error', async () => {
		const commentService = {
			listPullRequestComments: async () => [{
				kind: 'diff',
				id: 'c4',
				discussionId: 'disc-4',
				body: 'Body',
				author: { id: 'u1', login: 'alice' },
				createdAt: '2026-01-01T00:00:00Z',
				updatedAt: '2026-01-01T00:00:00Z',
				replies: [],
				resolved: false,
				isOutdated: false,
				location: {
					path: 'src/c.ts',
					side: 'head' as const,
					startLine: 10,
					endLine: 10,
					positionType: 'text',
				},
			}],
			createPullRequestComment: async () => { throw new Error('Not implemented'); },
			revisePullRequestCommentStatus: async () => {
				throw new Error('Forbidden');
			},
		} as unknown as CommentService;

		const auth = createMockAuth();
		const store = new PullRequestCommentsStore(auth, commentService);

		const result = await store.reviseCommentStatus(repository, 1, {
			discussionId: 'disc-4',
			resolved: true,
		});

		assert.strictEqual(result.status, 'failed');
		assert.strictEqual(result.error, 'Forbidden');
	});

	test('returns failed when comment is already in the requested state', async () => {
		let called = false;
		const commentService = {
			listPullRequestComments: async () => [{
				kind: 'diff',
				id: 'c5',
				discussionId: 'disc-5',
				body: 'Body',
				author: { id: 'u1', login: 'alice' },
				createdAt: '2026-01-01T00:00:00Z',
				updatedAt: '2026-01-01T00:00:00Z',
				replies: [],
				resolved: true,
				isOutdated: false,
				location: {
					path: 'src/d.ts',
					side: 'head' as const,
					startLine: 1,
					endLine: 1,
					positionType: 'text',
				},
			}],
			createPullRequestComment: async () => { throw new Error('Not implemented'); },
			revisePullRequestCommentStatus: async () => { called = true; },
		} as unknown as CommentService;

		const auth = createMockAuth();
		const store = new PullRequestCommentsStore(auth, commentService);

		const result = await store.reviseCommentStatus(repository, 1, {
			discussionId: 'disc-5',
			resolved: true,
		});

		assert.strictEqual(result.status, 'failed');
		assert.ok(result.error?.includes('already'));
		assert.strictEqual(called, false);
	});

	test('returns failed when comment is not found', async () => {
		const commentService = {
			listPullRequestComments: async () => [{
				kind: 'diff',
				id: 'c6',
				discussionId: 'disc-6',
				body: 'Body',
				author: { id: 'u1', login: 'alice' },
				createdAt: '2026-01-01T00:00:00Z',
				updatedAt: '2026-01-01T00:00:00Z',
				replies: [],
				resolved: false,
				isOutdated: false,
				location: {
					path: 'src/e.ts',
					side: 'head' as const,
					startLine: 1,
					endLine: 1,
					positionType: 'text',
				},
			}],
			createPullRequestComment: async () => { throw new Error('Not implemented'); },
			revisePullRequestCommentStatus: async () => { throw new Error('Should not be called'); },
		} as unknown as CommentService;

		const auth = createMockAuth();
		const store = new PullRequestCommentsStore(auth, commentService);

		const result = await store.reviseCommentStatus(repository, 1, {
			discussionId: 'nonexistent',
			resolved: true,
		});

		assert.strictEqual(result.status, 'failed');
		assert.strictEqual(result.error, 'Comment not found.');
	});
});
