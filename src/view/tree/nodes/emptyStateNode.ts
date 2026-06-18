import * as vscode from 'vscode';
import { BaseNode } from './baseNode';

export class EmptyStateNode extends BaseNode {
	readonly id: string;

	constructor(
		private readonly label: string,
		private readonly description?: string,
		private readonly command?: vscode.Command,
		parent?: BaseNode,
	) {
		super(parent);
		this.id = `empty:${label}:${description ?? ''}`;
	}

	getTreeItem(): vscode.TreeItem {
		const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.None);
		item.description = this.description;
		item.contextValue = 'emptyState';
		item.command = this.command;
		return item;
	}

	getChildren(): BaseNode[] {
		return [];
	}
}
