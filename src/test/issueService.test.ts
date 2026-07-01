import * as assert from 'assert';
import { CreateIssueInput, EditIssueInput, GitCodeRepository } from '../common/models';
import { IssueService } from '../gitcode/services/issueService';

suite('IssueService', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	test('createIssue sends the documented endpoint and request body', async () => {
		let requestPath = '';
		let requestBody: unknown;
		const service = new IssueService({
			get: async () => undefined as never,
			post: async (path: string, body?: unknown) => {
				requestPath = path;
				requestBody = body;
				return {
					id: 4126451,
					number: '1',
					state: 'open',
					title: 'Issue Title',
					body: 'Issue Description',
					html_url: 'https://gitcode.com/org/repo/issues/1',
					user: { login: 'alice', name: 'Alice' },
					assignees: [{ login: 'alice', name: 'Alice' }],
					labels: [{ id: 1, name: 'bug' }],
					created_at: '2026-06-30T15:56:11+08:00',
					updated_at: '2026-06-30T15:56:11+08:00',
				};
			},
			patch: async () => undefined as never,
		} as any);

		const input: CreateIssueInput = {
			title: 'Issue Title',
			body: 'Issue Description',
			assignees: ['alice', 'bob'],
			milestoneNumber: 7,
			labels: ['bug', 'performance'],
			securityHole: false,
			templatePath: '.gitcode/ISSUE_TEMPLATE/bug.md',
		};

		const result = await service.createIssue(repository, input);

		assert.strictEqual(requestPath, '/api/v5/repos/org/issues');
		assert.deepStrictEqual(requestBody, {
			repo: 'repo',
			title: 'Issue Title',
			body: 'Issue Description',
			assignee: 'alice,bob',
			milestone: 7,
			labels: 'bug,performance',
			security_hole: false,
			template_path: '.gitcode/ISSUE_TEMPLATE/bug.md',
		});
		assert.strictEqual(result.number, 1);
		assert.strictEqual(result.htmlUrl, 'https://gitcode.com/org/repo/issues/1');
	});

	test('listIssues passes assignee and creator filters as query parameters', async () => {
		let requestPath = '';
		let requestQuery: Record<string, unknown> | undefined;
		const service = new IssueService({
			get: async (path: string, query?: Record<string, unknown>) => {
				requestPath = path;
				requestQuery = query;
				return [];
			},
			post: async () => undefined as never,
			patch: async () => undefined as never,
		} as any);

		// My Issues: assignee filter
		await service.listIssues(repository, { state: 'open', assignee: 'alice' });
		assert.strictEqual(requestPath, '/api/v5/repos/org/repo/issues');
		assert.strictEqual(requestQuery?.assignee, 'alice');
		assert.strictEqual(requestQuery?.per_page, 100);
		assert.strictEqual(requestQuery?.page, 1);

		// Created Issues: creator filter
		await service.listIssues(repository, { state: 'open', creator: 'bob' });
		assert.strictEqual(requestQuery?.creator, 'bob');

		// Recent Issues: no user filter
		await service.listIssues(repository, { state: 'open' });
		assert.strictEqual(requestQuery?.assignee, undefined);
		assert.strictEqual(requestQuery?.creator, undefined);

		await service.listIssues(repository, { state: 'open', perPage: 50, page: 3 });
		assert.strictEqual(requestQuery?.per_page, 50);
		assert.strictEqual(requestQuery?.page, 3);
	});

	test('editIssue sends the documented endpoint and request body', async () => {
		let requestPath = '';
		let requestBody: unknown;
		const service = new IssueService({
			get: async () => undefined as never,
			post: async () => undefined as never,
			patch: async (path: string, body?: unknown) => {
				requestPath = path;
				requestBody = body;
				return {
					id: 4126451,
					number: '1',
					state: 'closed',
					title: 'Issue Title',
					body: 'Updated issue description',
					security_hole: true,
					html_url: 'https://gitcode.com/org/repo/issues/1',
					user: { login: 'alice', name: 'Alice' },
					assignees: [{ login: 'alice', name: 'Alice' }],
					labels: [{ id: 1, name: 'bug' }],
					created_at: '2026-06-30T15:56:11+08:00',
					updated_at: '2026-06-30T16:00:00+08:00',
				};
			},
		} as any);

		const input: EditIssueInput = {
			title: 'Issue Title',
			body: 'Updated issue description',
			state: 'close',
			assignees: 'alice,bob',
			milestoneNumber: 7,
			labels: 'bug,performance',
			securityHole: true,
		};

		const result = await service.editIssue(repository, 1, input);

		assert.strictEqual(requestPath, '/api/v5/repos/org/repo/issues/1');
		assert.deepStrictEqual(requestBody, {
			repo: 'repo',
			title: 'Issue Title',
			body: 'Updated issue description',
			state: 'close',
			assignee: 'alice,bob',
			milestone: 7,
			labels: 'bug,performance',
			security_hole: true,
		});
		assert.strictEqual(result.state, 'closed');
		assert.strictEqual(result.securityHole, true);
	});
});
