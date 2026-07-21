import * as assert from 'assert';
import { EditIssueOptions, GitCodeRepository, IssueCommentsSnapshot, IssueDetail } from '../common/models';
import { IssueOverviewPanel, isTrustedGitCodeUrl, resolveRelatedPullRequestRepository, validateIssueSectionInput, validateIssueStateChange } from '../view/issueOverview/issueOverviewPanel';

suite('IssueOverviewPanel', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'issue-org',
		name: 'issue-repo',
		fullName: 'issue-org/issue-repo',
		webUrl: 'https://gitcode.com/issue-org/issue-repo',
	};

	const detail: IssueDetail = {
		id: 1,
		number: 9,
		title: 'Issue title',
		state: 'open',
		body: 'Issue body',
		author: { login: 'alice' },
		assignees: [{ login: 'alice' }],
		labels: [{ id: 1, name: 'bug' }],
		comments: 0,
		createdAt: '2026-06-30T10:00:00+08:00',
		updatedAt: '2026-06-30T10:00:00+08:00',
		repository: { fullName: 'issue-org/issue-repo' },
		milestone: { number: 2, title: 'Sprint 2' },
		securityHole: true,
	};

	const editOptions: EditIssueOptions = {
		assignees: [{ login: 'alice' }, { login: 'bob' }],
		labels: [{ id: 1, name: 'bug' }, { id: 2, name: 'docs' }],
		milestones: [{ number: 2, title: 'Sprint 2' }, { number: 3, title: 'Sprint 3' }],
	};

	test('accepts HTTP(S) URLs from the configured GitCode origin', () => {
		assert.strictEqual(
			isTrustedGitCodeUrl('https://gitcode.com/org/repo', 'https://gitcode.com'),
			true,
		);
	});

	test('rejects URLs from another origin', () => {
		assert.strictEqual(
			isTrustedGitCodeUrl('https://example.com/org/repo', 'https://gitcode.com'),
			false,
		);
	});

	test('rejects non-web and malformed URLs', () => {
		assert.strictEqual(isTrustedGitCodeUrl('file:///tmp/example', 'https://gitcode.com'), false);
		assert.strictEqual(isTrustedGitCodeUrl('not a url', 'https://gitcode.com'), false);
	});

	test('uses the related pull request target repository when provided', () => {
		const resolved = resolveRelatedPullRequestRepository(repository, 'pr-org/pr-repo');

		assert.strictEqual(resolved.fullName, 'pr-org/pr-repo');
		assert.strictEqual(resolved.owner, 'pr-org');
		assert.strictEqual(resolved.name, 'pr-repo');
		assert.strictEqual(resolved.webUrl, 'https://gitcode.com/pr-org/pr-repo');
	});

	test('falls back to the trusted pull request URL repository', () => {
		const resolved = resolveRelatedPullRequestRepository(
			repository,
			undefined,
			'https://gitcode.com/pr-org/pr-repo/merge_requests/42',
		);

		assert.strictEqual(resolved.fullName, 'pr-org/pr-repo');
		assert.strictEqual(resolved.webUrl, 'https://gitcode.com/pr-org/pr-repo');
	});

	test('keeps the issue repository when related repository context is invalid', () => {
		assert.strictEqual(resolveRelatedPullRequestRepository(repository, 'invalid/full/name').fullName, repository.fullName);
		assert.strictEqual(
			resolveRelatedPullRequestRepository(repository, undefined, 'https://example.com/pr-org/pr-repo/merge_requests/42').fullName,
			repository.fullName,
		);
	});

	test('rejects empty titles and invalid loaded option selections', () => {
		assert.deepStrictEqual(
			validateIssueSectionInput('title', { title: '   ' }, detail, editOptions),
			['Title is required.'],
		);
		assert.deepStrictEqual(
			validateIssueSectionInput('assignees', { title: 'Issue title', assignees: 'alice,charlie' }, detail, editOptions),
			['Selected assignees must come from the repository member list.'],
		);
		assert.deepStrictEqual(
			validateIssueSectionInput('labels', { title: 'Issue title', labels: 'bug,unknown' }, detail, editOptions),
			['Selected labels must come from the repository label list.'],
		);
		assert.deepStrictEqual(
			validateIssueSectionInput('milestone', { title: 'Issue title', milestoneNumber: 99 }, detail, editOptions),
			['Selected milestone must come from the repository milestone list.'],
		);
	});

	test('validates close and reopen issue state actions', () => {
		assert.deepStrictEqual(validateIssueStateChange('invalid', detail), ['Issue state action must be close or reopen.']);
		assert.deepStrictEqual(validateIssueStateChange('close', detail), []);
		assert.deepStrictEqual(validateIssueStateChange('reopen', detail), ['Only closed issues can be reopened.']);
		assert.deepStrictEqual(validateIssueStateChange('reopen', { ...detail, state: 'closed' }), []);
	});

	test('posts issue comment edit error when host permission check denies save', async () => {
		const postedMessages: unknown[] = [];
		const fakeWebviewPanel = {
			webview: {
				postMessage: async (message: unknown) => {
					postedMessages.push(message);
					return true;
				},
				onDidReceiveMessage: () => ({ dispose: () => undefined }),
			},
			onDidDispose: () => ({ dispose: () => undefined }),
			onDidChangeViewState: () => ({ dispose: () => undefined }),
		};
		const fakeStore = {
			getCurrentUserLogin: async () => 'bob',
		};
		const fakeCommentsStore = {
			editComment: async () => {
				throw new Error('editComment should not be called');
			},
		};
		const fakeLogger = {
			error: () => undefined,
			warn: () => undefined,
			info: () => undefined,
			debug: () => undefined,
		};
		const panel = new (IssueOverviewPanel as unknown as {
			new(...args: unknown[]): unknown;
		})(
			fakeWebviewPanel,
			fakeStore,
			fakeCommentsStore,
			{},
			{},
			{},
			{},
			fakeLogger,
			{ repository, issueNumber: detail.number },
		) as {
			commentsSnapshot?: IssueCommentsSnapshot;
			checkWritePermission: () => Promise<boolean>;
			handleEditIssueComment: (commentId: string, body: string) => Promise<void>;
		};

		panel.commentsSnapshot = {
			repositoryKey: repository.fullName,
			issueNumber: detail.number,
			comments: [{
				id: 'comment-1',
				body: 'saved body',
				author: { login: 'alice' },
				createdAt: '2026-06-30T10:00:00+08:00',
				updatedAt: '2026-06-30T10:00:00+08:00',
			}],
			loadedAt: Date.now(),
		};
		panel.checkWritePermission = async () => false;

		await panel.handleEditIssueComment('comment-1', 'edited body');

		assert.deepStrictEqual(postedMessages, [{
			command: 'issueCommentEditError',
			commentId: 'comment-1',
			message: 'You do not have permission to edit comments in issue-org/issue-repo.',
		}]);
	});
});
