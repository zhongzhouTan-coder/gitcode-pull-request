import * as assert from 'assert';
import * as vscode from 'vscode';
import { mapDiffSnapshot } from '../gitcode/mappers/pullRequestDiffSnapshotMapper';
import { RawContentService } from '../gitcode/services/rawContentService';
import { GitCodePullRequestFileSystemProvider } from '../view/diff/gitcodePullRequestFileSystemProvider';
import { buildPrUri } from '../view/diff/prUriHelpers';

suite('PullRequestDiff', () => {
	test('maps file types from nested files.json diffs', () => {
		const snapshot = mapDiffSnapshot({
			diff_refs: {
				base_sha: '0844e66715835ea9dfcfa8ffff88fa5e03a46291',
				head_sha: '169338a869599b5e7abf82f2fdf9399ee4c4bdab',
			},
			diffs: [
				{
					statistic: {
						type: 'text_type',
						path: 'src/file.ts',
						old_path: 'src/file.ts',
						new_path: 'src/file.ts',
					},
				},
				{
					statistic: {
						type: 'image_type',
						path: 'assets/logo.png',
						old_path: 'assets/old-logo.png',
						new_path: 'assets/logo.png',
					},
				},
			],
		});

		assert.strictEqual(snapshot.fileTypes.get('src/file.ts'), 'text_type');
		assert.strictEqual(snapshot.fileTypes.get('assets/logo.png'), 'image_type');
	});

	test('stat does not download remote content', () => {
		let reads = 0;
		const rawContentService = {
			getFileContent: async () => {
				reads += 1;
				return new Uint8Array([1, 2, 3]);
			},
		} as unknown as RawContentService;
		const logger = {
			debug: () => undefined,
		} as any;
		const provider = new GitCodePullRequestFileSystemProvider(rawContentService, logger);
		const uri = buildPrUri({
			owner: 'owner',
			repo: 'repo',
			pullRequestNumber: 1,
			side: 'head',
			sha: '169338a869599b5e7abf82f2fdf9399ee4c4bdab',
			path: 'src/file.ts',
		});

		const stat = provider.stat(uri);

		assert.strictEqual(stat.type, vscode.FileType.File);
		assert.strictEqual(stat.size, 0);
		assert.strictEqual(reads, 0);
		provider.dispose();
	});
});
