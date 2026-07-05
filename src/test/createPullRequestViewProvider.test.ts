import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitCodeRepository } from '../common/models';
import { CreatePullRequestViewProvider } from '../view/createPullRequest/createPullRequestViewProvider';

const repository: GitCodeRepository = {
	remoteName: 'origin',
	owner: 'target',
	name: 'repo',
	fullName: 'target/repo',
	webUrl: 'https://gitcode.com/target/repo',
};

const forkRepository: GitCodeRepository = {
	remoteName: 'origin',
	owner: 'fork',
	name: 'repo',
	fullName: 'fork/repo',
	webUrl: 'https://gitcode.com/fork/repo',
};

function createProvider(): CreatePullRequestViewProvider {
	return new CreatePullRequestViewProvider(
		vscode.Uri.file('/tmp/gitcode-test'),
		{} as any,
		{} as any,
		{ getSession: async () => ({ accountName: 'alice' }) } as any,
		{ onCreateSuccess: () => undefined },
		{} as any,
		{ error: () => undefined } as any,
	);
}

suite('CreatePullRequestViewProvider', () => {
	test('does not create a remote source branch when branch creation is denied', async () => {
		const provider = createProvider() as any;
		let createCalled = false;

		provider.dataModel = {
			repository,
			sourceRepository: repository,
			async createSourceBranch() {
				createCalled = true;
			},
		};
		provider.permissionStore = {
			async get() {
				return {
					has: () => false,
				};
			},
		};
		provider.permissions = {
			canCreatePullRequest: true,
			canCreateBranch: false,
		};

		const result = await provider.promptAndCreateRemoteBranch('main', 'feature');

		assert.strictEqual(result, false);
		assert.strictEqual(createCalled, false);
	});

	test('checks pull request create permission against the source repository on submit', async () => {
		const provider = createProvider() as any;
		let validationCalled = false;
		let checkedRepository: GitCodeRepository | undefined;

		provider.dataModel = {
			repository,
			sourceRepository: forkRepository,
			validate() {
				validationCalled = true;
				return ['stop before create'];
			},
		};
		provider.permissionStore = {
			async get(repo: GitCodeRepository) {
				checkedRepository = repo;
				return {
					has: () => repo.fullName === forkRepository.fullName,
				};
			},
		};

		await provider.handleSubmit({
			title: 'Test',
			head: 'feature',
			base: 'main',
		});

		assert.strictEqual(checkedRepository?.fullName, forkRepository.fullName);
		assert.strictEqual(validationCalled, true);
	});
});
