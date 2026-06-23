import * as vscode from 'vscode';
import { DEFAULT_PAGE_SIZE } from './constants';

export type FileListLayout = 'tree' | 'flat';

export interface ExtensionConfiguration {
	getBaseUrl(): string;
	getRawUrl(): string;
	getWebUrl(): string;
	getRepositoryOverride(): string | undefined;
	getPullRequestPageSize(): number;
	getPullRequestFileListLayout(): FileListLayout;
	getTraceServerEnabled(): boolean;
}

class VsCodeExtensionConfiguration implements ExtensionConfiguration {
	private get configuration(): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration('gitcode');
	}

	getBaseUrl(): string {
		return this.configuration.get<string>('baseUrl', 'https://api.gitcode.com');
	}

	getRawUrl(): string {
		return this.configuration.get<string>('rawUrl', 'https://raw.gitcode.com');
	}

	getWebUrl(): string {
		return this.configuration.get<string>('webUrl', 'https://gitcode.com');
	}

	getRepositoryOverride(): string | undefined {
		const value = this.configuration.get<string>('repository');
		return value?.trim() ? value.trim() : undefined;
	}

	getPullRequestPageSize(): number {
		return this.configuration.get<number>('pullRequests.pageSize', DEFAULT_PAGE_SIZE);
	}

	getPullRequestFileListLayout(): FileListLayout {
		return this.configuration.get<FileListLayout>('pullRequests.fileListLayout', 'tree');
	}

	getTraceServerEnabled(): boolean {
		return this.configuration.get<string>('trace.server', 'off') === 'verbose';
	}
}

export function getExtensionConfiguration(): ExtensionConfiguration {
	return new VsCodeExtensionConfiguration();
}
