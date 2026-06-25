import * as assert from 'assert';
import { mapIssueComment } from '../gitcode/mappers/issueCommentMapper';

suite('IssueCommentMapper', () => {
	test('maps a complete issue comment from the sample API response', () => {
		const comment = mapIssueComment({
			id: 176194985,
			body: '这里的日志在逐层量化场景都会有类似的日志，并不是报错。',
			user: {
				html_url: 'https://gitcode.com/yejiajun',
				id: '6822c9b2398335026946a660',
				object_id: '6822c9b2398335026946a660',
				login: 'yejiajun',
				name: 'yejj',
			},
			target: {
				issue: {
					id: 4098043,
					title: '',
					number: 309,
				},
			},
			created_at: '2026-06-18T09:52:04+08:00',
			updated_at: '2026-06-18T09:52:04+08:00',
		});

		assert.strictEqual(typeof comment.id, 'string');
		assert.strictEqual(comment.id, '176194985');
		assert.strictEqual(comment.body, '这里的日志在逐层量化场景都会有类似的日志，并不是报错。');
		assert.strictEqual(comment.author.login, 'yejiajun');
		assert.strictEqual(comment.author.name, 'yejj');
		assert.strictEqual(comment.author.htmlUrl, 'https://gitcode.com/yejiajun');
		assert.strictEqual(comment.author.id, '6822c9b2398335026946a660');
		assert.strictEqual(comment.createdAt, '2026-06-18T09:52:04+08:00');
		assert.strictEqual(comment.updatedAt, '2026-06-18T09:52:04+08:00');
		assert.strictEqual(comment.issueNumber, 309);
	});

	test('converts numeric IDs to strings', () => {
		const comment = mapIssueComment({
			id: 176916694,
			body: '/label add resolved',
			user: {
				login: 'yejiajun',
			},
			created_at: '2026-06-24T16:09:03+08:00',
			updated_at: '2026-06-24T16:09:03+08:00',
		});

		assert.strictEqual(comment.id, '176916694');
		assert.strictEqual(typeof comment.id, 'string');
	});

	test('maps author login and name, prefers login for identity', () => {
		const comment = mapIssueComment({
			id: 1,
			body: 'test',
			user: {
				login: 'anreywmh',
				name: 'anreywmh',
				html_url: 'https://gitcode.com/anreywmh',
			},
			created_at: '2026-06-16T11:29:28+08:00',
			updated_at: '2026-06-16T11:29:28+08:00',
		});

		assert.strictEqual(comment.author.login, 'anreywmh');
		assert.strictEqual(comment.author.name, 'anreywmh');
		assert.strictEqual(comment.author.htmlUrl, 'https://gitcode.com/anreywmh');
	});

	test('falls back to author name when login is missing', () => {
		const comment = mapIssueComment({
			id: 1,
			body: 'test',
			user: {
				name: 'display-name',
			},
			created_at: '2026-06-20T10:00:00+08:00',
			updated_at: '2026-06-20T10:00:00+08:00',
		});

		assert.strictEqual(comment.author.login, 'display-name');
		assert.strictEqual(comment.author.name, 'display-name');
	});

	test('tolerates missing user field', () => {
		const comment = mapIssueComment({
			id: 1,
			body: 'Anonymous comment',
			created_at: '2026-06-20T10:00:00+08:00',
			updated_at: '2026-06-20T10:00:00+08:00',
		});

		assert.strictEqual(comment.author.login, 'unknown');
		assert.strictEqual(comment.author.name, undefined);
		assert.strictEqual(comment.author.htmlUrl, undefined);
	});

	test('maps target.issue.number when present', () => {
		const comment = mapIssueComment({
			id: 1,
			body: 'test',
			user: { login: 'user' },
			target: {
				issue: {
					number: 42,
				},
			},
			created_at: '2026-06-20T10:00:00+08:00',
			updated_at: '2026-06-20T10:00:00+08:00',
		});

		assert.strictEqual(comment.issueNumber, 42);
	});

	test('maps missing body to empty string', () => {
		const comment = mapIssueComment({
			id: 1,
			user: { login: 'user' },
			created_at: '2026-06-20T10:00:00+08:00',
			updated_at: '2026-06-20T10:00:00+08:00',
		});

		assert.strictEqual(comment.body, '');
	});

	test('normalizes missing dates to empty strings', () => {
		const comment = mapIssueComment({
			id: 1,
			body: 'test',
			user: { login: 'user' },
		});

		assert.strictEqual(comment.createdAt, '');
		assert.strictEqual(comment.updatedAt, '');
	});

	test('maps author using object_id as fallback for id', () => {
		const comment = mapIssueComment({
			id: 1,
			body: 'test',
			user: {
				object_id: 'abc123',
				login: 'user',
			},
			created_at: '2026-06-20T10:00:00+08:00',
			updated_at: '2026-06-20T10:00:00+08:00',
		});

		assert.strictEqual(comment.author.id, 'abc123');
	});

	test('maps author avatar_url when present', () => {
		const comment = mapIssueComment({
			id: 1,
			body: 'test',
			user: {
				login: 'user',
				avatar_url: 'https://example.com/avatar.png',
			},
			created_at: '2026-06-20T10:00:00+08:00',
			updated_at: '2026-06-20T10:00:00+08:00',
		});

		assert.strictEqual(comment.author.avatarUrl, 'https://example.com/avatar.png');
	});
});
