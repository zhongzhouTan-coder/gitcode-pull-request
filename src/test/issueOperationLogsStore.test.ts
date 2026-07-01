import * as assert from 'assert';
import { AuthService } from '../authentication/authService';
import { GitCodeRepository, IssueOperationLog } from '../common/models';
import { IssueOperationLogService } from '../gitcode/services/issueOperationLogService';
import { IssueOperationLogsStore } from '../view/issueOverview/issueOperationLogsStore';

suite('IssueOperationLogsStore', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	const sampleLog: IssueOperationLog = {
		id: '1',
		content: 'add label bug',
		actionType: 'label',
		actor: { login: 'alice' },
		createdAt: '2026-07-01T10:10:02+08:00',
		updatedAt: '2026-07-01T10:10:02+08:00',
	};

	test('reuses in-flight requests for the same issue logs', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({ accessToken: 'token', accountName: 'alice', authType: 'pat' as const }),
		} as AuthService;
		const service = {
			listIssueOperationLogs: async () => {
				calls += 1;
				await new Promise((resolve) => setTimeout(resolve, 5));
				return [sampleLog];
			},
		} as unknown as IssueOperationLogService;

		const store = new IssueOperationLogsStore(authService, service);
		const [first, second] = await Promise.all([
			store.getOrFetch(repository, 7),
			store.getOrFetch(repository, 7),
		]);

		assert.strictEqual(calls, 1);
		assert.strictEqual(first.logs[0].id, '1');
		assert.strictEqual(second.logs[0].id, '1');
	});

	test('refresh clears one issue cache and fires a targeted event', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({ accessToken: 'token', accountName: 'alice', authType: 'pat' as const }),
		} as AuthService;
		const service = {
			listIssueOperationLogs: async () => {
				calls += 1;
				return [sampleLog];
			},
		} as unknown as IssueOperationLogService;

		const store = new IssueOperationLogsStore(authService, service);
		let seenEvent: { repositoryKey: string; issueNumber: number } | undefined;
		store.onDidChange((event) => { seenEvent = event; });

		await store.getOrFetch(repository, 7);
		await store.refresh(repository, 7);
		await store.getOrFetch(repository, 7);

		assert.strictEqual(calls, 2);
		assert.deepStrictEqual(seenEvent, { repositoryKey: 'org/repo', issueNumber: 7 });
	});

	test('removes failed requests from cache so retry works', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({ accessToken: 'token', accountName: 'alice', authType: 'pat' as const }),
		} as AuthService;
		const service = {
			listIssueOperationLogs: async () => {
				calls += 1;
				if (calls === 1) {
					throw new Error('boom');
				}
				return [sampleLog];
			},
		} as unknown as IssueOperationLogService;

		const store = new IssueOperationLogsStore(authService, service);

		await assert.rejects(store.getOrFetch(repository, 7), /boom/);
		const result = await store.getOrFetch(repository, 7);

		assert.strictEqual(calls, 2);
		assert.strictEqual(result.logs.length, 1);
	});

	test('requires authentication and clears broadly', async () => {
		const authService = {
			getSession: async () => null,
		} as unknown as AuthService;
		const service = {
			listIssueOperationLogs: async () => [sampleLog],
		} as unknown as IssueOperationLogService;

		const store = new IssueOperationLogsStore(authService, service);
		let eventSeen: { repositoryKey: string; issueNumber: number } | undefined | 'none' = 'none';
		store.onDidChange((event) => { eventSeen = event; });

		await assert.rejects(store.getOrFetch(repository, 7), /Sign in/);
		store.clear();

		assert.strictEqual(eventSeen, undefined);
	});
});