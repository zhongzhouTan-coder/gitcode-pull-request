import * as assert from 'assert';
import { mapPullRequestDetail } from '../gitcode/mappers/pullRequestDetailMapper';

suite('PullRequestDetailMapper', () => {
	test('maps merged pull request detail and flattens mergeability reasons', () => {
		const detail = mapPullRequestDetail({
			id: 123,
			number: 456,
			title: 'Improve detail page',
			state: 'closed',
			body: 'Body',
			url: 'https://api.gitcode.com/pr/456',
			html_url: 'https://gitcode.com/org/repo/merge_requests/456',
			draft: true,
			created_at: '2026-06-20T10:00:00+08:00',
			updated_at: '2026-06-21T12:00:00+08:00',
			closed_at: '',
			merged_at: '2026-06-21T13:00:00+08:00',
			user: {
				login: 'alice',
				name: 'Alice',
			},
			head: {
				ref: 'feature/detail',
				sha: 'headsha',
				label: 'feature/detail',
				repo: {
					full_name: 'alice/repo',
					html_url: 'https://gitcode.com/alice/repo.git',
					namespace: {
						path: 'alice',
					},
				},
			},
			base: {
				ref: 'main',
				sha: 'basesha',
				label: 'main',
				repo: {
					full_name: 'org/repo',
					html_url: 'https://gitcode.com/org/repo.git',
					namespace: {
						path: 'org',
					},
				},
			},
			assignees: [{ login: 'bob' }],
			approval_reviewers: [{ login: 'carol', name: 'Carol' }],
			testers: [{ login: 'dave' }],
			labels: [{ id: 1, name: 'kind/feature', color: '00ff00' }],
			can_merge_check: false,
			mergeable: true,
			mergeable_state: {
				state: true,
				conflict_passed: true,
				ci_state_passed: false,
				approval_reviewers_required_passed: true,
				approval_approvers_required_passed: true,
				approval_testers_required_passed: false,
				reason: {
					merged_by_user_passed: 'Missing push permission.',
					conflict_passed: false,
				},
			},
		});

		assert.strictEqual(detail.state, 'merged');
		assert.strictEqual(detail.isDraft, true);
		assert.strictEqual(detail.closedAt, undefined);
		assert.strictEqual(detail.mergedAt, '2026-06-21T13:00:00+08:00');
		assert.strictEqual(detail.author.login, 'alice');
		assert.strictEqual(detail.source.repositoryFullName, 'alice/repo');
		assert.strictEqual(detail.target.ref, 'main');
		assert.strictEqual(detail.reviewers[0].name, 'Carol');
		assert.strictEqual(detail.labels[0].color, '00ff00');
		assert.strictEqual(detail.mergeability.mergeable, true);
		assert.strictEqual(detail.mergeability.canMergeCheck, false);
		assert.strictEqual(detail.mergeability.hasConflicts, false);
		assert.strictEqual(detail.mergeability.ciPassed, false);
		assert.strictEqual(detail.mergeability.reviewPassed, false);
		assert.deepStrictEqual(detail.mergeability.reasons, ['Missing push permission.', 'conflict_passed']);
	});
});
