import * as assert from 'assert';
import { formatGitPushErrorMessage } from '../common/git/gitErrorMessages';
import { issueBranchSlug } from '../common/git/localGitService';

suite('issueBranchSlug', () => {
	test('generates a slug from issue number and title', () => {
		const result = issueBranchSlug(309, 'Quantization warning for Qwen3.6');
		assert.strictEqual(result, 'issue/309-quantization-warning-for-qwen3-6');
	});

	test('handles simple titles', () => {
		const result = issueBranchSlug(1, 'Fix login bug');
		assert.strictEqual(result, 'issue/1-fix-login-bug');
	});

	test('removes trailing hyphens', () => {
		const result = issueBranchSlug(42, 'Fix bug!!!');
		assert.strictEqual(result, 'issue/42-fix-bug');
	});

	test('truncates long titles to 50 characters', () => {
		const longTitle = 'A very long issue title that goes on and on and on about something very specific and detailed';
		const result = issueBranchSlug(100, longTitle);
		assert.ok(result.startsWith('issue/100-a-very-long-issue-title-that-goes-on-and-on'));
		assert.ok(result.length <= 60); // issue/100- prefix + 50 chars
	});

	test('handles special characters', () => {
		const result = issueBranchSlug(5, 'Fix: "special" characters & symbols!');
		assert.strictEqual(result, 'issue/5-fix-special-characters-symbols');
	});
});

suite('settle issue command helpers', () => {
	test('formats GitCode HTTPS username push failures with credential guidance', () => {
		const message = formatGitPushErrorMessage(
			new Error("fatal: could not read Username for 'https://gitcode.com': No such device or address"),
			'origin',
		);

		assert.ok(message.includes('Failed to push for remote "origin"'));
		assert.ok(message.includes('Git credentials are not configured for https://gitcode.com'));
		assert.ok(message.includes('credential helper or personal access token'));
		assert.ok(message.includes('SSH'));
	});

	test('preserves unexpected push errors', () => {
		assert.strictEqual(
			formatGitPushErrorMessage(new Error('remote rejected the update'), 'gitcode'),
			'Failed to push for remote "gitcode": remote rejected the update',
		);
	});
});
