import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitCodeRepository, PullRequestComment, PullRequestDetail, PullRequestFileChange } from '../common/models';
import { CommentService } from '../gitcode/services/commentService';
import { PullRequestService } from '../gitcode/services/pullRequestService';
import { CopilotPullRequestContextBuilder } from '../view/copilot/copilotPullRequestContextBuilder';
import { CopilotPromptBudget } from '../view/copilot/copilotPromptBudget';

type DiffCommentOverrides = Partial<Extract<PullRequestComment, { kind: 'diff' }>> & {
	path?: string;
	startLine?: number;
	endLine?: number;
};

suite('CopilotPullRequestContextBuilder', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	const budget: CopilotPromptBudget = {
		maxContextChars: 5_000,
		maxBodyChars: 500,
		maxDiffCommentChars: 400,
		maxPullRequestCommentChars: 200,
		maxPatchChars: 300,
		maxReplyChars: 100,
	};

	test('renders diff comments separately and prioritizes unresolved current comments', async () => {
		const builder = new CopilotPullRequestContextBuilder(
			pullRequestService(),
			commentService([
				diffComment('resolved-current', {
					body: 'Resolved current comment',
					resolved: true,
					isOutdated: false,
					createdAt: '2026-07-02T12:00:00Z',
				}),
				generalComment('general-new', 'General PR discussion', '2026-07-02T13:00:00Z'),
				diffComment('unresolved-current', {
					body: 'Unresolved current comment',
					resolved: false,
					isOutdated: false,
					createdAt: '2026-07-01T12:00:00Z',
					path: 'src/important.ts',
					startLine: 42,
					endLine: 48,
				}),
				diffComment('unresolved-outdated', {
					body: 'Unresolved outdated comment',
					resolved: false,
					isOutdated: true,
					createdAt: '2026-07-02T14:00:00Z',
				}),
			]),
		);

		const context = await builder.build(selected(), token(), budget);

		assert.match(context, /### Diff Review Comments/);
		assert.match(context, /### General Pull Request Comments/);
		assert.ok(context.indexOf('Unresolved current comment') < context.indexOf('Unresolved outdated comment'));
		assert.ok(context.indexOf('Unresolved outdated comment') < context.indexOf('Resolved current comment'));
		assert.match(context, /\[unresolved\] src\/important\.ts lines 42-48/);
		assert.match(context, /\[unresolved, outdated\]/);
	});

	test('keeps comments before patch excerpts when patches are large', async () => {
		const builder = new CopilotPullRequestContextBuilder(
			pullRequestService([fileChange({ path: 'src/large.ts', patch: `${'diff line\n'.repeat(500)}` })]),
			commentService([diffComment('review', { body: 'Review comment that should survive.' })]),
		);

		const context = await builder.build(selected(), token(), {
			...budget,
			maxContextChars: 2_000,
			maxPatchChars: 1_000,
		});

		assert.ok(context.indexOf('Review comment that should survive.') < context.indexOf('### Patch Excerpts'));
		assert.match(context, /Review comment that should survive/);
	});

	test('keeps diff comment with unknown location', async () => {
		const builder = new CopilotPullRequestContextBuilder(
			pullRequestService(),
			commentService([diffComment('unknown-location', {
				body: 'Needs context even without enrichment.',
				path: undefined,
				startLine: 0,
				endLine: 0,
			})]),
		);

		const context = await builder.build(selected(), token(), budget);

		assert.match(context, /unknown location/);
		assert.match(context, /Needs context even without enrichment/);
	});

	test('reports comment load failure leniently', async () => {
		const builder = new CopilotPullRequestContextBuilder(
			pullRequestService(),
			{ listPullRequestComments: async () => { throw new Error('comments down'); } } as unknown as CommentService,
		);

		const context = await builder.build(selected(), token(), budget);

		assert.match(context, /Unable to load comments: comments down/);
		assert.match(context, /### Changed Files/);
	});

	function selected() {
		return {
			repository,
			pullRequestNumber: 7,
			title: 'Test PR',
		};
	}

	function pullRequestService(files: PullRequestFileChange[] = [fileChange()]): PullRequestService {
		return {
			getPullRequest: async () => detail(),
			listPullRequestFiles: async () => files,
		} as unknown as PullRequestService;
	}

	function commentService(comments: PullRequestComment[]): CommentService {
		return {
			listPullRequestComments: async () => comments,
		} as unknown as CommentService;
	}

	function detail(): PullRequestDetail {
		return {
			id: 1,
			number: 7,
			title: 'Test PR',
			state: 'open',
			body: 'PR body',
			isDraft: false,
			createdAt: '2026-07-01T00:00:00Z',
			updatedAt: '2026-07-02T00:00:00Z',
			author: { login: 'alice' },
			source: { label: 'alice:feature', ref: 'feature' },
			target: { label: 'org:main', ref: 'main' },
			assignees: [],
			reviewers: [],
			testers: [],
			labels: [],
			mergeability: { mergeable: true, reasons: [] },
		};
	}

	function fileChange(overrides: Partial<PullRequestFileChange> = {}): PullRequestFileChange {
		return {
			sha: 'sha',
			path: 'src/example.ts',
			status: 'modified',
			additions: 2,
			deletions: 1,
			patch: '@@ -1 +1 @@\n-old\n+new',
			tooLarge: false,
			...overrides,
		};
	}

	function generalComment(id: string, body: string, createdAt: string): PullRequestComment {
		return {
			kind: 'pullRequest',
			id,
			discussionId: `discussion-${id}`,
			body,
			author: { id: 'u1', login: 'bob' },
			createdAt,
			updatedAt: createdAt,
			replies: [],
		};
	}

	function diffComment(id: string, overrides: DiffCommentOverrides = {}): PullRequestComment {
		return {
			kind: 'diff',
			id,
			discussionId: `discussion-${id}`,
			body: 'Diff body',
			author: { id: 'u2', login: 'carol' },
			createdAt: '2026-07-02T00:00:00Z',
			updatedAt: '2026-07-02T00:00:00Z',
			replies: [],
			resolved: false,
			isOutdated: false,
			location: {
				path: overrides.path ?? overrides.location?.path ?? 'src/example.ts',
				side: 'head',
				startLine: overrides.startLine ?? overrides.location?.startLine ?? 10,
				endLine: overrides.endLine ?? overrides.location?.endLine ?? 10,
				positionType: 'text',
			},
			...withoutLocationShortcuts(overrides),
		} as PullRequestComment;
	}

	function withoutLocationShortcuts(overrides: DiffCommentOverrides): Partial<Extract<PullRequestComment, { kind: 'diff' }>> {
		const { path: _path, startLine: _startLine, endLine: _endLine, ...rest } = overrides;
		return rest;
	}

	function token(): vscode.CancellationToken {
		return { isCancellationRequested: false } as vscode.CancellationToken;
	}
});
