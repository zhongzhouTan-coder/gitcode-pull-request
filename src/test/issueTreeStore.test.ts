import * as assert from 'assert';
import { GitCodeRepository } from '../common/models';
import { IssueTreeStore } from '../view/state/issueTreeStore';

suite('IssueTreeStore', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	test('getCategories returns My Issues, Created Issues, and Recent Issues', () => {
		const store = createStore();
		const categories = store.getCategories(repository);

		assert.strictEqual(categories.length, 3);

		const myIssues = categories.find((c) => c.key === 'myIssues');
		assert.ok(myIssues, 'myIssues category should exist');
		assert.strictEqual(myIssues!.label, 'My Issues');
		assert.strictEqual(myIssues!.repository, repository);

		const createdIssues = categories.find((c) => c.key === 'createdIssues');
		assert.ok(createdIssues, 'createdIssues category should exist');
		assert.strictEqual(createdIssues!.label, 'Created Issues');
		assert.strictEqual(createdIssues!.repository, repository);

		const recentIssues = categories.find((c) => c.key === 'recentIssues');
		assert.ok(recentIssues, 'recentIssues category should exist');
		assert.strictEqual(recentIssues!.label, 'Recent Issues');
		assert.strictEqual(recentIssues!.repository, repository);
	});

	test('getIssues with myIssues category passes assignee filter', async () => {
		let capturedQuery: Record<string, unknown> | undefined;
		const store = createStore({
			onListIssues: async (_repo, filters) => {
				capturedQuery = { ...filters };
				return [];
			},
			sessionAccountName: 'testuser',
		});

		await assert.doesNotReject(() => store.getIssues(repository, 'myIssues'));
		assert.strictEqual(capturedQuery?.assignee, 'testuser');
	});

	test('getIssues with createdIssues category passes creator filter', async () => {
		let capturedQuery: Record<string, unknown> | undefined;
		const store = createStore({
			onListIssues: async (_repo, filters) => {
				capturedQuery = { ...filters };
				return [];
			},
			sessionAccountName: 'testuser',
		});

		await assert.doesNotReject(() => store.getIssues(repository, 'createdIssues'));
		assert.strictEqual(capturedQuery?.creator, 'testuser');
	});

	test('getIssues with recentIssues category passes no user filter', async () => {
		let capturedQuery: Record<string, unknown> | undefined;
		const store = createStore({
			onListIssues: async (_repo, filters) => {
				capturedQuery = { ...filters };
				return [];
			},
			sessionAccountName: 'testuser',
		});

		await assert.doesNotReject(() => store.getIssues(repository, 'recentIssues'));
		assert.strictEqual(capturedQuery?.assignee, undefined);
		assert.strictEqual(capturedQuery?.creator, undefined);
	});
});

function createStore(options?: {
	onListIssues?: (repo: GitCodeRepository, filters: any) => Promise<any[]>;
	sessionAccountName?: string;
}): IssueTreeStore {
	const sessionAccountName = options?.sessionAccountName ?? 'defaultuser';

	const authService = {
		getSession: async () => ({
			accessToken: 'token',
			accountName: sessionAccountName,
			authType: 'pat' as const,
		}),
	} as any;

	const repositoryContext = {} as any;

	const repositoryResolver = {} as any;

	const issueService = {
		listIssues: options?.onListIssues ?? (async () => []),
	} as any;

	const configuration = {
		getIssuesPageSize: () => 20,
	} as any;

	return new IssueTreeStore(
		authService,
		repositoryContext,
		repositoryResolver,
		issueService,
		configuration,
	);
}
