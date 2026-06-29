import * as assert from 'assert';
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
