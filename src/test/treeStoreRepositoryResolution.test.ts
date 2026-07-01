import * as assert from 'assert';
import { AuthService } from '../authentication/authService';
import { ExtensionConfiguration } from '../common/configuration';
import { RepositoryResolutionError } from '../common/errors';
import { RepositoryContextService } from '../common/git/repositoryContext';
import { GitCodeRepository } from '../common/models';
import { GitCodeRepositoryResolver } from '../gitcode/resolver/gitcodeRepositoryResolver';
import { IssueService } from '../gitcode/services/issueService';
import { PullRequestService } from '../gitcode/services/pullRequestService';
import { IssueTreeStore } from '../view/state/issueTreeStore';
import { PullRequestTreeStore } from '../view/state/pullRequestTreeStore';

suite('Tree stores repository resolution', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	const authService = {} as AuthService;
	const configuration = {
		getRepositoryOverride: () => undefined,
		getPullRequestPageSize: () => 20,
		getIssuesPageSize: () => 20,
	} as ExtensionConfiguration;
	const overrideConfiguration = {
		...configuration,
		getRepositoryOverride: () => 'org/repo',
	} as ExtensionConfiguration;

	function createReadyRepositoryContext(): RepositoryContextService {
		return {
			waitForRepository: async () => undefined,
		} as unknown as RepositoryContextService;
	}

	test('pull request tree retries after a failed repository resolution', async () => {
		let calls = 0;
		const resolver = {
			resolveAll: async () => {
				calls += 1;
				if (calls === 1) {
					throw new Error('repository not ready');
				}

				return [repository];
			},
		} as GitCodeRepositoryResolver;

		const store = new PullRequestTreeStore(
			authService,
			createReadyRepositoryContext(),
			resolver,
			{} as PullRequestService,
			overrideConfiguration,
		);

		await assert.rejects(() => store.getRepositories(), /repository not ready/);
		assert.deepStrictEqual(await store.getRepositories(), [repository]);
		assert.strictEqual(calls, 2);
	});

	test('issue tree retries after a failed repository resolution', async () => {
		let calls = 0;
		const resolver = {
			resolveAll: async () => {
				calls += 1;
				if (calls === 1) {
					throw new Error('repository not ready');
				}

				return [repository];
			},
		} as GitCodeRepositoryResolver;

		const store = new IssueTreeStore(
			authService,
			createReadyRepositoryContext(),
			resolver,
			{} as IssueService,
			overrideConfiguration,
		);

		await assert.rejects(() => store.getRepositories(), /repository not ready/);
		assert.deepStrictEqual(await store.getRepositories(), [repository]);
		assert.strictEqual(calls, 2);
	});

	test('pull request tree returns loading state and retries transient repository resolution failures', async () => {
		let repositoryReady = false;
		let releaseReadiness: () => void = () => undefined;
		const readiness = new Promise<void>((resolve) => {
			releaseReadiness = () => {
				repositoryReady = true;
				resolve();
			};
		});
		let resolverCalls = 0;
		const repositoryContext = {
			waitForRepository: async () => readiness,
		} as unknown as RepositoryContextService;
		const resolver = {
			resolveAll: async () => {
				resolverCalls += 1;
				if (!repositoryReady) {
					throw new RepositoryResolutionError('repository not ready');
				}

				return [repository];
			},
		} as GitCodeRepositoryResolver;

		const store = new PullRequestTreeStore(
			authService,
			repositoryContext,
			resolver,
			{} as PullRequestService,
			configuration,
		);

		const repositoriesPromise = store.getRepositories();
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.strictEqual(store.isWaitingForRepository(), true);
		assert.strictEqual(resolverCalls, 1);
		const earlyResult = await Promise.race([
			repositoriesPromise.then(() => 'resolved'),
			new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 10)),
		]);
		assert.strictEqual(earlyResult, 'pending');

		releaseReadiness();

		assert.deepStrictEqual(await repositoriesPromise, [repository]);
		assert.strictEqual(store.isWaitingForRepository(), false);
		assert.strictEqual(resolverCalls, 2);
	});
});
