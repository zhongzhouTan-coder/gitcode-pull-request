import * as assert from 'assert';
import { AuthService } from '../authentication/authService';
import { GitCodeRepository, IssueSummary, PullRequestDetail } from '../common/models';
import { IssueService } from '../gitcode/services/issueService';
import { PullRequestService } from '../gitcode/services/pullRequestService';
import { PullRequestOverviewStore } from '../view/overview/pullRequestOverviewStore';

suite('PullRequestOverviewStore', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	const detail: PullRequestDetail = {
		id: 1,
		number: 2,
		title: 'Title',
		state: 'open',
		body: 'Body',
		htmlUrl: 'https://gitcode.com/org/repo/merge_requests/2',
		isDraft: false,
		createdAt: '2026-06-20T10:00:00+08:00',
		updatedAt: '2026-06-20T10:00:00+08:00',
		author: { login: 'alice' },
		source: { label: 'feature', ref: 'feature' },
		target: { label: 'main', ref: 'main' },
		assignees: [],
		reviewers: [],
		testers: [],
		labels: [],
		mergeability: {
			mergeable: true,
			reasons: [],
		},
	};

	const issue = (number: number): IssueSummary => ({
		id: number,
		number,
		title: `Issue ${number}`,
		state: 'open',
		author: { login: 'alice' },
		assignees: [],
		labels: [],
		comments: 0,
		createdAt: '2026-06-20T10:00:00+08:00',
		updatedAt: '2026-06-20T10:00:00+08:00',
	});

	test('reuses in-flight requests for the same pull request', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			getPullRequest: async () => {
				calls += 1;
				await new Promise((resolve) => setTimeout(resolve, 5));
				return detail;
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);
		const [first, second] = await Promise.all([
			store.getDetail(repository, 2),
			store.getDetail(repository, 2),
		]);

		assert.strictEqual(calls, 1);
		assert.strictEqual(first, detail);
		assert.strictEqual(second, detail);
	});

	test('refresh clears the cache for one pull request', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			getPullRequest: async () => {
				calls += 1;
				return detail;
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);
		await store.getDetail(repository, 2);
		await store.refresh(repository, 2);
		await store.getDetail(repository, 2);

		assert.strictEqual(calls, 2);
	});

	test('getDetail can bypass cached pull request detail', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			getPullRequest: async () => {
				calls += 1;
				return {
					...detail,
					title: calls === 1 ? 'Cached detail' : 'Fresh detail',
				};
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);
		await store.getDetail(repository, 2);
		const refreshed = await store.getDetail(repository, 2, true);

		assert.strictEqual(calls, 2);
		assert.strictEqual(refreshed.title, 'Fresh detail');
	});

	test('edit invalidates cached detail for the pull request', async () => {
		let getCalls = 0;
		let editCalls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			getPullRequest: async () => {
				getCalls += 1;
				return {
					...detail,
					title: getCalls === 1 ? 'Before edit' : 'After edit',
				};
			},
			editPullRequest: async () => {
				editCalls += 1;
				return {
					...detail,
					title: 'After edit',
				};
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);
		await store.getDetail(repository, 2);
		await store.editPullRequest(repository, 2, { title: 'After edit' });
		const refreshed = await store.getDetail(repository, 2);

		assert.strictEqual(editCalls, 1);
		assert.strictEqual(getCalls, 2);
		assert.strictEqual(refreshed.title, 'After edit');
	});

	test('listSelectableReviewers requires authentication', async () => {
		const authService = {
			getSession: async () => null,
		} as unknown as AuthService;
		const pullRequestService = {} as PullRequestService;
		const store = new PullRequestOverviewStore(authService, pullRequestService);

		await assert.rejects(
			() => store.listSelectableReviewers(repository, 2),
			/Sign in to GitCode/,
		);
	});

	test('listSelectableReviewers filters repository collaborators by reviewer role permission', async () => {
		let calls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {} as PullRequestService;
		const repositoryService = {
			listMembers: async () => {
				calls += 1;
				return [
					{ login: 'carol', name: 'Carol', role: { name: 'Maintainer', accessLevel: 40 } },
					{ login: 'dave', name: 'Dave', role: { name: 'Reporter', accessLevel: 20 } },
				];
			},
		};
		const store = new PullRequestOverviewStore(authService, pullRequestService, repositoryService as any);

		const reviewers = await store.listSelectableReviewers(repository, 2);

		assert.strictEqual(calls, 1);
		assert.deepStrictEqual(reviewers.map((reviewer) => reviewer.login), ['carol']);
	});

	test('listSelectableTesters filters repository collaborators by tester role permission', async () => {
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {} as PullRequestService;
		const repositoryService = {
			listMembers: async () => [
				{ login: 'carol', name: 'Carol', role: { name: 'Developer', accessLevel: 30 } },
				{ login: 'dave', name: 'Dave', role: { name: 'Reporter', accessLevel: 20 } },
				{ login: 'erin', name: 'Erin', role: { name: 'Guest', accessLevel: 10 } },
			],
		};
		const store = new PullRequestOverviewStore(authService, pullRequestService, repositoryService as any);

		const testers = await store.listSelectableTesters(repository);

		assert.deepStrictEqual(testers.map((tester) => tester.login), ['carol', 'dave']);
	});

	test('listSelectableAssignees filters repository collaborators by assignee role permission', async () => {
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {} as PullRequestService;
		const repositoryService = {
			listMembers: async () => [
				{ login: 'carol', name: 'Carol', role: { name: 'Maintainer', accessLevel: 40 } },
				{ login: 'dave', name: 'Dave', role: { name: 'Reporter', accessLevel: 20 } },
			],
		};
		const store = new PullRequestOverviewStore(authService, pullRequestService, repositoryService as any);

		const assignees = await store.listSelectableAssignees(repository);

		assert.deepStrictEqual(assignees.map((assignee) => assignee.login), ['carol']);
	});

	test('addReviewers invalidates cached detail for the pull request', async () => {
		let getCalls = 0;
		let addCalls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			getPullRequest: async () => {
				getCalls += 1;
				return {
					...detail,
					reviewers: getCalls === 1 ? [] : [{ login: 'carol', name: 'Carol' }],
				};
			},
			addReviewers: async () => {
				addCalls += 1;
				return [{ login: 'carol', name: 'Carol' }];
			},
		} as unknown as PullRequestService;
		const store = new PullRequestOverviewStore(authService, pullRequestService);

		await store.getDetail(repository, 2);
		await store.addReviewers(repository, 2, ['carol']);
		const refreshed = await store.getDetail(repository, 2);

		assert.strictEqual(addCalls, 1);
		assert.strictEqual(getCalls, 2);
		assert.deepStrictEqual(refreshed.reviewers.map((reviewer) => reviewer.login), ['carol']);
	});

	test('removeReviewers invalidates cached detail for the pull request', async () => {
		let getCalls = 0;
		let removeCalls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			getPullRequest: async () => {
				getCalls += 1;
				return {
					...detail,
					reviewers: getCalls === 1 ? [{ login: 'carol', name: 'Carol' }] : [],
				};
			},
			removeReviewers: async () => {
				removeCalls += 1;
			},
		} as unknown as PullRequestService;
		const store = new PullRequestOverviewStore(authService, pullRequestService);

		await store.getDetail(repository, 2);
		await store.removeReviewers(repository, 2, ['carol']);
		const refreshed = await store.getDetail(repository, 2);

		assert.strictEqual(removeCalls, 1);
		assert.strictEqual(getCalls, 2);
		assert.deepStrictEqual(refreshed.reviewers, []);
	});

	// ---- Add Related Issues ----

	test('addRelatedIssues requires authentication', async () => {
		const authService = {
			getSession: async () => null,
		} as unknown as AuthService;
		const pullRequestService = {} as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);

		await assert.rejects(
			() => store.addRelatedIssues(repository, 2, [339]),
			/Sign in to GitCode/,
		);
	});

	test('addRelatedIssues calls the service and invalidates related issues cache', async () => {
		let addCalls = 0;
		let getRelatedIssuesCalls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			addRelatedIssues: async () => {
				addCalls += 1;
				return [{ id: 1, number: 339, title: 'Issue 339' }];
			},
			listPullRequestRelatedIssues: async () => {
				getRelatedIssuesCalls += 1;
				return [{
					id: 1, number: 339, title: 'Issue 339', state: 'open' as const,
					author: { login: 'alice' }, labels: [], createdAt: '', updatedAt: '',
				}];
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);

		// First get related issues to populate cache
		await store.getRelatedIssues(repository, 2);
		assert.strictEqual(getRelatedIssuesCalls, 1);

		// Add related issue
		const result = await store.addRelatedIssues(repository, 2, [339]);
		assert.strictEqual(addCalls, 1);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].number, 339);

		// Subsequent getRelatedIssues should be a fresh call (cache invalidated)
		await store.getRelatedIssues(repository, 2);
		assert.strictEqual(getRelatedIssuesCalls, 2);
	});

	test('addRelatedIssues allows retry after failure', async () => {
		let addCalls = 0;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {
			addRelatedIssues: async () => {
				addCalls += 1;
				if (addCalls === 1) {
					throw new Error('Network error');
				}
				return [{ id: 1, number: 339, title: 'Issue 339' }];
			},
		} as unknown as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);

		// First call fails
		await assert.rejects(
			() => store.addRelatedIssues(repository, 2, [339]),
			/Network error/,
		);

		// Second call succeeds
		const result = await store.addRelatedIssues(repository, 2, [339]);
		assert.strictEqual(addCalls, 2);
		assert.strictEqual(result[0].number, 339);
	});

	test('listLinkableIssues calls the issue list API with recent open filters', async () => {
		let calls = 0;
		let receivedFilters: unknown;
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {} as PullRequestService;
		const issueService = {
			listIssues: async (_repository: GitCodeRepository, filters: unknown) => {
				calls += 1;
				receivedFilters = filters;
				return [issue(339)];
			},
		} as unknown as IssueService;

		const store = new PullRequestOverviewStore(authService, pullRequestService, undefined, issueService);
		const issues = await store.listLinkableIssues(repository);

		assert.strictEqual(calls, 1);
		assert.deepStrictEqual(issues.map((item) => item.number), [339]);
		assert.deepStrictEqual(receivedFilters, {
			state: 'open',
			sort: 'updated',
			direction: 'desc',
			perPage: 100,
		});
	});

	test('listLinkableIssues returns an empty list when issue service is not wired', async () => {
		const authService = {
			getSession: async () => ({
				accessToken: 'token',
				accountName: 'alice',
				authType: 'pat' as const,
			}),
		} as AuthService;
		const pullRequestService = {} as PullRequestService;

		const store = new PullRequestOverviewStore(authService, pullRequestService);
		assert.deepStrictEqual(await store.listLinkableIssues(repository), []);
	});
});
