import * as assert from 'assert';
import { AuthService } from '../authentication/authService';
import { GitCodeRepository, IssueDetail } from '../common/models';
import { IssueService } from '../gitcode/services/issueService';
import { IssueOverviewStore } from '../view/issueOverview/issueOverviewStore';

suite('IssueOverviewStore', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	const detail: IssueDetail = {
		id: 1,
		number: 2,
		title: 'Title',
		state: 'open',
		body: 'Body',
		author: { login: 'alice' },
		assignees: [],
		labels: [],
		comments: 0,
		createdAt: '2026-06-20T10:00:00+08:00',
		updatedAt: '2026-06-20T10:00:00+08:00',
		repository: { fullName: 'org/repo' },
	};

	test('edit invalidates cached detail for the issue', async () => {
		let getCalls = 0;
		let editCalls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const issueService = {
			getIssue: async () => {
				getCalls += 1;
				return {
					...detail,
					title: getCalls === 1 ? 'Before edit' : 'After edit',
				};
			},
			editIssue: async () => {
				editCalls += 1;
				return {
					...detail,
					title: 'After edit',
				};
			},
		} as unknown as IssueService;

		const store = new IssueOverviewStore(authService, issueService);
		await store.getDetail(repository, 2);
		await store.editIssue(repository, 2, { title: 'After edit' });
		const refreshed = await store.getDetail(repository, 2);

		assert.strictEqual(editCalls, 1);
		assert.strictEqual(getCalls, 2);
		assert.strictEqual(refreshed.title, 'After edit');
	});
});