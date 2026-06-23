import * as vscode from 'vscode';
import { GitCodeRepository } from '../../../common/models';
import { BaseNode } from './baseNode';

export class DirectoryNode extends BaseNode {
	readonly id: string;

	constructor(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		readonly dirPath: string,
		private readonly childrenSupplier: (dirPath: string) => BaseNode[],
		parent?: BaseNode,
	) {
		super(parent);
		this.id = `directory:${repository.fullName}:${pullRequestNumber}:${dirPath}`;
	}

	getTreeItem(): vscode.TreeItem {
		const item = new vscode.TreeItem(this.dirPath, vscode.TreeItemCollapsibleState.Collapsed);
		item.id = this.id;
		item.contextValue = 'directory';
		item.iconPath = vscode.ThemeIcon.Folder;
		return item;
	}

	getChildren(): BaseNode[] {
		return this.childrenSupplier(this.dirPath);
	}
}
