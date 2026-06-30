import * as assert from 'assert';
import { PullRequestDetail } from '../common/models';
import { isTrustedGitCodeUrl, validatePullRequestCommentBody, validatePullRequestStateChange } from '../view/overview/pullRequestOverviewPanel';

suite('PullRequestOverviewPanel', () => {
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

	test('validates close and reopen pull request state actions', () => {
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

		assert.deepStrictEqual(validatePullRequestStateChange('invalid', detail), ['Pull request state must be open or closed.']);
		assert.deepStrictEqual(validatePullRequestStateChange('closed', detail), []);
		assert.deepStrictEqual(validatePullRequestStateChange('open', detail), ['Only closed pull requests can be reopened.']);
		assert.deepStrictEqual(validatePullRequestStateChange('open', { ...detail, state: 'closed' }), []);
		assert.deepStrictEqual(validatePullRequestStateChange('closed', { ...detail, state: 'closed' }), ['Only open pull requests can be closed.']);
		assert.deepStrictEqual(validatePullRequestStateChange('open', { ...detail, state: 'merged' }), ['Merged pull requests cannot be reopened or closed.']);
	});

	test('validates pull request comment bodies', () => {
		assert.deepStrictEqual(validatePullRequestCommentBody('   '), ['Comment body is required.']);
		assert.deepStrictEqual(validatePullRequestCommentBody('Looks good'), []);
	});
});
