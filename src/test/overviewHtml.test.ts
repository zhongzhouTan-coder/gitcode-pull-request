import * as assert from 'assert';
import { PullRequestCommentsSnapshot, PullRequestDetail } from '../common/models';
import { getOverviewWithCommentsHtml } from '../view/overview/overviewHtml';

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
});
