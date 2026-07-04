import * as assert from 'assert';
import { EditPullRequestOptions, PullRequestCommentsSnapshot, PullRequestDetail, PullRequestOperationLogsSnapshot, PullRequestRelatedIssuesSnapshot } from '../common/models';
import { getOverviewHtml, getOverviewWithCommentsHtml, getOverviewWithTimelineHtml, renderActivityError, renderActivityLoading, renderActivitySection, renderRelatedIssuesSection } from '../view/overview/overviewHtml';

suite('OverviewHtml', () => {
	const detail: PullRequestDetail = {
		id: 1,
		number: 2,
		title: 'Title',
		state: 'open',
		body: 'Body',
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
		mergeability: { mergeable: true, reasons: [] },
	};

	test('uses initials when a comment avatar URL is malformed', () => {
		const snapshot: PullRequestCommentsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			loadedAt: Date.now(),
			comments: [{
				kind: 'pullRequest',
				id: '1',
				discussionId: '1',
				body: 'Comment body',
				author: {
					id: '1',
					login: 'alice',
					avatarUrl: 'not a URL',
				},
				createdAt: '2026-06-20T10:00:00+08:00',
				updatedAt: '2026-06-20T10:00:00+08:00',
				replies: [],
			}],
		};

		const html = getOverviewWithCommentsHtml(detail, snapshot, 'nonce');

		assert.match(html, /class="avatar-initials">A<\/span>/);
		assert.match(html, /Comment body/);
	});

	test('renders a conversation composer and submit message wiring', () => {
		const html = getOverviewWithCommentsHtml(
			detail,
			{
				repositoryKey: 'org/repo',
				pullRequestNumber: 2,
				loadedAt: Date.now(),
				comments: [],
			},
			'nonce',
		);

		assert.match(html, /id="conversation-comment-input"/);
		assert.match(html, /id="conversation-comment-submit"/);
		assert.ok(html.indexOf('No comments yet.') < html.indexOf('id="conversation-comment-input"'));
		assert.match(html, /command: 'submitPullRequestComment'/);
		assert.match(html, /pullRequestCommentSubmitError/);
		assert.match(html, /button\.textContent = submitting \? 'Commenting\.\.\.' : 'Comment';/);
	});

	test('renders pull request comment composer after loaded comments', () => {
		const html = getOverviewWithCommentsHtml(
			detail,
			{
				repositoryKey: 'org/repo',
				pullRequestNumber: 2,
				loadedAt: Date.now(),
				comments: [{
					kind: 'pullRequest',
					id: '1',
					discussionId: '1',
					body: 'Existing comment',
					author: { id: '1', login: 'alice' },
					createdAt: '2026-06-20T10:00:00+08:00',
					updatedAt: '2026-06-20T10:00:00+08:00',
					replies: [],
				}],
			},
			'nonce',
		);

		assert.ok(html.indexOf('Existing comment') < html.indexOf('id="conversation-comment-input"'));
	});

	test('renders comments and activity as one chronological timeline', () => {
		const comments: PullRequestCommentsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			loadedAt: Date.now(),
			comments: [{
				kind: 'pullRequest',
				id: 'comment-1',
				discussionId: 'discussion-1',
				body: 'Middle comment',
				author: { id: '1', login: 'alice' },
				createdAt: '2026-06-20T10:05:00+08:00',
				updatedAt: '2026-06-20T10:05:00+08:00',
				replies: [],
			}],
		};
		const activity: PullRequestOperationLogsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			loadedAt: Date.now(),
			logs: [
				{
					id: 'activity-1',
					content: 'opened pull request',
					action: 'opened',
					actionType: 'opened',
					actor: { login: 'bob' },
					createdAt: '2026-06-20T10:00:00+08:00',
					updatedAt: '2026-06-20T10:00:00+08:00',
				},
				{
					id: 'activity-2',
					content: 'updated title',
					action: 'title',
					actionType: 'title',
					actor: { login: 'carol' },
					createdAt: '2026-06-20T10:10:00+08:00',
					updatedAt: '2026-06-20T10:10:00+08:00',
				},
			],
		};

		const html = getOverviewWithTimelineHtml(detail, comments, 'nonce', undefined, undefined, undefined, activity);

		assert.match(html, /Timeline \(3\)/);
		assert.ok(html.indexOf('opened pull request') < html.indexOf('Middle comment'));
		assert.ok(html.indexOf('Middle comment') < html.indexOf('updated title'));
		assert.ok(html.indexOf('updated title') < html.indexOf('id="conversation-comment-input"'));
		assert.doesNotMatch(html, /<h2>Activity/);
	});

	test('posts openIssue messages for related issue title buttons', () => {
		const relatedIssues: PullRequestRelatedIssuesSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			loadedAt: Date.now(),
			issues: [{
				id: 10,
				number: 339,
				title: 'Related issue',
				state: 'open',
				url: 'https://gitcode.com/org/repo/issues/339',
				author: { login: 'alice' },
				labels: [],
				createdAt: '2026-06-20T10:00:00+08:00',
				updatedAt: '2026-06-20T10:00:00+08:00',
			}],
		};

		const html = getOverviewWithCommentsHtml(
			detail,
			{
				repositoryKey: 'org/repo',
				pullRequestNumber: 2,
				loadedAt: Date.now(),
				comments: [],
			},
			'nonce',
			renderRelatedIssuesSection(relatedIssues),
		);

		assert.match(html, /data-action="openIssue"/);
		assert.match(html, /data-repository=""/);
		assert.match(html, /command: 'openIssue'/);
		assert.match(html, /issue: Number\(el\.dataset\.issue\)/);
	});

	test('serializes repository-backed label and milestone edit options into the webview', () => {
		const html = getOverviewHtml(
			{
				...detail,
				labels: [{ id: 5, name: 'bug', color: 'ff0000' }],
				milestone: { number: 7, title: 'Sprint 7', state: 'open' },
			},
			'nonce',
			undefined,
			undefined,
			{
				labels: [{ id: 5, name: 'bug', color: 'ff0000' }],
				milestones: [{ number: 7, title: 'Sprint 7', state: 'open' }],
			} as EditPullRequestOptions,
		);

		assert.match(html, /"labels":\[\{"id":5,"name":"bug","color":"ff0000"\}\]/);
		assert.match(html, /"milestones":\[\{"number":7,"title":"Sprint 7","state":"open"\}\]/);
		assert.match(html, /Select labels from the repository label list\./);
		assert.match(html, /\.picker-options \{[\s\S]*max-height: 140px;[\s\S]*overflow: auto;/);
		assert.match(html, /\.picker-selected \{[\s\S]*max-height: 112px;[\s\S]*overflow-y: auto;/);
		assert.match(html, /<option value="">No milestone<\/option>/);
	});

	test('escapes inline script JSON for repository-controlled strings', () => {
		const html = getOverviewHtml(
			{
				...detail,
				title: '</script><script>alert("x")</script>',
				labels: [{ id: 5, name: '</script><img>', color: 'ff0000' }],
				milestone: { number: 7, title: '</script><b>boom</b>', state: 'open' },
			},
			'nonce',
			undefined,
			undefined,
			{
				labels: [{ id: 5, name: '</script><img>', color: 'ff0000' }],
				milestones: [{ number: 7, title: '</script><b>boom</b>', state: 'open' }],
			} as EditPullRequestOptions,
		);

		assert.doesNotMatch(html, /const editOptions = .*<\/script>/);
		assert.doesNotMatch(html, /const detailSnapshot = .*<\/script>/);
		assert.doesNotMatch(html, /var currentTitle = .*<\/script>/);
		assert.ok(html.includes('"title":"\\u003C/script\\u003E\\u003Cscript\\u003Ealert(\\"x\\")\\u003C/script\\u003E"'));
	});

	test('resets canceled section edits from the immutable detail snapshot', () => {
		const html = getOverviewHtml(detail, 'nonce');

		assert.match(html, /function resetSectionState\(section\)/);
		assert.match(html, /titleInput\.value = detailSnapshot\.title \|\| ''/);
		assert.match(html, /bodyInput\.value = detailSnapshot\.body \|\| ''/);
		assert.match(html, /draftInput\.checked = Boolean\(detailSnapshot\.draft\)/);
		assert.match(html, /if \(section === 'closeRelatedIssue'\) \{[\s\S]*closeRelatedIssueInput\.checked = false;/);
		assert.match(html, /resetSectionState\(section\);[\s\S]*if \(section === 'labels'\)/);
	});

	test('renders pull request refresh and state management actions', () => {
		const emptyComments: PullRequestCommentsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			loadedAt: Date.now(),
			comments: [],
		};
		const openHtml = getOverviewWithTimelineHtml(detail, emptyComments, 'nonce');
		const closedHtml = getOverviewWithTimelineHtml({ ...detail, state: 'closed' }, emptyComments, 'nonce');
		const mergedHtml = getOverviewWithTimelineHtml({ ...detail, state: 'merged' }, emptyComments, 'nonce');

		assert.match(openHtml, /id="refresh-button" class="secondary" title="Refresh" aria-label="Refresh pull request">Refresh<\/button>/);
		assert.match(openHtml, /id="open-web-button" class="secondary"/);
		assert.match(openHtml, /id="state-action-button" type="button" class="secondary" data-state-action="closed"[^>]*>Close pull request<\/button>/);
		assert.match(closedHtml, /id="state-action-button" type="button" class="secondary" data-state-action="open"[^>]*>Reopen pull request<\/button>/);
		assert.match(mergedHtml, /id="state-action-button" type="button" class="secondary" data-state-action="open" disabled>Reopen pull request<\/button>/);
		assert.ok(openHtml.indexOf('id="state-action-button"') > openHtml.indexOf('<main>'));
		assert.ok(openHtml.indexOf('id="state-action-button"') < openHtml.indexOf('</main>'));
		assert.ok(openHtml.indexOf('id="state-action-button"') < openHtml.indexOf('<aside>'));
		assert.doesNotMatch(openHtml, /data-section-input="state"/);
		assert.doesNotMatch(openHtml, /data-section="state" title="Edit state"/);
		assert.doesNotMatch(openHtml, /<h3>State<\/h3>/);
		assert.doesNotMatch(openHtml, /section-view-state/);
	});

	test('renders draft and close related issue settings as checkbox actions', () => {
		const html = getOverviewHtml(detail, 'nonce');
		const optionsCardStart = html.indexOf('<div class="card preference-card">');

		assert.ok(optionsCardStart > -1);
		assert.match(html, /<div class="card preference-card">[\s\S]*<h3>Pull Request Options<\/h3>[\s\S]*<input type="checkbox" data-section-input="draft"/);
		assert.match(html, /<span class="preference-title">Mark as draft<\/span>/);
		assert.doesNotMatch(html, /<button class="btn-primary btn-save-section" data-section="draft">Save<\/button>/);
		assert.match(html, /<div class="card preference-card">[\s\S]*<input type="checkbox" data-section-input="closeRelatedIssue">/);
		assert.match(html, /<span class="preference-title">Close related issues after merge<\/span>/);
		assert.doesNotMatch(html, /<button class="btn-primary btn-save-section" data-section="closeRelatedIssue">Save<\/button>/);
		assert.match(html, /document\.querySelectorAll\('\.preference-card \[data-section-input\]'\)\.forEach/);
		assert.doesNotMatch(html, /data-section="draft" title="Edit draft"/);
		assert.doesNotMatch(html, /section-view-closeRelatedIssue/);
		assert.strictEqual(html.indexOf('<div class="card preference-card">', optionsCardStart + 1), -1);
	});

	test('posts pull request state change messages from the action button', () => {
		const html = getOverviewWithTimelineHtml(
			detail,
			{
				repositoryKey: 'org/repo',
				pullRequestNumber: 2,
				loadedAt: Date.now(),
				comments: [],
			},
			'nonce',
		);

		assert.match(html, /command: 'changePullRequestState'/);
		assert.match(html, /state: pendingStateAction/);
		assert.match(html, /pullRequestStateChangeError/);
		assert.match(html, /button\.setAttribute\('data-confirming-close', 'true'\);/);
		assert.match(html, /button\.classList\.remove\('danger'\);/);
		assert.match(html, /button\.classList\.add\('secondary'\);/);
		assert.match(html, /button\.textContent = 'Confirm close pull request';/);
		assert.match(html, /Click again to confirm closing this pull request\./);
		assert.match(html, /button\.textContent = pendingStateAction === 'closed' \? 'Close pull request' : 'Reopen pull request';/);
	});

	test('renders related issues before the timeline and aligns footer actions around the composer', () => {
		const html = getOverviewWithTimelineHtml(
			detail,
			{
				repositoryKey: 'org/repo',
				pullRequestNumber: 2,
				loadedAt: Date.now(),
				comments: [],
			},
			'nonce',
			renderRelatedIssuesSection({
				repositoryKey: 'org/repo',
				pullRequestNumber: 2,
				loadedAt: Date.now(),
				issues: [{
					id: 10,
					number: 339,
					title: 'Related issue',
					state: 'open',
					url: 'https://gitcode.com/org/repo/issues/339',
					author: { login: 'alice' },
					labels: [],
					createdAt: '2026-06-20T10:00:00+08:00',
					updatedAt: '2026-06-20T10:00:00+08:00',
				}],
			}),
		);

		assert.ok(html.indexOf('Related Issues (1)') < html.indexOf('Timeline'));
		assert.match(html, /<div class="conversation-action-row">[\s\S]*id="state-action-button"[\s\S]*id="conversation-comment-submit"/);
		assert.match(html, /<div class="conversation-action-feedback">[\s\S]*id="state-action-error"[\s\S]*id="conversation-comment-error"/);
	});

	test('renders review status separately from metadata badges for diff comments only', () => {
		const html = getOverviewWithCommentsHtml(
			detail,
			{
				repositoryKey: 'org/repo',
				pullRequestNumber: 2,
				loadedAt: Date.now(),
				comments: [
					{
						kind: 'diff',
						id: '1',
						discussionId: 'discussion-1',
						body: 'Resolved diff comment',
						author: { id: '1', login: 'alice' },
						createdAt: '2026-06-20T10:00:00+08:00',
						updatedAt: '2026-06-20T10:00:00+08:00',
						replies: [],
						resolved: true,
						isOutdated: true,
						location: {
							path: 'src/example.ts',
							side: 'head',
							startLine: 24,
							endLine: 24,
							positionType: 'text',
						},
					},
					{
						kind: 'diff',
						id: '3',
						discussionId: 'discussion-3',
						body: 'Unresolved diff comment',
						author: { id: '3', login: 'carol' },
						createdAt: '2026-06-20T10:00:00+08:00',
						updatedAt: '2026-06-20T10:00:00+08:00',
						replies: [],
						resolved: false,
						isOutdated: false,
						location: {
							path: 'src/example.ts',
							side: 'head',
							startLine: 31,
							endLine: 31,
							positionType: 'text',
						},
					},
					{
						kind: 'pullRequest',
						id: '2',
						discussionId: 'discussion-2',
						body: 'General comment',
						author: { id: '2', login: 'bob' },
						createdAt: '2026-06-20T10:00:00+08:00',
						updatedAt: '2026-06-20T10:00:00+08:00',
						replies: [],
					},
				],
			},
			'nonce',
		);

		assert.match(html, /<div class="comment-review-status" aria-label="Review status: Resolved">[\s\S]*<span class="comment-toggle-label">Review status<\/span>[\s\S]*<input type="checkbox" class="comment-toggle-input" data-action="revisePullRequestCommentStatus" data-discussion-id="discussion-1" data-resolved="false" checked>[\s\S]*<span class="comment-toggle-state">Resolved<\/span>/);
		assert.match(html, /<div class="comment-review-status" aria-label="Review status: Unresolved">[\s\S]*<span class="comment-toggle-label">Review status<\/span>[\s\S]*<input type="checkbox" class="comment-toggle-input" data-action="revisePullRequestCommentStatus" data-discussion-id="discussion-3" data-resolved="true" >[\s\S]*<span class="comment-toggle-state">Unresolved<\/span>/);
		assert.match(html, /Code comment · <button class="comment-file comment-file-link" data-action="openDiffComment" data-path="src\/example\.ts" data-line="24" title="Open diff at line 24">src\/example\.ts<\/button> · line 24/);
		assert.match(html, /Code comment · <button class="comment-file comment-file-link" data-action="openDiffComment" data-path="src\/example\.ts" data-line="31" title="Open diff at line 31">src\/example\.ts<\/button> · line 31/);
		assert.match(html, /command: 'openDiffComment'/);
		assert.match(html, /path: el\.dataset\.path/);
		assert.match(html, /line: Number\(el\.dataset\.line\)/);
		assert.match(html, /badge badge-outdated">Outdated<\/span>/);
		assert.strictEqual(html.match(/comment-toggle-state">Resolved<\/span>/g)?.length, 1);
		assert.strictEqual(html.match(/comment-toggle-state">Unresolved<\/span>/g)?.length, 1);
		assert.strictEqual(html.match(/class="comment-toggle-input"/g)?.length, 2);
		assert.strictEqual(html.match(/badge badge-resolved">Resolved<\/span>/g)?.length ?? 0, 0);
		assert.strictEqual(html.match(/badge badge-unresolved">Unresolved<\/span>/g)?.length ?? 0, 0);
	});

	test('renders diff context for diff comments when provided', () => {
		const snapshot: PullRequestCommentsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			loadedAt: Date.now(),
			comments: [{
				kind: 'diff',
				id: 'comment-1',
				discussionId: 'discussion-1',
				body: 'Needs a null check.',
				author: { id: '1', login: 'alice' },
				createdAt: '2026-06-20T10:00:00+08:00',
				updatedAt: '2026-06-20T10:00:00+08:00',
				replies: [],
				resolved: false,
				isOutdated: false,
				location: {
					path: 'src/example.ts',
					side: 'head',
					startLine: 24,
					endLine: 24,
					positionType: 'text',
				},
			}],
		};
		const contexts = new Map([[
			'comment-1',
			{
				commentId: 'comment-1',
				lines: [
					{ kind: 'delete' as const, oldLine: 23, content: 'return value;', isCommentLine: false },
					{ kind: 'add' as const, newLine: 24, content: 'return value ?? fallback;', isCommentLine: true },
				],
			},
		]]);

		const html = getOverviewWithCommentsHtml(detail, snapshot, 'nonce', undefined, undefined, contexts);

		assert.match(html, /class="comment-diff" aria-label="Diff context"/);
		assert.match(html, /comment-diff-row-delete/);
		assert.match(html, /comment-diff-row-add comment-diff-row-comment/);
		assert.match(html, /return value \?\? fallback;/);
	});

	// ---- Activity / Operation Logs Tests ----

	test('renders activity loading state', () => {
		const html = getOverviewHtml(detail, 'nonce', undefined, undefined, undefined, true, renderActivityLoading());

		assert.match(html, /Loading activity/);
	});

	test('renders activity empty state', () => {
		const snapshot: PullRequestOperationLogsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			logs: [],
			loadedAt: Date.now(),
		};

		const html = renderActivitySection(snapshot);

		assert.match(html, /No activity yet/);
	});

	test('renders activity error state', () => {
		const html = renderActivityError('Unable to load activity.');

		assert.match(html, /Unable to load activity/);
	});

	test('renders activity items with escaped content', () => {
		const snapshot: PullRequestOperationLogsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			logs: [{
				id: '1',
				content: '<script>alert("xss")</script>',
				action: 'opened',
				actionType: 'opened',
				actor: { login: 'alice', name: 'Alice' },
				createdAt: '2026-07-01T00:10:02+08:00',
				updatedAt: '2026-07-01T00:10:02+08:00',
			}],
			loadedAt: Date.now(),
		};

		const html = renderActivitySection(snapshot);

		assert.doesNotMatch(html, /<script>alert/);
		assert.match(html, /&lt;script&gt;alert/);
		assert.match(html, /Alice/);
		assert.match(html, /activity-badge-opened/);
	});

	test('renders actor display with and without URL', () => {
		const snapshot: PullRequestOperationLogsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			logs: [
				{
					id: '1',
					content: 'closed',
					action: 'closed',
					actionType: 'closed',
					actor: { login: 'bob', name: 'Bob', htmlUrl: 'https://gitcode.com/bob' },
					createdAt: '2026-07-01T00:10:02+08:00',
					updatedAt: '2026-07-01T00:10:02+08:00',
				},
				{
					id: '2',
					content: 'opened',
					action: 'opened',
					actionType: 'opened',
					actor: { login: 'carol' },
					createdAt: '2026-07-01T00:10:02+08:00',
					updatedAt: '2026-07-01T00:10:02+08:00',
				},
			],
			loadedAt: Date.now(),
		};

		const html = renderActivitySection(snapshot);

		// Bob has a URL and should render as a button
		assert.match(html, /activity-actor-btn.*data-url="https:\/\/gitcode.com\/bob"/);
		// Carol has no URL and should render as a span
		assert.match(html, /activity-actor-row/);
		assert.match(html, /@carol/);
	});

	test('renders activity badge fallback from action', () => {
		const snapshot: PullRequestOperationLogsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			logs: [{
				id: '1',
				content: 'changed title',
				action: 'title',
				actionType: 'title',
				actor: { login: 'alice' },
				createdAt: '2026-07-01T00:10:02+08:00',
				updatedAt: '2026-07-01T00:10:02+08:00',
			}],
			loadedAt: Date.now(),
		};

		const html = renderActivitySection(snapshot);

		assert.match(html, /activity-badge-title/);
	});

	test('renders invalid date as Unknown time', () => {
		const snapshot: PullRequestOperationLogsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			logs: [{
				id: '1',
				content: 'changed description',
				action: 'description',
				actionType: 'description',
				actor: { login: 'alice' },
				createdAt: '',
				updatedAt: '',
			}],
			loadedAt: Date.now(),
		};

		const html = renderActivitySection(snapshot);

		assert.match(html, /Unknown time/);
	});

	test('renders activity section with count in heading', () => {
		const snapshot: PullRequestOperationLogsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			logs: [
				{
					id: '1', content: 'first log', action: 'action', actionType: 'action',
					actor: { login: 'alice' }, createdAt: '2026-07-01T00:10:02+08:00', updatedAt: '2026-07-01T00:10:02+08:00',
				},
				{
					id: '2', content: 'second log', action: 'action', actionType: 'action',
					actor: { login: 'bob' }, createdAt: '2026-07-01T00:10:02+08:00', updatedAt: '2026-07-01T00:10:02+08:00',
				},
			],
			loadedAt: Date.now(),
		};

		const html = renderActivitySection(snapshot);

		assert.match(html, /Activity \(2\)/);
	});

	// ---- Add Related Issue Button Rendering ----

	test('renders the add button in the related issues section heading when enabled', () => {
		const snapshot: PullRequestRelatedIssuesSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			issues: [{ id: 1, number: 339, title: 'Test', state: 'open', author: { login: 'alice' }, labels: [], createdAt: '', updatedAt: '' }],
			loadedAt: Date.now(),
		};

		const html = renderRelatedIssuesSection(snapshot, { canAddRelatedIssue: true });

		assert.match(html, /class="icon-button add-related-issue-btn"/);
		assert.match(html, /data-action="addRelatedIssue"/);
		assert.match(html, /aria-label="Add related issue"/);
	});

	test('renders the add button disabled when canAddRelatedIssue is false', () => {
		const snapshot: PullRequestRelatedIssuesSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			issues: [],
			loadedAt: Date.now(),
		};

		const html = renderRelatedIssuesSection(snapshot, { canAddRelatedIssue: false });

		assert.match(html, /data-action="addRelatedIssue"/);
		assert.match(html, /disabled/);
		assert.match(html, /class="permission-tooltip-target"/);
		assert.match(html, /data-tooltip="You do not have permission to add related issues\."/);
		assert.doesNotMatch(html, /class="permission-tooltip-target"[^>]*title=/);
		assert.match(html, /You do not have permission to add related issues\./);
	});

	test('renders unlink related issue permission tooltip on an enabled wrapper', () => {
		const snapshot: PullRequestRelatedIssuesSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			issues: [{ id: 1, number: 339, title: 'Test', state: 'open', author: { login: 'alice' }, labels: [], createdAt: '', updatedAt: '' }],
			loadedAt: Date.now(),
		};

		const html = renderRelatedIssuesSection(snapshot, {
			canAddRelatedIssue: true,
			canRemoveRelatedIssue: false,
		});

		assert.match(html, /class="permission-tooltip-target"/);
		assert.match(html, /data-tooltip="You do not have permission to unlink related issues\."/);
		assert.doesNotMatch(html, /class="permission-tooltip-target"[^>]*title=/);
		assert.match(html, /tabindex="0"/);
		assert.match(html, /data-action="removeRelatedIssue"/);
		assert.match(html, /disabled/);
		assert.match(html, /You do not have permission to unlink related issues\./);
	});

	test('allows permission tooltip wrapper to receive hover over disabled icon buttons', () => {
		const html = getOverviewHtml(detail, 'nonce');

		assert.match(html, /\.permission-tooltip-target::after \{/);
		assert.match(html, /content: attr\(data-tooltip\);/);
		assert.match(html, /\.permission-tooltip-target:hover::after,\n\t\t\.permission-tooltip-target:focus-visible::after \{[\s\S]*display: block;/);
		assert.match(html, /\.permission-tooltip-target :disabled \{[\s\S]*pointer-events: none;/);
	});

	test('guards disabled related issue action handlers', () => {
		const html = getOverviewHtml(detail, 'nonce');

		assert.match(html, /if \(el\.disabled \|\| !hasOverviewPermission\('canUpdateRelatedIssues'\)\)/);
	});

	test('renders reviewer add and remove actions when reviewer options are enabled', () => {
		const html = getOverviewHtml(
			{
				...detail,
				reviewers: [{ login: 'carol', name: 'Carol', htmlUrl: 'https://gitcode.com/carol' }],
			},
			'nonce',
			undefined,
			undefined,
			undefined,
			true,
			undefined,
			undefined,
			{
				canAddReviewer: true,
				canRemoveReviewer: true,
			},
		);

		assert.match(html, /data-action="addReviewer"/);
		assert.match(html, /aria-label="Add reviewer"/);
		assert.match(html, /data-action="removeReviewer"/);
		assert.match(html, /data-login="carol"/);
		assert.match(html, /command: 'addReviewer'/);
		assert.match(html, /command: 'removeReviewer'/);
	});

	test('renders reviewer permission tooltip when reviewer updates are disabled', () => {
		const html = getOverviewHtml(
			{
				...detail,
				reviewers: [{ login: 'carol', name: 'Carol' }],
			},
			'nonce',
			undefined,
			undefined,
			undefined,
			true,
			undefined,
			undefined,
			{
				canAddReviewer: false,
				canRemoveReviewer: false,
			},
		);

		assert.match(html, /data-tooltip="You do not have permission to update reviewers\."/);
		assert.match(html, /data-action="addReviewer"/);
		assert.match(html, /data-action="removeReviewer"/);
		assert.match(html, /disabled/);
	});

	test('disables reviewer actions while a reviewer mutation is locked', () => {
		const html = getOverviewHtml(
			{
				...detail,
				reviewers: [{ login: 'carol', name: 'Carol', htmlUrl: 'https://gitcode.com/carol' }],
			},
			'nonce',
			undefined,
			undefined,
			undefined,
			true,
			undefined,
			undefined,
			{
				canAddReviewer: true,
				canRemoveReviewer: true,
				reviewerMutationInProgress: true,
			},
		);

		assert.match(html, /class="icon-button add-reviewer-btn"[^>]*disabled/);
		assert.match(html, /class="icon-button remove-reviewer-btn"[^>]*disabled/);
		assert.doesNotMatch(html, /class="spinner"/);
	});

	test('guards reviewer action handlers without reviewer permission', () => {
		const html = getOverviewHtml(detail, 'nonce');

		assert.match(html, /if \(el\.disabled \|\| !hasOverviewPermission\('canUpdateReviewers'\)\)/);
	});

	test('keeps reply controls disabled without comment permission', () => {
		const html = getOverviewHtml(detail, 'nonce');

		assert.match(html, /replyAction\.disabled = submitting \|\| !canCreateComment/);
		assert.match(html, /submitBtn\.disabled = !hasOverviewPermission\('canCreateComment'\) \|\| !input \|\| input\.disabled \|\| !input\.value\.trim\(\)/);
		assert.match(html, /if \(btn\.disabled \|\| !hasOverviewPermission\('canCreateComment'\)\)/);
	});

	test('does not render the add button when options are omitted', () => {
		const snapshot: PullRequestRelatedIssuesSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			issues: [],
			loadedAt: Date.now(),
		};

		const html = renderRelatedIssuesSection(snapshot);

		assert.doesNotMatch(html, /data-action="addRelatedIssue"/);
	});

	test('disables the add button when addRelatedIssueInProgress is true', () => {
		const snapshot: PullRequestRelatedIssuesSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			issues: [],
			loadedAt: Date.now(),
		};

		const html = renderRelatedIssuesSection(snapshot, { canAddRelatedIssue: true, addRelatedIssueInProgress: true });

		assert.match(html, /disabled/);
		assert.match(html, /class="spinner"/);
	});

	test('renders the add button for empty related issues when enabled', () => {
		const snapshot: PullRequestRelatedIssuesSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			issues: [],
			loadedAt: Date.now(),
		};

		const html = renderRelatedIssuesSection(snapshot, { canAddRelatedIssue: true });

		assert.match(html, /data-action="addRelatedIssue"/);
		assert.match(html, /No related issues/);
	});

	test('related issue rows are still escaped with the add button present', () => {
		const snapshot: PullRequestRelatedIssuesSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			issues: [{
				id: 1, number: 339, title: '<script>alert("xss")</script>', state: 'open',
				author: { login: 'alice' }, labels: [], createdAt: '', updatedAt: '',
			}],
			loadedAt: Date.now(),
		};

		const html = renderRelatedIssuesSection(snapshot, { canAddRelatedIssue: true });

		assert.doesNotMatch(html, /<script>alert\("xss"\)<\/script>/);
		assert.match(html, /&lt;script&gt;alert/);
		assert.match(html, /data-action="addRelatedIssue"/);
	});
});
