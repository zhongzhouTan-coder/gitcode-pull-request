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
});
