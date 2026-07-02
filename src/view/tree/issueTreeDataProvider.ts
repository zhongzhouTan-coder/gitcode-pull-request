import * as vscode from 'vscode';
import { ApiRequestError, AuthenticationFailedError, NotSignedInError, RepositoryNotOnGitCodeError, RepositoryResolutionError } from '../../common/errors';
import { Logger } from '../../common/logger';
import { IssueTreeStore } from '../state/issueTreeStore';
import { BaseNode } from './nodes/baseNode';
import { EmptyStateNode } from './nodes/emptyStateNode';
import { IssueRepositoryNode } from './nodes/issueRepositoryNode';

export class IssueTreeDataProvider implements vscode.TreeDataProvider<BaseNode> {
	private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<BaseNode | undefined | void>();

	readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

	constructor(
		private readonly store: IssueTreeStore,
		private readonly logger: Logger,
	) {
		this.store.onDidChange(() => {
			this.onDidChangeTreeDataEmitter.fire();
		});
	}

	getTreeItem(element: BaseNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element.getTreeItem();
	}

	async getChildren(element?: BaseNode): Promise<BaseNode[]> {
		if (element) {
			return element.getChildren();
		}

		try {
			const repositories = await this.store.getRepositories();
			if (!repositories.length) {
				if (this.store.isWaitingForRepository()) {
					return [new EmptyStateNode('Loading Git repository')];
				}

				return [new EmptyStateNode('No GitCode remote found', 'Set gitcode.repository to override the workspace repository.')];
			}

			return repositories.map((repository) => new IssueRepositoryNode(this.store, repository));
		} catch (error) {
			this.logRootLoadError(error);
			return [this.toRootErrorNode(error)];
		}
	}

	getParent(element: BaseNode): BaseNode | undefined {
		return element.parent;
	}

	async refresh(): Promise<void> {
		await this.store.refreshAll();
	}

	private toRootErrorNode(error: unknown): EmptyStateNode {
		if (error instanceof NotSignedInError) {
			return EmptyStateNode.signIn();
		}

		if (error instanceof AuthenticationFailedError) {
			return new EmptyStateNode('GitCode authentication failed');
		}

		if (error instanceof RepositoryNotOnGitCodeError) {
			return new EmptyStateNode('No GitCode remote found', 'Set gitcode.repository to override the workspace repository.');
		}

		if (error instanceof RepositoryResolutionError) {
			return new EmptyStateNode('Open a git repository to list issues', error.message);
		}

		if (error instanceof ApiRequestError) {
			const description = error.statusCode === 401 || error.statusCode === 403
				? 'Check your GitCode session'
				: `HTTP ${error.statusCode}`;
			return new EmptyStateNode('Unable to load issues', description);
		}

		if (error instanceof Error) {
			return new EmptyStateNode('Unable to load issues', error.message);
		}

		return new EmptyStateNode('Unable to load issues');
	}

	private logRootLoadError(error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		if (error instanceof RepositoryNotOnGitCodeError || error instanceof RepositoryResolutionError) {
			return;
		}

		this.logger.error(`Failed to load issue tree root: ${message}`);
	}
}
