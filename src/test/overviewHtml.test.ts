import * as assert from 'assert';
import { PullRequestCommentsSnapshot, PullRequestDetail, PullRequestRelatedIssuesSnapshot } from '../common/models';
import { getOverviewWithCommentsHtml, renderRelatedIssuesSection } from '../view/overview/overviewHtml';

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
});
