import * as assert from 'assert';
import { CreateIssueInput, GitCodeRepository } from '../common/models';
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
});