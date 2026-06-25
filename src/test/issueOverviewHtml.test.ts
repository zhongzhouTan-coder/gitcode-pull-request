import * as assert from 'assert';
import { IssueComment, IssueCommentsSnapshot, IssueDetail } from '../common/models';
import { getIssueOverviewHtml } from '../view/issueOverview/issueOverviewHtml';

suite('IssueOverviewHtml', () => {
	const detail: IssueDetail = {
		id: 1,
		number: 309,
		title: 'Quantization warning for Qwen3.6',
		state: 'open',
		body: 'This is the issue body.',
		author: { login: 'anreywmh' },
		assignees: [],
		labels: [],
		comments: 3,
		createdAt: '2026-06-16T11:29:28+08:00',
		updatedAt: '2026-06-16T11:29:28+08:00',
		repository: { fullName: 'Ascend/MindStudio-ModelSlim' },
	};

	const comments: IssueComment[] = [
		{
			id: '175866237',
			body: '👋 Hello!',
			author: { login: 'anreywmh', name: 'anreywmh' },
			createdAt: '2026-06-16T11:29:28+08:00',
			updatedAt: '2026-06-16T11:29:28+08:00',
			issueNumber: 309,
		},
		{
			id: '176194985',
			body: 'This is **markdown** content.',
			author: { login: 'yejiajun', name: 'yejj' },
			createdAt: '2026-06-18T09:52:04+08:00',
			updatedAt: '2026-06-18T09:52:04+08:00',
			issueNumber: 309,
		},
	];

	const commentsSnapshot: IssueCommentsSnapshot = {
		repositoryKey: 'Ascend/MindStudio-ModelSlim',
		issueNumber: 309,
		comments,
		loadedAt: Date.now(),
	};

	test('renders a Conversation section with comment count', () => {
		const html = getIssueOverviewHtml({
			detail,
			comments: commentsSnapshot,
			nonce: 'test-nonce',
			includeScripts: false,
		});

		assert.match(html, /Conversation \(2\)/);
	});

	test('renders comment bodies through markdown', () => {
		const html = getIssueOverviewHtml({
			detail,
			comments: commentsSnapshot,
			nonce: 'test-nonce',
			includeScripts: false,
		});

		// The second comment has markdown bold
		assert.match(html, /<strong>markdown<\/strong>/);
	});

	test('escapes author names in comments', () => {
		const maliciousSnapshot: IssueCommentsSnapshot = {
			repositoryKey: 'org/repo',
			issueNumber: 1,
			comments: [{
				id: '1',
				body: 'test',
				author: { login: '<script>alert("xss")</script>' },
				createdAt: '2026-06-20T10:00:00+08:00',
				updatedAt: '2026-06-20T10:00:00+08:00',
			}],
			loadedAt: Date.now(),
		};

		const html = getIssueOverviewHtml({
			detail: { ...detail, body: '' },
			comments: maliciousSnapshot,
			nonce: 'test-nonce',
			includeScripts: false,
		});

		// The raw script tag should not appear
		assert.doesNotMatch(html, /<script>alert/);
		assert.match(html, /&lt;script&gt;alert/);
	});

	test('renders empty comments state', () => {
		const emptySnapshot: IssueCommentsSnapshot = {
			repositoryKey: 'org/repo',
			issueNumber: 1,
			comments: [],
			loadedAt: Date.now(),
		};

		const html = getIssueOverviewHtml({
			detail: { ...detail, body: '' },
			comments: emptySnapshot,
			nonce: 'test-nonce',
			includeScripts: false,
		});

		assert.match(html, /No comments yet/);
	});

	test('renders comments error state', () => {
		const html = getIssueOverviewHtml({
			detail: { ...detail, body: '' },
			commentsError: new Error('Network failure'),
			nonce: 'test-nonce',
			includeScripts: false,
		});

		assert.match(html, /Unable to load comments/);
	});

	test('renders issue detail when comments are missing', () => {
		const html = getIssueOverviewHtml({
			detail,
			nonce: 'test-nonce',
			includeScripts: false,
		});

		// Issue body should be rendered
		assert.match(html, /This is the issue body/);
		// No conversation section should appear
		assert.doesNotMatch(html, /Conversation/);
	});

	test('renders comment body with escaped content', () => {
		const html = getIssueOverviewHtml({
			detail: { ...detail, body: '' },
			comments: {
				repositoryKey: 'org/repo',
				issueNumber: 1,
				comments: [{
					id: '1',
					body: 'Hello & welcome',
					author: { login: 'user' },
					createdAt: '2026-06-20T10:00:00+08:00',
					updatedAt: '2026-06-20T10:00:00+08:00',
				}],
				loadedAt: Date.now(),
			},
			nonce: 'test-nonce',
			includeScripts: false,
		});

		// The markdown renderer should handle the & properly
		assert.match(html, /Hello &amp; welcome/);
	});
});
