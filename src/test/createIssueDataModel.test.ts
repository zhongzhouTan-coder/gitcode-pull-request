import * as assert from 'assert';
import { CreateIssueInput, GitCodeRepository } from '../common/models';
import { CreateIssueDataModel } from '../view/createIssue/createIssueDataModel';

suite('CreateIssueDataModel', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	function createModel() {
		return new CreateIssueDataModel(
			{
				getRepository: async () => ({
					id: 1,
					fullName: 'org/repo',
					name: 'repo',
					path: 'org/repo',
					defaultBranch: 'main',
					webUrl: 'https://gitcode.com/org/repo',
					fork: false,
					issueTemplateSource: 'project' as const,
				}),
				listLabels: async () => [{ id: 1, name: 'bug', color: '#f00' }],
				listMilestones: async () => [{ number: 7, title: 'Sprint 7', state: 'open' }],
				listMembers: async () => [{ login: 'alice', name: 'Alice' }],
			} as any,
			{
				createIssue: async (_repo: GitCodeRepository, input: CreateIssueInput) => ({
					id: 1,
					number: 2,
					title: input.title,
					state: 'open' as const,
					author: { login: 'alice' },
					assignees: [],
					labels: [],
					comments: 0,
					createdAt: '',
					updatedAt: '',
				}),
			} as any,
			{
				detectTemplates: async () => [{
					label: 'Bug',
					path: '.gitcode/ISSUE_TEMPLATE/bug.md',
					body: '## Bug report',
					source: 'project' as const,
				}],
			} as any,
			{ debug: () => undefined } as any,
		);
	}

	test('initializes repository-backed defaults for the create issue form', async () => {
		const model = createModel();
		const defaults = await model.initialize(repository);

		assert.strictEqual(defaults.repository.fullName, 'org/repo');
		assert.deepStrictEqual(defaults.labels.map((label) => label.name), ['bug']);
		assert.deepStrictEqual(defaults.members.map((member) => member.login), ['alice']);
		assert.strictEqual(defaults.templates[0]?.path, '.gitcode/ISSUE_TEMPLATE/bug.md');
	});

	test('normalizes trimmed deduplicated labels and assignees before submit', () => {
		const model = createModel();
		const normalized = model.normalize({
			title: '  Issue title  ',
			body: 'Body',
			assignees: [' alice ', 'Alice', 'bob', ''],
			labels: [' bug ', 'Bug', 'performance', ''],
			milestoneNumber: 0,
			securityHole: true,
			templatePath: '  .gitcode/ISSUE_TEMPLATE/bug.md  ',
		});

		assert.strictEqual(normalized.title, 'Issue title');
		assert.deepStrictEqual(normalized.assignees, ['alice', 'bob']);
		assert.deepStrictEqual(normalized.labels, ['bug', 'performance']);
		assert.strictEqual(normalized.milestoneNumber, undefined);
		assert.strictEqual(normalized.templatePath, '.gitcode/ISSUE_TEMPLATE/bug.md');
	});

	test('rejects empty title before submit', () => {
		const model = createModel();
		const errors = model.validate({
			title: '   ',
			body: '',
			assignees: [],
			labels: [],
			securityHole: false,
		});

		assert.deepStrictEqual(errors, ['Title is required.']);
	});
});