import * as assert from 'assert';
import { AuthService } from '../authentication/authService';
import { GitCodeRepository, PullRequestDetail } from '../common/models';
import { PullRequestService } from '../gitcode/services/pullRequestService';
import { PullRequestOverviewStore } from '../view/overview/pullRequestOverviewStore';

suite('PullRequestOverviewStore', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	const detail: PullRequestDetail = {
		id: 1,
		number: 2,
		title: 'Title',
		state: 'open',
		body: 'Body',
		htmlUrl: 'https://gitcode.com/org/repo/merge_requests/2',
		isDraft: false,
		createdAt: '2026-06-20T10:00:00+08:00',
		updatedAt: '2026-06-20T10:00:00+08:00',
		author: { login: 'alice' },
		source: { label: 'feature', ref: 'feature' },
		target: { label: 'main', ref: 'main' },
		assignees: [],
		reviewers: [],
		testers: [],
		labels: [],
		mergeability: {
			mergeable: true,
			reasons: [],
		},
	};

	test('reuses in-flight requests for the same pull request', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			getPullRequest: async () => {
				calls += 1;
				await new Promise((resolve) => setTimeout(resolve, 5));
				return detail;
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);
		const [first, second] = await Promise.all([
			store.getDetail(repository, 2),
			store.getDetail(repository, 2),
		]);

		assert.strictEqual(calls, 1);
		assert.strictEqual(first, detail);
		assert.strictEqual(second, detail);
	});

	test('refresh clears the cache for one pull request', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			getPullRequest: async () => {
				calls += 1;
				return detail;
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);
		await store.getDetail(repository, 2);
		await store.refresh(repository, 2);
		await store.getDetail(repository, 2);

		assert.strictEqual(calls, 2);
	});

	test('edit invalidates cached detail for the pull request', async () => {
		let getCalls = 0;
		let editCalls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			getPullRequest: async () => {
				getCalls += 1;
				return {
					...detail,
					title: getCalls === 1 ? 'Before edit' : 'After edit',
				};
			},
			editPullRequest: async () => {
				editCalls += 1;
				return {
					...detail,
					title: 'After edit',
				};
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);
		await store.getDetail(repository, 2);
		await store.editPullRequest(repository, 2, { title: 'After edit' });
		const refreshed = await store.getDetail(repository, 2);

		assert.strictEqual(editCalls, 1);
		assert.strictEqual(getCalls, 2);
		assert.strictEqual(refreshed.title, 'After edit');
	});
});
