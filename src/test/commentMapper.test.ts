import * as assert from 'assert';
import { mapListComment } from '../gitcode/mappers/commentMapper';

suite('CommentMapper', () => {
	test('maps resolved diff comments from the list API', () => {
		const comment = mapListComment({
			id: 176153829,
			discussion_id: '9035cc85d114b0e24b5b48104ecf51f94a901be2',
			body: 'Resolved thread',
			created_at: '2026-06-30T10:00:00Z',
			updated_at: '2026-06-30T10:00:00Z',
			comment_type: 'diff_comment',
			resolved: true,
			diff_position: {
				start_new_line: 24,
				end_new_line: 24,
				position_type: 'text',
			},
			user: {
				id: 1,
				login: 'alice',
			},
		});

		assert.ok(comment);
		assert.strictEqual(comment?.kind, 'diff');
		if (comment?.kind === 'diff') {
			assert.strictEqual(comment.resolved, true);
			assert.strictEqual(comment.location.startLine, 24);
		}
	});

	test('defaults missing resolved state to false for diff comments', () => {
		const comment = mapListComment({
			id: 176153830,
			discussion_id: 'discussion-2',
			body: 'Open thread',
			created_at: '2026-06-30T10:00:00Z',
			updated_at: '2026-06-30T10:00:00Z',
			comment_type: 'diff_comment',
			diff_position: {
				start_new_line: 30,
				end_new_line: 31,
				position_type: 'text',
			},
			user: {
				id: 2,
				login: 'bob',
			},
		});

		assert.ok(comment);
		assert.strictEqual(comment?.kind, 'diff');
		if (comment?.kind === 'diff') {
			assert.strictEqual(comment.resolved, false);
			assert.strictEqual(comment.location.startLine, 30);
			assert.strictEqual(comment.location.endLine, 31);
		}
	});
});