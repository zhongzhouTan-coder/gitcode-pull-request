import * as assert from 'assert';
import { isTrustedGitCodeUrl } from '../view/issueOverview/issueOverviewPanel';

suite('IssueOverviewPanel', () => {
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
});
