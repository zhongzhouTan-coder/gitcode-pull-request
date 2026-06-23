import * as vscode from 'vscode';
import { Logger } from '../../common/logger';
import { GitCodeRepository, PullRequestFileChange } from '../../common/models';
import { PullRequestDiffStore } from './pullRequestDiffStore';
import { PullRequestPatchContentProvider } from './pullRequestPatchContentProvider';
import { buildPrUri, buildEmptyPrUri, buildDiffTitle } from './prUriHelpers';

/**
 * Orchestrates opening a native VS Code diff for a pull request file.
 *
 * Flow:
 * 1. Validates the file is supported (not too large, not binary).
 * 2. Fetches or retrieves the cached diff snapshot (base/head SHAs).
 * 3. Constructs base and head virtual URIs based on file status.
 * 4. Invokes vscode.diff with the two URIs.
 */
export class PullRequestDiffController {
	constructor(
		private readonly diffStore: PullRequestDiffStore,
		private readonly patchContentProvider: PullRequestPatchContentProvider,
		private readonly logger: Logger,
	) {}

	async openDiff(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		file: PullRequestFileChange,
	): Promise<void> {
		// Reject unsupported files before loading any content
		if (file.tooLarge) {
			await this.fallbackToWeb(file, 'File is too large to diff in the editor.');
			return;
		}

		if (!file.sha) {
			await this.fallbackToWeb(file, 'File has no head SHA.');
			return;
		}

		// Fetch the diff snapshot (shared across concurrent opens)
		let snapshot;
		try {
			snapshot = await this.diffStore.getOrFetch(repository, pullRequestNumber);
		} catch (error) {
			this.logger.error(
				`Failed to fetch diff snapshot for PR #${pullRequestNumber}: ${error instanceof Error ? error.message : String(error)}`,
			);
			await this.fallbackToPatch(repository, pullRequestNumber, file);
			return;
		}

		// Verify head SHA consistency
		if (file.sha !== snapshot.refs.headSha) {
			this.logger.error(
				`Refusing stale diff for ${file.path}: file head ${file.sha.substring(0, 7)} differs from snapshot head ${snapshot.refs.headSha.substring(0, 7)}.`,
			);
			this.diffStore.invalidate(repository.fullName, pullRequestNumber);
			void vscode.window.showWarningMessage(
				`Pull request #${pullRequestNumber} changed. Refresh its files and try again.`,
			);
			return;
		}

		const fileType = snapshot.fileTypes.get(file.path)
			?? (file.previousPath ? snapshot.fileTypes.get(file.previousPath) : undefined);
		if (fileType && fileType !== 'text_type') {
			await this.fallbackToWeb(file, `File type ${fileType} is not supported by the text diff editor.`);
			return;
		}

		const { baseSha, headSha } = snapshot.refs;
		const { owner, name: repo } = repository;

		// Construct URIs based on file status
		let baseUri: vscode.Uri;
		let headUri: vscode.Uri;
		const title = buildDiffTitle(file.path, pullRequestNumber);

		switch (file.status) {
			case 'added':
				baseUri = buildEmptyPrUri(owner, repo, pullRequestNumber, file.path);
				headUri = buildPrUri({ owner, repo, pullRequestNumber, side: 'head', sha: headSha, path: file.path });
				break;
			case 'deleted':
				baseUri = buildPrUri({ owner, repo, pullRequestNumber, side: 'base', sha: baseSha, path: file.path });
				headUri = buildEmptyPrUri(owner, repo, pullRequestNumber, file.path);
				break;
			case 'renamed':
				baseUri = buildPrUri({
					owner,
					repo,
					pullRequestNumber,
					side: 'base',
					sha: baseSha,
					path: file.previousPath ?? file.path,
				});
				headUri = buildPrUri({ owner, repo, pullRequestNumber, side: 'head', sha: headSha, path: file.path });
				break;
			case 'modified':
			default:
				baseUri = buildPrUri({ owner, repo, pullRequestNumber, side: 'base', sha: baseSha, path: file.path });
				headUri = buildPrUri({ owner, repo, pullRequestNumber, side: 'head', sha: headSha, path: file.path });
				break;
		}

		try {
			await vscode.commands.executeCommand(
				'vscode.diff',
				baseUri,
				headUri,
				title,
				{ preview: true },
			);
		} catch (error) {
			this.logger.error(
				`Failed to open diff for ${file.path}: ${error instanceof Error ? error.message : String(error)}`,
			);
			// Fall back to patch-based editor
			await this.fallbackToPatch(repository, pullRequestNumber, file);
		}
	}

	private async fallbackToWeb(file: PullRequestFileChange, reason: string): Promise<void> {
		this.logger.debug(`Falling back to web for ${file.path}: ${reason}`);
		if (file.blobUrl) {
			try {
				const uri = vscode.Uri.parse(file.blobUrl);
				if (uri.scheme === 'https') {
					await vscode.env.openExternal(uri);
					return;
				}
			} catch {
				// Ignore — web fallback not available
			}
		}

		void vscode.window.showWarningMessage(`Cannot diff ${file.path}: ${reason}`);
	}

	private async fallbackToPatch(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		file: PullRequestFileChange,
	): Promise<void> {
		if (file.patch) {
			try {
				const uri = this.patchContentProvider.registerPatch(file, repository.fullName, pullRequestNumber);
				const document = await vscode.workspace.openTextDocument(uri);
				await vscode.languages.setTextDocumentLanguage(document, 'diff');
				await vscode.window.showTextDocument(document, { preview: true });
				return;
			} catch (error) {
				this.logger.error(
					`Failed to open patch fallback for ${file.path}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		await this.fallbackToWeb(file, 'The complete file content and patch are unavailable.');
	}
}
