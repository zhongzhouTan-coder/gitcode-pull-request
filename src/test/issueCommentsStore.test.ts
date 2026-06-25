import * as assert from 'assert';
import { AuthService } from '../authentication/authService';
import { GitCodeRepository } from '../common/models';
import { IssueCommentService } from '../gitcode/services/issueCommentService';
import { IssueCommentsStore } from '../view/issueOverview/issueCommentsStore';

suite('IssueCommentsStore', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	function createAuthService(): AuthService {
		return {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
	}

	test('requires authentication', async () => {
		const authService = {
			getSession: async () => undefined,
		} as AuthService;
		const commentService = {} as IssueCommentService;
		const store = new IssueCommentsStore(authService, commentService);

		await assert.rejects(
			() => store.getComments(repository, 1),
			/Sign in to GitCode first/,
		);
	});

	test('shares concurrent requests for the same issue', async () => {
		let calls = 0;
		const authService = createAuthService();
		const commentService = {
			listIssueComments: async () => {
				calls += 1;
				return [];
			},
		} as unknown as IssueCommentService;

		const store = new IssueCommentsStore(authService, commentService);

		const [a, b] = await Promise.all([
			store.getComments(repository, 42),
			store.getComments(repository, 42),
		]);

		assert.strictEqual(calls, 1);
		assert.strictEqual(a.issueNumber, 42);
		assert.strictEqual(b.issueNumber, 42);
	});

	test('clears failed promises so retry works', async () => {
		let calls = 0;
		const authService = createAuthService();
		const commentService = {
			listIssueComments: async () => {
				calls += 1;
				if (calls === 1) {
					throw new Error('Network error');
				}
				return [{ id: '1', body: 'ok', author: { login: 'user' }, createdAt: '', updatedAt: '' }];
			},
		} as unknown as IssueCommentService;

		const store = new IssueCommentsStore(authService, commentService);

		await assert.rejects(() => store.getComments(repository, 1), /Network error/);
		const snapshot = await store.getComments(repository, 1);

		assert.strictEqual(calls, 2);
		assert.strictEqual(snapshot.comments.length, 1);
	});

	test('refresh invalidates one issue cache', async () => {
		let calls = 0;
		const authService = createAuthService();
		const commentService = {
			listIssueComments: async () => {
				calls += 1;
				return [];
			},
		} as unknown as IssueCommentService;

		const store = new IssueCommentsStore(authService, commentService);

		await store.getComments(repository, 1);
		await store.refresh(repository, 1);
		await store.getComments(repository, 1);

		assert.strictEqual(calls, 2);
	});

	test('clear removes all cached comments', async () => {
		let calls = 0;
		const authService = createAuthService();
		const commentService = {
			listIssueComments: async () => {
				calls += 1;
				return [];
			},
		} as unknown as IssueCommentService;

		const store = new IssueCommentsStore(authService, commentService);

		await store.getComments(repository, 1);
		await store.getComments(repository, 2);
		store.clear();
		await store.getComments(repository, 1);
		await store.getComments(repository, 2);

		// After clear, both should refetch → 4 total calls
		assert.strictEqual(calls, 4);
	});
});
