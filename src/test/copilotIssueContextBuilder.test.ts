import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitCodeRepository, IssueDetail, IssueRelatedPullRequest } from '../common/models';
import { RepositoryContextService } from '../common/git/repositoryContext';
import { IssueCommentService } from '../gitcode/services/issueCommentService';
import { IssueService } from '../gitcode/services/issueService';
import { CopilotIssueContextBuilder } from '../view/copilot/copilotIssueContextBuilder';
import { CopilotPromptBudget } from '../view/copilot/copilotPromptBudget';

suite('CopilotIssueContextBuilder', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};
	const budget: CopilotPromptBudget = {
		maxContextChars: 6_000,
		maxBodyChars: 500,
		maxDiffCommentChars: 400,
		maxPullRequestCommentChars: 200,
		maxPatchChars: 300,
		maxReplyChars: 100,
	};

	test('fails when issue detail fails', async () => {
		const builder = new CopilotIssueContextBuilder(
			{ getIssue: async () => { throw new Error('missing'); } } as unknown as IssueService,
			issueCommentService(),
			repositoryContextService(),
		);

		await assert.rejects(
			() => builder.build(selected(), token(), budget),
			/Unable to load issue #9 from org\/repo: missing/,
		);
	});

	test('reports secondary section failures leniently', async () => {
		const builder = new CopilotIssueContextBuilder(
			issueService(),
			{ listIssueComments: async () => { throw new Error('comments unavailable'); } } as unknown as IssueCommentService,
			{ getActiveRepository: async () => { throw new Error('no workspace'); } } as unknown as RepositoryContextService,
		);

		const context = await builder.build(selected(), token(), budget);

		assert.match(context, /## Issue #9: Bug report/);
		assert.match(context, /Unable to load comments: comments unavailable/);
		assert.doesNotMatch(context, /### Workspace/);
	});

	test('reports related pull request failures leniently', async () => {
		const builder = new CopilotIssueContextBuilder(
			{
				getIssue: async () => issueDetail(),
				listIssueRelatedPullRequests: async () => { throw new Error('related unavailable'); },
			} as unknown as IssueService,
			issueCommentService(),
			repositoryContextService(),
		);

		const context = await builder.build(selected(), token(), budget);

		assert.match(context, /Unable to load related pull requests: related unavailable/);
		assert.match(context, /### Recent Comments/);
	});

	function selected() {
		return {
			repository,
			issueNumber: 9,
			title: 'Bug report',
		};
	}

	function issueService(relatedPrs: IssueRelatedPullRequest[] = []): IssueService {
		return {
			getIssue: async () => issueDetail(),
			listIssueRelatedPullRequests: async () => relatedPrs,
		} as unknown as IssueService;
	}

	function issueCommentService(): IssueCommentService {
		return {
			listIssueComments: async () => [{
				id: 'comment-1',
				body: 'Issue discussion',
				author: { login: 'bob' },
				createdAt: '2026-07-02T00:00:00Z',
				updatedAt: '2026-07-02T00:00:00Z',
			}],
		} as unknown as IssueCommentService;
	}

	function repositoryContextService(): RepositoryContextService {
		return {
			getActiveRepository: async () => undefined,
		} as unknown as RepositoryContextService;
	}

	function issueDetail(): IssueDetail {
		return {
			id: 9,
			number: 9,
			title: 'Bug report',
			state: 'open',
			body: 'Issue body',
			author: { login: 'alice' },
			assignees: [],
			labels: [],
			comments: 1,
			createdAt: '2026-07-01T00:00:00Z',
			updatedAt: '2026-07-02T00:00:00Z',
			repository: {
				fullName: 'org/repo',
			},
		};
	}

	function token(): vscode.CancellationToken {
		return { isCancellationRequested: false } as vscode.CancellationToken;
	}
});
