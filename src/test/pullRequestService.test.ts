import * as assert from 'assert';
import { GitCodeRepository } from '../common/models';
import { PullRequestService } from '../gitcode/services/pullRequestService';

suite('PullRequestService', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	test('addTesters sends the documented add flag', async () => {
		const requests: Array<{ path: string; body: unknown }> = [];
		const service = new PullRequestService({
			get: async () => undefined as never,
			post: async (path: string, body?: unknown) => {
				requests.push({ path, body });
				return [{ login: 'alice', name: 'Alice' }];
			},
			put: async () => undefined as never,
			patch: async () => undefined as never,
			delete: async () => undefined as never,
		} as any);

		const result = await service.addTesters(repository, 7, [' alice ', 'alice']);

		assert.deepStrictEqual(requests, [
			{
				path: '/api/v5/repos/org/repo/pulls/7/testers',
				body: {
					testers: 'alice',
					add: false,
				},
			},
		]);
		assert.deepStrictEqual(result.map((user) => user.login), ['alice']);
	});

	test('addReviewers sends the documented add flag', async () => {
		const requests: Array<{ path: string; body: unknown }> = [];
		const service = new PullRequestService({
			get: async () => undefined as never,
			post: async (path: string, body?: unknown) => {
				requests.push({ path, body });
				return [{ login: 'carol', name: 'Carol' }];
			},
			put: async () => undefined as never,
			patch: async () => undefined as never,
			delete: async () => undefined as never,
		} as any);

		const result = await service.addReviewers(repository, 7, [' carol ', 'carol']);

		assert.deepStrictEqual(requests, [
			{
				path: '/api/v5/repos/org/repo/pulls/7/reviewers',
				body: {
					reviewers: 'carol',
					add: false,
				},
			},
		]);
		assert.deepStrictEqual(result.map((user) => user.login), ['carol']);
	});

	test('removeAssignees sends assignee logins as query parameters', async () => {
		const requests: Array<{ path: string; body: unknown; query: unknown }> = [];
		const service = new PullRequestService({
			get: async () => undefined as never,
			post: async () => undefined as never,
			put: async () => undefined as never,
			patch: async () => undefined as never,
			delete: async (path: string, body?: unknown, query?: unknown) => {
				requests.push({ path, body, query });
				return undefined as never;
			},
		} as any);

		await service.removeAssignees(repository, 7, [' alice ', 'alice']);

		assert.deepStrictEqual(requests, [
			{
				path: '/api/v5/repos/org/repo/pulls/7/assignees',
				body: undefined,
				query: {
					assignees: 'alice',
				},
			},
		]);
	});
});
