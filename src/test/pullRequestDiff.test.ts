import * as assert from 'assert';
import * as vscode from 'vscode';
import { mapDiffSnapshot } from '../gitcode/mappers/pullRequestDiffSnapshotMapper';
import { RawContentService } from '../gitcode/services/rawContentService';
import { createDiffCommentInput, validateDiffCommentDraft } from '../view/comments/diffCommentController';
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

	test('maps zero-based editor lines to one-based diff comment positions', () => {
		const uri = buildPrUri({
			owner: 'org',
			repo: 'repo',
			pullRequestNumber: 7,
			side: 'head',
			sha: 'headsha',
			path: 'src/example.ts',
		});

		const input = createDiffCommentInput(uri, new vscode.Range(4, 0, 4, 5), 'Inline note');

		assert.deepStrictEqual(input, {
			kind: 'diff',
			body: 'Inline note',
			path: 'src/example.ts',
			position: 5,
			positionType: 'text',
		});
	});

	test('rejects base-side diff comments before submission', () => {
		const uri = buildPrUri({
			owner: 'org',
			repo: 'repo',
			pullRequestNumber: 7,
			side: 'base',
			sha: 'basesha',
			path: 'src/example.ts',
		});

		assert.deepStrictEqual(
			validateDiffCommentDraft(uri, new vscode.Range(0, 0, 0, 0), 'Inline note'),
			['Comments are only supported on the head side of a pull request diff.'],
		);
	});

	test('rejects non-pull-request documents before submission', () => {
		assert.deepStrictEqual(
			validateDiffCommentDraft(vscode.Uri.file('/tmp/example.ts'), new vscode.Range(0, 0, 0, 0), 'Inline note'),
			['Only pull request diff documents support comments.'],
		);
	});

	test('rejects stale diff comment snapshots before submission', () => {
		const uri = buildPrUri({
			owner: 'org',
			repo: 'repo',
			pullRequestNumber: 7,
			side: 'head',
			sha: 'oldhead',
			path: 'src/example.ts',
		});

		assert.deepStrictEqual(
			validateDiffCommentDraft(uri, new vscode.Range(0, 0, 0, 0), 'Inline note', 'newhead'),
			['This diff is out of date. Refresh the pull request diff before commenting.'],
		);
	});
});
