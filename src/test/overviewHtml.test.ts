import * as assert from 'assert';
import { EditPullRequestOptions, PullRequestCommentsSnapshot, PullRequestDetail, PullRequestRelatedIssuesSnapshot } from '../common/models';
import { getOverviewHtml, getOverviewWithCommentsHtml, renderRelatedIssuesSection } from '../view/overview/overviewHtml';

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

	test('renders pull request state management as an action button', () => {
		const openHtml = getOverviewHtml(detail, 'nonce');
		const closedHtml = getOverviewHtml({ ...detail, state: 'closed' }, 'nonce');
		const mergedHtml = getOverviewHtml({ ...detail, state: 'merged' }, 'nonce');

		assert.match(openHtml, /id="state-action-button" data-state-action="closed"[^>]*>Close pull request<\/button>/);
		assert.match(closedHtml, /id="state-action-button" data-state-action="open"[^>]*>Reopen pull request<\/button>/);
		assert.match(mergedHtml, /id="state-action-button" data-state-action="open" disabled>Reopen pull request<\/button>/);
		assert.doesNotMatch(openHtml, /data-section-input="state"/);
		assert.doesNotMatch(openHtml, /data-section="state" title="Edit state"/);
	});

	test('posts pull request state change messages from the action button', () => {
		const html = getOverviewHtml(detail, 'nonce');

		assert.match(html, /command: 'changePullRequestState'/);
		assert.match(html, /state: pendingStateAction/);
		assert.match(html, /pullRequestStateChangeError/);
		assert.match(html, /button\.textContent = pendingStateAction === 'closed' \? 'Close pull request' : 'Reopen pull request';/);
	});
});
