import * as assert from 'assert';
import { IssueSummary, PullRequestDetail } from '../common/models';
import { isTrustedGitCodeUrl, validatePullRequestCommentBody, validatePullRequestStateChange, validateIssueNumberInput, parseIssueNumbers, getLinkableIssues, formatRelatedIssueQuickPickItem, getAddableReviewers, formatReviewerQuickPickItem } from '../view/overview/pullRequestOverviewPanel';

suite('PullRequestOverviewPanel', () => {
	const issue = (number: number, title = `Issue ${number}`): IssueSummary => ({
		id: number,
		number,
		title,
		state: 'open',
		author: { login: 'alice' },
		assignees: [],
		labels: [],
		comments: 0,
		createdAt: '2026-06-20T10:00:00+08:00',
		updatedAt: '2026-06-20T10:00:00+08:00',
		issueState: 'TODO',
		issueType: 'Bug',
	});

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

	// ---- Add Related Issue Validation ----

	test('validateIssueNumberInput rejects empty input', () => {
		assert.strictEqual(validateIssueNumberInput('', []), 'Enter at least one issue number.');
		assert.strictEqual(validateIssueNumberInput('   ', []), 'Enter at least one issue number.');
	});

	test('validateIssueNumberInput rejects non-positive integers', () => {
		assert.strictEqual(validateIssueNumberInput('abc', []), 'Issue numbers must be positive integers.');
		assert.strictEqual(validateIssueNumberInput('0', []), 'Issue numbers must be positive integers.');
		assert.strictEqual(validateIssueNumberInput('-1', []), 'Issue numbers must be positive integers.');
		assert.strictEqual(validateIssueNumberInput('1.5', []), 'Issue numbers must be positive integers.');
	});

	test('validateIssueNumberInput accepts valid comma-separated numbers', () => {
		assert.strictEqual(validateIssueNumberInput('339', []), null);
		assert.strictEqual(validateIssueNumberInput('339,341,342', []), null);
		assert.strictEqual(validateIssueNumberInput('339, 341 , 342', []), null);
		assert.strictEqual(validateIssueNumberInput('339\n341', []), null);
	});

	test('validateIssueNumberInput rejects all-already-linked numbers', () => {
		assert.strictEqual(
			validateIssueNumberInput('339,341', [339, 341, 342]),
			'All selected issues are already related to this pull request.',
		);
	});

	test('validateIssueNumberInput accepts mixed new and already-linked numbers', () => {
		assert.strictEqual(validateIssueNumberInput('339,400', [339]), null);
	});

	test('parseIssueNumbers parses comma-separated input', () => {
		assert.deepStrictEqual(parseIssueNumbers('339,341,342'), [339, 341, 342]);
		assert.deepStrictEqual(parseIssueNumbers('339, 341 , 342'), [339, 341, 342]);
	});

	test('parseIssueNumbers deduplicates issue numbers', () => {
		assert.deepStrictEqual(parseIssueNumbers('339,339,341'), [339, 341]);
	});

	test('parseIssueNumbers handles empty input', () => {
		assert.deepStrictEqual(parseIssueNumbers(''), []);
		assert.deepStrictEqual(parseIssueNumbers('   '), []);
	});

	test('parseIssueNumbers handles newlines and whitespace', () => {
		assert.deepStrictEqual(parseIssueNumbers('339\n341\n342'), [339, 341, 342]);
		assert.deepStrictEqual(parseIssueNumbers('339 \n 341'), [339, 341]);
	});

	test('getLinkableIssues filters already related issue numbers', () => {
		assert.deepStrictEqual(
			getLinkableIssues([issue(339), issue(341), issue(342)], [339, 342]).map((item) => item.number),
			[341],
		);
	});

	test('formatRelatedIssueQuickPickItem includes issue metadata', () => {
		const item = formatRelatedIssueQuickPickItem({
			...issue(339, 'Broken docs'),
			labels: [{ id: 1, name: 'documentation', color: '0052cc' }],
		});

		assert.strictEqual(item.label, '#339 Broken docs');
		assert.strictEqual(item.description, 'Open | @alice | Bug | TODO');
		assert.strictEqual(item.detail, 'documentation');
		assert.strictEqual(item.issueNumber, 339);
	});

	test('getAddableReviewers filters reviewers already assigned to the pull request', () => {
		const reviewers = getAddableReviewers([
			{ login: 'alice', name: 'Alice' },
			{ login: 'bob', name: 'Bob' },
		], ['alice']);

		assert.deepStrictEqual(reviewers.map((reviewer) => reviewer.login), ['bob']);
	});

	test('formatReviewerQuickPickItem includes reviewer profile metadata', () => {
		const item = formatReviewerQuickPickItem({
			login: 'alice',
			name: 'Alice',
			htmlUrl: 'https://gitcode.com/alice',
		});

		assert.strictEqual(item.label, '@alice');
		assert.strictEqual(item.description, 'Alice');
		assert.strictEqual(item.detail, 'https://gitcode.com/alice');
		assert.strictEqual(item.login, 'alice');
	});
});
