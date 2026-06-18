import * as vscode from 'vscode';
import { DEFAULT_PAGE_SIZE } from './constants';

export interface ExtensionConfiguration {
	getBaseUrl(): string;
	getWebUrl(): string;
	getRepositoryOverride(): string | undefined;
	getPullRequestPageSize(): number;
	getTraceServerEnabled(): boolean;
}

class VsCodeExtensionConfiguration implements ExtensionConfiguration {
	private readonly configuration = vscode.workspace.getConfiguration('gitcode');

	getBaseUrl(): string {
		return this.configuration.get<string>('baseUrl', 'https://api.gitcode.com');
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

	getTraceServerEnabled(): boolean {
		return this.configuration.get<string>('trace.server', 'off') === 'verbose';
	}
}

export function getExtensionConfiguration(): ExtensionConfiguration {
	return new VsCodeExtensionConfiguration();
}
