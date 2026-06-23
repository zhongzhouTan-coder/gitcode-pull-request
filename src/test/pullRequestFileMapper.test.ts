import * as assert from 'assert';
import { mapPullRequestFile, mapPullRequestFiles } from '../gitcode/mappers/pullRequestFileMapper';

suite('PullRequestFileMapper', () => {
	test('maps a modified file when top-level status is absent', () => {
		const result = mapPullRequestFile({
			sha: 'abc123',
			filename: 'src/utils.ts',
			additions: 3,
			deletions: 2,
		});

		assert.strictEqual(result.sha, 'abc123');
		assert.strictEqual(result.path, 'src/utils.ts');
		assert.strictEqual(result.status, 'modified');
		assert.strictEqual(result.additions, 3);
		assert.strictEqual(result.deletions, 2);
		assert.strictEqual(result.previousPath, undefined);
		assert.strictEqual(result.patch, undefined);
		assert.strictEqual(result.tooLarge, false);
	});

	test('gives patch flags precedence over top-level status', () => {
		const result = mapPullRequestFile({
			sha: 'def456',
			filename: 'src/new.ts',
			status: 'modified',
			additions: 7,
			deletions: 0,
			patch: {
				new_file: true,
				renamed_file: false,
				deleted_file: false,
				too_large: false,
				diff: '@@ -0,0 +1,7 @@',
			},
		});

		assert.strictEqual(result.status, 'added');
		assert.strictEqual(result.patch, '@@ -0,0 +1,7 @@');
	});

	test('maps deleted file', () => {
		const result = mapPullRequestFile({
			sha: 'ghi789',
			filename: 'src/old.ts',
			additions: 0,
			deletions: 12,
			patch: {
				deleted_file: true,
				new_file: false,
				renamed_file: false,
				too_large: false,
				diff: '@@ -1,12 +0,0 @@',
			},
		});

		assert.strictEqual(result.status, 'deleted');
		assert.strictEqual(result.deletions, 12);
	});

	test('maps renamed file with previous path', () => {
		const result = mapPullRequestFile({
			sha: 'jkl012',
			filename: 'src/newdir/util.ts',
			status: 'renamed',
			additions: 2,
			deletions: 2,
			patch: {
				new_path: 'src/newdir/util.ts',
				old_path: 'src/util.ts',
				renamed_file: true,
				new_file: false,
				deleted_file: false,
				too_large: false,
				diff: '@@ -1,4 +1,4 @@',
			},
		});

		assert.strictEqual(result.status, 'renamed');
		assert.strictEqual(result.path, 'src/newdir/util.ts');
		assert.strictEqual(result.previousPath, 'src/util.ts');
	});

	test('resolves path from patch.new_path over filename', () => {
		const result = mapPullRequestFile({
			sha: 'mno345',
			filename: 'src/old.ts',
			additions: 1,
			deletions: 1,
			patch: {
				new_path: 'src/renamed.ts',
				old_path: 'src/old.ts',
				renamed_file: true,
				new_file: false,
				deleted_file: false,
				too_large: false,
			},
		});

		assert.strictEqual(result.path, 'src/renamed.ts');
	});

	test('normalizes missing counts, URLs, and patch text', () => {
		const result = mapPullRequestFile({
			sha: '',
			filename: 'src/empty.ts',
			additions: undefined as any,
			deletions: -1,
			blob_url: '',
			raw_url: '  ',
		});

		assert.strictEqual(result.additions, 0);
		assert.strictEqual(result.deletions, 0);
		assert.strictEqual(result.blobUrl, undefined);
		assert.strictEqual(result.rawUrl, undefined);
		assert.strictEqual(result.patch, undefined);
		assert.strictEqual(result.tooLarge, false);
	});

	test('preserves too_large even with patch present', () => {
		const result = mapPullRequestFile({
			sha: 'pqr678',
			filename: 'large.bin',
			additions: 0,
			deletions: 0,
			patch: {
				too_large: true,
				diff: 'some partial content',
				new_file: false,
				renamed_file: false,
				deleted_file: false,
			},
		});

		assert.strictEqual(result.tooLarge, true);
		assert.strictEqual(result.patch, 'some partial content');
	});

	test('maps source and target project info', () => {
		const result = mapPullRequestFile({
			sha: 'stu901',
			filename: 'src/file.ts',
			additions: 5,
			deletions: 3,
			source_branch: 'feature/x',
			target_branch: 'main',
			source_project: { full_name: 'alice/repo' },
			target_project: { full_name: 'org/repo' },
		});

		assert.strictEqual(result.sourceBranch, 'feature/x');
		assert.strictEqual(result.targetBranch, 'main');
		assert.strictEqual(result.sourceRepository, 'alice/repo');
		assert.strictEqual(result.targetRepository, 'org/repo');
	});

	test('mapPullRequestFiles maps array correctly', () => {
		const results = mapPullRequestFiles([
			{ sha: 'a1', filename: 'a.ts', additions: 1, deletions: 0 },
			{ sha: 'b2', filename: 'b.ts', additions: 0, deletions: 2, patch: { deleted_file: true, new_file: false, renamed_file: false, too_large: false } },
		]);

		assert.strictEqual(results.length, 2);
		assert.strictEqual(results[0].path, 'a.ts');
		assert.strictEqual(results[1].status, 'deleted');
	});
});
