import * as vscode from 'vscode';
import { GitCodeRepository } from '../../../common/models';
import { IssueTreeStore } from '../../state/issueTreeStore';
import { BaseNode } from './baseNode';
import { IssueCategoryNode } from './issueCategoryNode';

export class IssueRepositoryNode extends BaseNode {
	readonly id: string;

	constructor(
		private readonly store: IssueTreeStore,
		readonly repository: GitCodeRepository,
		parent?: BaseNode,
	) {
		super(parent);
		this.id = `issueRepository:${repository.fullName}`;
	}

	getTreeItem(): vscode.TreeItem {
		const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.Expanded);
		item.id = this.id;
		item.contextValue = 'issueRepository';
		item.tooltip = this.repository.webUrl;
		item.iconPath = new vscode.ThemeIcon('repo');
		return item;
	}

	getChildren(): BaseNode[] {
		return this.store
			.getCategories(this.repository)
			.map((category) => new IssueCategoryNode(this.store, this.repository, category.key, category.label, this));
	}

	private get label(): string {
		if (this.repository.remoteName === 'override') {
			return this.repository.fullName;
		}

		return `${this.repository.fullName} (${this.repository.remoteName})`;
	}
}
