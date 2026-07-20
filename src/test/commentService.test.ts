import * as assert from 'assert';
import { CreatePullRequestCommentInput, GitCodeRepository } from '../common/models';
import { Logger } from '../common/logger';
import { GitCodeDeleteClient } from '../gitcode/client/gitcodeClient';
import { CommentService } from '../gitcode/services/commentService';

suite('CommentService', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	test('limits comments before enriching diff comment details', async () => {
		const detailCalls: string[] = [];
		const client: GitCodeDeleteClient = {
			get: async <T>(path: string): Promise<T> => {
				if (path.includes('/pulls/comments/')) {
					const id = path.split('/').pop() ?? '';
					detailCalls.push(id);
					return {
						id,
						discussion_id: `discussion-${id}`,
						comment_type: 'DiffNote',
						is_outdated: false,
						position: {
							new_path: `src/${id}.ts`,
							new_line: 10,
							position_type: 'text',
						},
					} as T;
				}

				return [
					listDiffComment('old', '2026-01-01T00:00:00Z'),
					listDiffComment('newest', '2026-01-03T00:00:00Z'),
					listDiffComment('middle', '2026-01-02T00:00:00Z'),
				] as T;
			},
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};
		const logger = { debug: () => undefined, error: () => undefined } as unknown as Logger;
		const service = new CommentService(client, logger);

		const comments = await service.listPullRequestComments(repository, 1, {
			limit: 2,
			newestFirst: true,
		});

		assert.deepStrictEqual(detailCalls, ['newest', 'middle']);
		assert.deepStrictEqual(comments.map((comment) => comment.id), ['newest', 'middle']);
		assert.strictEqual(comments[0].kind, 'diff');
		if (comments[0].kind === 'diff') {
			assert.strictEqual(comments[0].location.path, 'src/newest.ts');
		}
	});

	test('preserves resolved state when enriching diff comments', async () => {
		const client: GitCodeDeleteClient = {
			get: async <T>(path: string): Promise<T> => {
				if (path.includes('/pulls/comments/')) {
					return {
						id: 'resolved-thread',
						discussion_id: 'discussion-resolved-thread',
						comment_type: 'DiffNote',
						is_outdated: true,
						position: {
							new_path: 'src/resolved-thread.ts',
							new_line: 24,
							position_type: 'text',
						},
					} as T;
				}

				return [listDiffComment('resolved-thread', '2026-01-03T00:00:00Z', true)] as T;
			},
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};
		const logger = { debug: () => undefined, error: () => undefined } as unknown as Logger;
		const service = new CommentService(client, logger);

		const comments = await service.listPullRequestComments(repository, 1);

		assert.strictEqual(comments.length, 1);
		assert.strictEqual(comments[0].kind, 'diff');
		if (comments[0].kind === 'diff') {
			assert.strictEqual(comments[0].resolved, true);
			assert.strictEqual(comments[0].isOutdated, true);
			assert.strictEqual(comments[0].location.path, 'src/resolved-thread.ts');
		}
	});

	test('loads pull request comments across paginated result pages', async () => {
		const listCalls: Array<{ path: string; query?: Record<string, string | number | boolean | undefined> }> = [];
		const client: GitCodeDeleteClient = {
			get: async <T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> => {
				if (path.includes('/pulls/comments/')) {
					const id = path.split('/').pop() ?? '';
					return {
						id,
						discussion_id: `discussion-${id}`,
						comment_type: 'DiffNote',
						is_outdated: false,
						position: {
							new_path: `src/${id}.ts`,
							new_line: 10,
							position_type: 'text',
						},
					} as T;
				}

				listCalls.push({ path, query });
				const page = query?.page;
				const count = page === 1 ? 100 : page === 2 ? 1 : 0;
				return Array.from({ length: count }, (_, index) => listGeneralComment(`page-${page}-${index}`, '2026-01-03T00:00:00Z')) as T;
			},
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};
		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);

		const comments = await service.listPullRequestComments(repository, 1);

		assert.strictEqual(comments.length, 101);
		assert.deepStrictEqual(listCalls.map((call) => call.query), [
			{ per_page: 100, page: 1 },
			{ per_page: 100, page: 2 },
		]);
	});

	test('creates a pull request conversation comment with body only', async () => {
		const calls: Array<{ path: string; body: unknown }> = [];
		const client: GitCodeDeleteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(path: string, body?: unknown): Promise<T> => {
				calls.push({ path, body });
				return {
					id: 'comment-1',
					body: 'Looks good to me.',
					note_id: 12,
				} as T;
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		const result = await service.createPullRequestComment(repository, 3, {
			kind: 'pullRequest',
			body: 'Looks good to me.',
		});

		assert.deepStrictEqual(calls, [{
			path: '/api/v5/repos/org/repo/pulls/3/comments',
			body: { body: 'Looks good to me.' },
		}]);
		assert.deepStrictEqual(result, { id: 'comment-1', noteId: 12, body: 'Looks good to me.' });
	});

	test('creates an inline diff comment with path position and text type', async () => {
		const calls: unknown[] = [];
		const client: GitCodeDeleteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(_path: string, body?: unknown): Promise<T> => {
				calls.push(body);
				return { id: 'comment-2', body: 'Inline', note_id: 22 } as T;
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		await service.createPullRequestComment(repository, 3, {
			kind: 'diff',
			body: 'Inline',
			path: 'src/example.ts',
			position: 16,
			positionType: 'text',
		});

		assert.deepStrictEqual(calls, [{
			body: 'Inline',
			path: 'src/example.ts',
			position: 16,
			position_type: 'text',
		}]);
	});

	test('omits position for binary file comments', async () => {
		const calls: unknown[] = [];
		const client: GitCodeDeleteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(_path: string, body?: unknown): Promise<T> => {
				calls.push(body);
				return { id: 'comment-3', body: 'Binary' } as T;
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		await service.createPullRequestComment(repository, 3, {
			kind: 'file',
			body: 'Binary',
			path: 'dist/app.bin',
			positionType: 'binary',
		});

		assert.deepStrictEqual(calls, [{
			body: 'Binary',
			path: 'dist/app.bin',
			position_type: 'binary',
		}]);
	});

	test('edits a pull request comment via PATCH with comment ID and body', async () => {
		const calls: Array<{ path: string; body: unknown }> = [];
		const client: GitCodeDeleteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(path: string, body?: unknown): Promise<T> => {
				calls.push({ path, body });
				return {} as T;
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		await service.editPullRequestComment(repository, {
			commentId: 'comment-42',
			body: 'Updated comment body.',
		});

		assert.deepStrictEqual(calls, [{
			path: '/api/v5/repos/org/repo/pulls/comments/comment-42',
			body: { body: 'Updated comment body.' },
		}]);
	});

	test('editPullRequestComment rejects empty body', async () => {
		let called = false;
		const client: GitCodeDeleteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				called = true;
				return {} as T;
			},
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		await assert.rejects(
			() => service.editPullRequestComment(repository, { commentId: 'c-1', body: '   ' }),
			/Comment body is required\./,
		);
		assert.strictEqual(called, false);
	});

	test('editPullRequestComment rejects empty commentId', async () => {
		const client: GitCodeDeleteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		await assert.rejects(
			() => service.editPullRequestComment(repository, { commentId: '', body: 'body' }),
			/commentId is required\./,
		);
	});

	test('rejects empty bodies before calling the API', async () => {
		let called = false;
		const client: GitCodeDeleteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(): Promise<T> => {
				called = true;
				return {} as T;
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		await assert.rejects(async () => service.createPullRequestComment(repository, 3, {
			kind: 'pullRequest',
			body: '   ',
		} as CreatePullRequestCommentInput), /Comment body is required\./);
		assert.strictEqual(called, false);
	});

	test('replyPullRequestComment validates empty body and missing discussionId', async () => {
		let posted = false;
		const client: GitCodeDeleteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(): Promise<T> => {
				posted = true;
				return {} as T;
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);

		await assert.rejects(
			() => service.replyPullRequestComment(repository, 1, { discussionId: '', body: 'reply' }),
			/discussionId is required\./,
		);
		assert.strictEqual(posted, false);

		await assert.rejects(
			() => service.replyPullRequestComment(repository, 1, { discussionId: 'disc-1', body: '   ' }),
			/Reply body is required\./,
		);
		assert.strictEqual(posted, false);
	});

	test('replyPullRequestComment posts to the correct endpoint with body', async () => {
		const calls: Array<{ path: string; body: unknown }> = [];
		const client: GitCodeDeleteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(path: string, body?: unknown): Promise<T> => {
				calls.push({ path, body });
				return {
					id: 'reply-id-1',
					body: 'test reply',
					note_id: 178162257,
				} as T;
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		const body = '  test reply\n';
		const result = await service.replyPullRequestComment(repository, 3, {
			discussionId: 'disc-abc',
			body,
		});

		assert.deepStrictEqual(calls, [{
			path: '/api/v5/repos/org/repo/pulls/3/discussions/disc-abc/comments',
			body: { body },
		}]);
		assert.deepStrictEqual(result, { id: 'reply-id-1', noteId: 178162257, body: 'test reply' });
	});

	test('replyPullRequestComment handles missing id in response', async () => {
		const client: GitCodeDeleteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(): Promise<T> => {
				return { note_id: 1 } as T;
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			delete: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
				throw new Error('Not implemented');
			},
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		await assert.rejects(
			() => service.replyPullRequestComment(repository, 1, { discussionId: 'disc-1', body: 'reply' }),
			/Failed to map reply pull request comment: missing id\./,
		);
	});
});

function listDiffComment(id: string, createdAt: string, resolved: boolean = false): Record<string, unknown> {
	return {
		id,
		discussion_id: `discussion-${id}`,
		body: `Comment ${id}`,
		created_at: createdAt,
		updated_at: createdAt,
		comment_type: 'diff_comment',
		resolved,
		diff_position: {
			start_new_line: 10,
			end_new_line: 10,
			position_type: 'text',
		},
		user: {
			id: 'user-1',
			login: 'alice',
		},
	};
}

function listGeneralComment(id: string, createdAt: string): Record<string, unknown> {
	return {
		id,
		discussion_id: `discussion-${id}`,
		body: `Comment ${id}`,
		created_at: createdAt,
		updated_at: createdAt,
		comment_type: 'pr_comment',
		user: {
			id: 'user-1',
			login: 'alice',
		},
	};
}
