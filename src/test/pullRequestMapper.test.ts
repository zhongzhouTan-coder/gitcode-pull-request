import * as assert from 'assert';
import { mapEditPullRequestInput } from '../gitcode/mappers/pullRequestMapper';

suite('PullRequestMapper', () => {
	test('maps edit pull request input to the API request body', () => {
		const body = mapEditPullRequestInput({
			title: 'Refine overview editing',
			body: 'Keep edits inline',
			state: 'open',
			milestoneNumber: 12,
			labels: 'bug,ui',
			draft: true,
			closeRelatedIssue: false,
		});

		assert.deepStrictEqual(body, {
			title: 'Refine overview editing',
			body: 'Keep edits inline',
			state: 'open',
			milestone_number: 12,
			labels: 'bug,ui',
			draft: true,
			close_related_issue: false,
		});
	});

	test('maps pruneBranch and squashMerge to the API request body', () => {
		const body = mapEditPullRequestInput({
			title: 'Enable prune and squash',
			pruneBranch: true,
			squashMerge: false,
		});

		assert.deepStrictEqual(body, {
			title: 'Enable prune and squash',
			prune_branch: true,
			squash_merge: false,
		});
	});

	test('omits pruneBranch and squashMerge when undefined', () => {
		const body = mapEditPullRequestInput({
			title: 'No preferences',
		});

		assert.strictEqual('prune_branch' in body, false);
		assert.strictEqual('squash_merge' in body, false);
	});
});