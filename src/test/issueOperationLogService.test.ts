import * as assert from 'assert';
import { GitCodeRepository } from '../common/models';
import { GitCodeWriteClient } from '../gitcode/client/gitcodeClient';
import { IssueOperationLogService } from '../gitcode/services/issueOperationLogService';

suite('IssueOperationLogService', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	test('uses documented issue operation-log endpoint and repo query', async () => {
		const calls: Array<{ path: string; query?: Record<string, string | number | boolean | undefined> }> = [];
		const client: GitCodeWriteClient = {
			get: async <T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> => {
				calls.push({ path, query });
				return [] as T;
			},
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
		};
		const service = new IssueOperationLogService(client);

		await service.listIssueOperationLogs(repository, 7);

		assert.deepStrictEqual(calls, [
			{
				path: '/api/v5/repos/org/issues/7/operate_logs',
				query: { repo: 'repo' },
			},
		]);
	});
});
