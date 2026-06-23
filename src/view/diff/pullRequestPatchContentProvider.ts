import * as vscode from 'vscode';
import { PR_DIFF_SCHEME } from '../../common/constants';
import { PullRequestFileChange } from '../../common/models';

export class PullRequestPatchContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	private readonly patches = new Map<string, PullRequestFileChange>();

	registerPatch(file: PullRequestFileChange, repository: string, pullRequestNumber: number): vscode.Uri {
		const key = this.makeKey(repository, pullRequestNumber, file.path, file.sha);
		this.patches.set(key, file);
		const uri = this.buildUri(repository, pullRequestNumber, file.path, file.sha);
		this.onDidChangeEmitter.fire(uri);
		return uri;
	}

	provideTextDocumentContent(uri: vscode.Uri): string | undefined {
		const params = this.parseUri(uri);
		if (!params) {
			return undefined;
		}

		const key = this.makeKey(params.repository, params.pullRequestNumber, params.filePath, params.sha);
		const patch = this.patches.get(key);
		if (!patch?.patch) {
			return undefined;
		}

		return patch.patch;
	}

	getFileTitle(filePath: string, pullRequestNumber: number): string {
		const segments = filePath.split('/');
		const fileName = segments[segments.length - 1];
		return `${fileName} (Pull Request #${pullRequestNumber})`;
	}

	dispose(): void {
		this.patches.clear();
		this.onDidChangeEmitter.dispose();
	}

	private buildUri(repository: string, pullRequestNumber: number, filePath: string, sha: string): vscode.Uri {
		return vscode.Uri.from({
			scheme: PR_DIFF_SCHEME,
			path: `/${encodeURIComponent(repository)}/${pullRequestNumber}/${encodeURIComponent(filePath)}`,
			query: `sha=${encodeURIComponent(sha)}`,
		});
	}

	private parseUri(uri: vscode.Uri): { repository: string; pullRequestNumber: number; filePath: string; sha: string } | undefined {
		if (uri.scheme !== PR_DIFF_SCHEME) {
			return undefined;
		}

		const parts = uri.path.split('/').filter(Boolean);
		if (parts.length < 3) {
			return undefined;
		}

		const pullRequestNumber = Number(parts[1]);
		if (isNaN(pullRequestNumber)) {
			return undefined;
		}

		const repository = decodeURIComponent(parts[0]);
		const sha = uri.query.startsWith('sha=') ? decodeURIComponent(uri.query.slice(4)) : '';
		const filePath = decodeURIComponent(parts.slice(2).join('/'));

		return { repository, pullRequestNumber, filePath, sha };
	}

	private makeKey(repository: string, pullRequestNumber: number, filePath: string, sha: string): string {
		return `${repository}#${pullRequestNumber}#${filePath}#${sha}`;
	}
}
