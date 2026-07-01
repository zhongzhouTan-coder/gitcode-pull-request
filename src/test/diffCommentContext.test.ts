import * as assert from 'assert';
import { PullRequestCommentsSnapshot, PullRequestFileChange } from '../common/models';
import { buildDiffCommentContexts } from '../view/overview/diffCommentContext';

suite('DiffCommentContext', () => {
	test('extracts a focused diff hunk around a diff comment line', () => {
		const snapshot: PullRequestCommentsSnapshot = {
			repositoryKey: 'org/repo',
			pullRequestNumber: 2,
			loadedAt: Date.now(),
			comments: [{
				kind: 'diff',
				id: 'comment-1',
				discussionId: 'discussion-1',
				body: 'Please update this branch.',
				author: { id: '1', login: 'alice' },
				createdAt: '2026-06-20T10:00:00+08:00',
				updatedAt: '2026-06-20T10:00:00+08:00',
				replies: [],
				resolved: false,
				isOutdated: false,
				location: {
					path: 'src/example.ts',
					side: 'head',
					startLine: 12,
					endLine: 12,
					positionType: 'text',
				},
			}],
		};
		const files: PullRequestFileChange[] = [{
			sha: 'abc',
			path: 'src/example.ts',
			status: 'modified',
			additions: 1,
			deletions: 1,
			tooLarge: false,
			patch: [
				'@@ -9,6 +9,6 @@',
				' const a = 1;',
				' const b = 2;',
				'-const branch = "old";',
				'+const branch = "new";',
				' const c = 3;',
				' const d = 4;',
			].join('\n'),
		}];

		const contexts = buildDiffCommentContexts(snapshot, files);
		const context = contexts.get('comment-1');

		assert.ok(context);
		assert.strictEqual(context.lines.length, 5);
		assert.deepStrictEqual(
			context.lines.map((line) => [line.kind, line.oldLine, line.newLine, line.content, line.isCommentLine]),
			[
				['context', 10, 10, 'const b = 2;', false],
				['delete', 11, undefined, 'const branch = "old";', false],
				['add', undefined, 11, 'const branch = "new";', false],
				['context', 12, 12, 'const c = 3;', true],
				['context', 13, 13, 'const d = 4;', false],
			],
		);
	});
});
