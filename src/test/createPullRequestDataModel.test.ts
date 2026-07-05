import * as assert from 'assert';
import { GitCodeRepository } from '../common/models';
import { CreatePullRequestDataModel } from '../view/createPullRequest/createPullRequestDataModel';

const repository: GitCodeRepository = {
	remoteName: 'origin',
	owner: 'target',
	name: 'repo',
	fullName: 'target/repo',
	webUrl: 'https://gitcode.com/target/repo',
};

const sourceRepository: GitCodeRepository = {
	remoteName: 'fork',
	owner: 'source',
	name: 'repo',
	fullName: 'source/repo',
	webUrl: 'https://gitcode.com/source/repo',
};

const upstreamRepository: GitCodeRepository = {
	remoteName: 'upstream',
	owner: 'upstream',
	name: 'repo',
	fullName: 'upstream/repo',
	webUrl: 'https://gitcode.com/upstream/repo',
};

function createModel(currentUserLogin?: string): CreatePullRequestDataModel {
	const repositoryService = {
		getRepository: async (_repo: GitCodeRepository) => ({
			id: 1,
			fullName: _repo.fullName,
			name: _repo.name,
			path: _repo.fullName,
			defaultBranch: 'main',
			webUrl: _repo.webUrl,
			fork: false,
		}),
		listBranches: async (_repo: GitCodeRepository) => _repo.fullName === sourceRepository.fullName
			? [
				{ name: 'main', isDefault: true, isProtected: false },
				{ name: 'fork-feature', isDefault: false, isProtected: false },
			]
			: [
				{ name: 'main', isDefault: true, isProtected: false },
				{ name: 'feature', isDefault: false, isProtected: false },
			],
		listLabels: async () => [
			{ id: 1, name: 'bug', color: '#d73a4a' },
			{ id: 2, name: 'feature', color: '#0e8a16' },
		],
		listMilestones: async () => [],
		listMembers: async () => [
			{ login: 'alice', name: 'Alice', role: { name: 'Maintainer', accessLevel: 40 } },
			{ login: 'bob', name: 'Bob', role: { name: 'Developer', accessLevel: 30 } },
			{ login: 'carol', name: 'Carol', role: { name: 'Reporter', accessLevel: 20 } },
			{ login: 'dave', name: 'Dave', role: { name: 'Guest', accessLevel: 10 } },
		],
		compareBranches: async () => ({
			commits: [],
			files: [],
			truncated: false,
		}),
		createBranch: async () => [],
	};
	const pullRequestService = {
		listPullRequests: async () => [],
	};
	return new CreatePullRequestDataModel(
		repositoryService as any,
		pullRequestService as any,
		currentUserLogin,
	);
}

suite('CreatePullRequestDataModel', () => {
	test('initializes with defaults from branch metadata', async () => {
		const model = createModel();
		const defaults = await model.initialize(repository, 'feature');

		assert.strictEqual(defaults.repository.fullName, 'target/repo');
		assert.strictEqual(defaults.sourceBranch, 'feature');
		assert.strictEqual(defaults.targetBranch, 'main');
		assert.ok(defaults.sourceBranches.length > 0);
		assert.ok(defaults.targetBranches.length > 0);
		assert.deepStrictEqual(defaults.labels.map((label) => label.name), ['bug', 'feature']);
		assert.deepStrictEqual(defaults.assigneeMembers.map((member) => member.login), ['alice']);
		assert.deepStrictEqual(defaults.testerMembers.map((member) => member.login), ['alice', 'bob', 'carol']);
	});

	test('includes unpublished active branch but requires publishing before create', async () => {
		const model = createModel();
		await model.initialize(repository, 'local-only');

		assert.ok(model.sourceBranches.some((branch) => branch.name === 'local-only'));
		assert.strictEqual(await model.ensureSourceBranchPublished({
			title: 'Add local work',
			head: 'local-only',
			base: 'main',
		}), false);

		model.markSourceBranchPublished('local-only');

		assert.strictEqual(await model.ensureSourceBranchPublished({
			title: 'Add local work',
			head: 'local-only',
			base: 'main',
		}), true);
	});

	test('changes source repository branch list independently from target repository', async () => {
		const model = createModel();
		await model.initialize([repository, sourceRepository], repository, 'feature');

		await model.setSourceRepository(sourceRepository);

		assert.strictEqual(model.sourceRepository?.fullName, 'source/repo');
		assert.strictEqual(model.targetRepository?.fullName, 'target/repo');
		assert.ok(model.sourceBranches.some((branch) => branch.name === 'fork-feature'));
		assert.ok(model.targetBranches.some((branch) => branch.name === 'feature'));
	});

	test('defaults source repository to origin when target repository is different', async () => {
		const model = createModel();
		const defaults = await model.initialize([repository, upstreamRepository], upstreamRepository, 'feature');

		assert.strictEqual(defaults.sourceRepository.fullName, 'target/repo');
		assert.strictEqual(defaults.targetRepository.fullName, 'upstream/repo');
		assert.strictEqual(model.sourceRepository?.remoteName, 'origin');
		assert.strictEqual(model.targetRepository?.remoteName, 'upstream');
	});

	test('filters loaded repository members for assignee picker queries', async () => {
		const model = createModel();
		await model.initialize(repository, 'feature');

		assert.deepStrictEqual(model.listMembers('ali').map((member) => member.login), ['alice']);
		assert.deepStrictEqual(model.listMembers('bo').map((member) => member.login), []);
	});

	test('excludes the signed-in user from assignee and tester selections', async () => {
		const model = createModel('ALICE');
		const defaults = await model.initialize(repository, 'feature');

		assert.deepStrictEqual(defaults.assigneeMembers.map((member) => member.login), []);
		assert.deepStrictEqual(defaults.testerMembers.map((member) => member.login), ['bob', 'carol']);
		assert.deepStrictEqual(model.assigneeMembers.map((member) => member.login), []);
		assert.deepStrictEqual(model.testerMembers.map((member) => member.login), ['bob', 'carol']);
		assert.deepStrictEqual(model.listMembers().map((member) => member.login), []);
	});

	test('prefills title and body when issue context is provided', async () => {
		const model = createModel();
		const defaults = await model.initialize(repository, 'feature', {
			issueNumber: 309,
			issueTitle: 'Quantization warning for Qwen3.6',
		});

		assert.strictEqual(defaults.title, 'Fix #309: Quantization warning for Qwen3.6');
		assert.ok(defaults.body.includes('Fixes #309'));
		assert.ok(defaults.body.includes('## Summary'));
		assert.ok(defaults.body.includes('## Changes'));
		assert.ok(defaults.body.includes('## Test Plan'));
	});

	test('does not apply issue defaults when issue context is omitted', async () => {
		const model = createModel();
		const defaults = await model.initialize(repository, 'feature');

		assert.strictEqual(defaults.title, 'Feature');
		assert.strictEqual(defaults.body, '');
	});

	test('preserves branch title when issue context is not provided', async () => {
		const model = createModel();
		const defaults = await model.initialize(repository, 'fix-login-issue');

		assert.strictEqual(defaults.title, 'Fix Login Issue');
		assert.strictEqual(defaults.body, '');
	});
});
