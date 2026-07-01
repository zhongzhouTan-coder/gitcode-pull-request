import * as assert from 'assert';
import { CreatePullRequestCommentInput, GitCodeRepository } from '../common/models';
import { Logger } from '../common/logger';
import { GitCodeWriteClient } from '../gitcode/client/gitcodeClient';
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
		const client: GitCodeWriteClient = {
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
		const client: GitCodeWriteClient = {
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

	test('creates a pull request conversation comment with body only', async () => {
		const calls: Array<{ path: string; body: unknown }> = [];
		const client: GitCodeWriteClient = {
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
		const client: GitCodeWriteClient = {
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
		const client: GitCodeWriteClient = {
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
		const client: GitCodeWriteClient = {
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
		const client: GitCodeWriteClient = {
			get: async <T>(): Promise<T> => [] as T,
			post: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			put: async <T>(): Promise<T> => {
				throw new Error('Not implemented');
			},
			patch: async <T>(): Promise<T> => {
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
		const client: GitCodeWriteClient = {
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
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		await assert.rejects(
			() => service.editPullRequestComment(repository, { commentId: '', body: 'body' }),
			/commentId is required\./,
		);
	});

	test('rejects empty bodies before calling the API', async () => {
		let called = false;
		const client: GitCodeWriteClient = {
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
		};

		const service = new CommentService(client, { debug: () => undefined, error: () => undefined } as unknown as Logger);
		await assert.rejects(async () => service.createPullRequestComment(repository, 3, {
			kind: 'pullRequest',
			body: '   ',
		} as CreatePullRequestCommentInput), /Comment body is required\./);
		assert.strictEqual(called, false);
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
