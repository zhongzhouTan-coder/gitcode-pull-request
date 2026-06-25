import * as assert from 'assert';
import { GitCodeRepository } from '../common/models';
import { isTrustedGitCodeUrl, resolveRelatedPullRequestRepository } from '../view/issueOverview/issueOverviewPanel';

suite('IssueOverviewPanel', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'issue-org',
		name: 'issue-repo',
		fullName: 'issue-org/issue-repo',
		webUrl: 'https://gitcode.com/issue-org/issue-repo',
	};

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

	test('uses the related pull request target repository when provided', () => {
		const resolved = resolveRelatedPullRequestRepository(repository, 'pr-org/pr-repo');

		assert.strictEqual(resolved.fullName, 'pr-org/pr-repo');
		assert.strictEqual(resolved.owner, 'pr-org');
		assert.strictEqual(resolved.name, 'pr-repo');
		assert.strictEqual(resolved.webUrl, 'https://gitcode.com/pr-org/pr-repo');
	});

	test('falls back to the trusted pull request URL repository', () => {
		const resolved = resolveRelatedPullRequestRepository(
			repository,
			undefined,
			'https://gitcode.com/pr-org/pr-repo/merge_requests/42',
		);

		assert.strictEqual(resolved.fullName, 'pr-org/pr-repo');
		assert.strictEqual(resolved.webUrl, 'https://gitcode.com/pr-org/pr-repo');
	});

	test('keeps the issue repository when related repository context is invalid', () => {
		assert.strictEqual(resolveRelatedPullRequestRepository(repository, 'invalid/full/name').fullName, repository.fullName);
		assert.strictEqual(
			resolveRelatedPullRequestRepository(repository, undefined, 'https://example.com/pr-org/pr-repo/merge_requests/42').fullName,
			repository.fullName,
		);
	});
});
