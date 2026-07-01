import * as assert from 'assert';
import { AuthService } from '../authentication/authService';
import { GitCodeRepository, PullRequestOperationLog } from '../common/models';
import { PullRequestService } from '../gitcode/services/pullRequestService';
import { PullRequestOperationLogsStore } from '../view/overview/pullRequestOperationLogsStore';

suite('PullRequestOperationLogsStore', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	const sampleLog: PullRequestOperationLog = {
		id: '1',
		content: 'reopen from codehub',
		action: 'opened',
		actionType: 'opened',
		actor: { login: 'alice' },
		createdAt: '2026-07-01T00:10:02+08:00',
		updatedAt: '2026-07-01T00:10:02+08:00',
	};

	test('reuses in-flight requests for the same pull request logs', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			listPullRequestOperationLogs: async () => {
				calls += 1;
				await new Promise((resolve) => setTimeout(resolve, 5));
				return [sampleLog];
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOperationLogsStore(authService, pullRequestService);
		const [first, second] = await Promise.all([
			store.getOrFetch(repository, 2),
			store.getOrFetch(repository, 2),
		]);

		assert.strictEqual(calls, 1);
		assert.strictEqual(first.logs[0].id, '1');
		assert.strictEqual(second.logs[0].id, '1');
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
			listPullRequestOperationLogs: async () => {
				calls += 1;
				return [sampleLog];
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOperationLogsStore(authService, pullRequestService);
		await store.getOrFetch(repository, 2);
		await store.refresh(repository.fullName, 2);
		await store.getOrFetch(repository, 2);

		assert.strictEqual(calls, 2);
	});

	test('fires targeted change event on refresh', async () => {
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			listPullRequestOperationLogs: async () => [sampleLog],
		} as unknown as PullRequestService;

		const store = new PullRequestOperationLogsStore(authService, pullRequestService);
		let eventCount = 0;
		store.onDidChange(() => { eventCount += 1; });

		await store.refresh(repository.fullName, 2);
		assert.strictEqual(eventCount, 1);
	});

	test('fires broad change event on clear', () => {
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			listPullRequestOperationLogs: async () => [sampleLog],
		} as unknown as PullRequestService;

		const store = new PullRequestOperationLogsStore(authService, pullRequestService);
		let eventFired = false;
		store.onDidChange(() => { eventFired = true; });

		store.clear();
		assert.strictEqual(eventFired, true);
	});

	test('removes failed request from cache so retry works', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			listPullRequestOperationLogs: async () => {
				calls += 1;
				if (calls === 1) {
					throw new Error('API failure');
				}
				return [sampleLog];
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOperationLogsStore(authService, pullRequestService);

		try {
			await store.getOrFetch(repository, 2);
			assert.fail('Expected first call to fail');
		} catch {
			// Expected
		}

		const result = await store.getOrFetch(repository, 2);
		assert.strictEqual(calls, 2);
		assert.strictEqual(result.logs[0].id, '1');
	});

	test('throws NotSignedInError when no session', async () => {
		const authService = {
			getSession: async () => null,
		} as unknown as AuthService;
		const pullRequestService = {
			listPullRequestOperationLogs: async () => [sampleLog],
		} as unknown as PullRequestService;

		const store = new PullRequestOperationLogsStore(authService, pullRequestService);

		try {
			await store.getOrFetch(repository, 2);
			assert.fail('Expected NotSignedInError');
		} catch (error: any) {
			assert.match(error.message, /Sign in/);
		}
	});

	test('clear removes all cached entries', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			listPullRequestOperationLogs: async () => {
				calls += 1;
				return [sampleLog];
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOperationLogsStore(authService, pullRequestService);
		await store.getOrFetch(repository, 2);
		assert.strictEqual(calls, 1);

		store.clear();
		await store.getOrFetch(repository, 2);
		assert.strictEqual(calls, 2);
	});
});
