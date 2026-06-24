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
});
