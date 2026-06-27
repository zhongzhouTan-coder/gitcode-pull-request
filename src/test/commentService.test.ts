import * as assert from 'assert';
import { GitCodeRepository } from '../common/models';
import { Logger } from '../common/logger';
import { GitCodeClient } from '../gitcode/client/gitcodeClient';
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
		const client: GitCodeClient = {
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
});

function listDiffComment(id: string, createdAt: string): Record<string, unknown> {
	return {
		id,
		discussion_id: `discussion-${id}`,
		body: `Comment ${id}`,
		created_at: createdAt,
		updated_at: createdAt,
		comment_type: 'diff_comment',
		resolved: false,
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
