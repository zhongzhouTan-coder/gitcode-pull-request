import * as vscode from 'vscode';

export interface GitRemote {
	name: string;
	fetchUrl?: string;
	pushUrl?: string;
}

export interface GitRepository {
	rootUri: vscode.Uri;
	state: {
		HEAD?: {
			name?: string;
		};
		remotes: GitRemote[];
	};
}

export interface GitApi {
	repositories: GitRepository[];
	onDidOpenRepository: vscode.Event<GitRepository>;
	onDidCloseRepository: vscode.Event<GitRepository>;
}

export interface GitExtension {
	getAPI(version: 1): GitApi;
}
