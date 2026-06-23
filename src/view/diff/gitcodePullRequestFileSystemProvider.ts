import * as vscode from 'vscode';
import { Logger } from '../../common/logger';
import { RawContentService } from '../../gitcode/services/rawContentService';
import { parsePrUri } from './prUriHelpers';

/**
 * Read-only FileSystemProvider that serves complete base and head file content
 * for VS Code's diff editor via gitcode-pr:// URIs.
 *
 * Each method throws FileSystemError.NoPermissions for write operations.
 */
export class GitCodePullRequestFileSystemProvider implements vscode.FileSystemProvider {
	private readonly onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile = this.onDidChangeFileEmitter.event;

	constructor(
		private readonly rawContentService: RawContentService,
		private readonly logger: Logger,
	) {}

	watch(_uri: vscode.Uri, _options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
		// Content is immutable; no need to watch.
		return new vscode.Disposable(() => {});
	}

	stat(uri: vscode.Uri): vscode.FileStat {
		const params = parsePrUri(uri);
		if (!params) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		if (params.side !== 'empty' && !params.sha) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		// Content is remote and immutable. Returning metadata without downloading
		// avoids fetching every side once for stat and again for readFile.
		return {
			type: vscode.FileType.File,
			ctime: 0,
			mtime: 0,
			size: 0,
		};
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const params = parsePrUri(uri);
		if (!params) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		// Empty side for added/deleted files
		if (params.side === 'empty') {
			return new Uint8Array(0);
		}

		if (!params.sha) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		try {
			const content = await this.rawContentService.getFileContent(
				params.owner,
				params.repo,
				params.sha,
				params.path,
			);
			return content;
		} catch (error) {
			this.logger.debug(`readFile failed for ${uri.toString()}: ${error instanceof Error ? error.message : String(error)}`);
			throw vscode.FileSystemError.FileNotFound(uri);
		}
	}

	readDirectory(_uri: vscode.Uri): [string, vscode.FileType][] {
		throw vscode.FileSystemError.NoPermissions('readDirectory is not supported');
	}

	createDirectory(_uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions('Cannot create directories in virtual PR content');
	}

	writeFile(_uri: vscode.Uri, _content: Uint8Array, _options: { readonly create: boolean; readonly overwrite: boolean }): void {
		throw vscode.FileSystemError.NoPermissions('Cannot write to virtual PR content');
	}

	delete(_uri: vscode.Uri, _options: { readonly recursive: boolean }): void {
		throw vscode.FileSystemError.NoPermissions('Cannot delete virtual PR content');
	}

	rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { readonly overwrite: boolean }): void {
		throw vscode.FileSystemError.NoPermissions('Cannot rename virtual PR content');
	}

	dispose(): void {
		this.onDidChangeFileEmitter.dispose();
	}
}
