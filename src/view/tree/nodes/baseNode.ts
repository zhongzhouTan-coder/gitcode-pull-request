import * as vscode from 'vscode';

export abstract class BaseNode {
	constructor(readonly parent?: BaseNode) {}

	abstract readonly id: string;

	abstract getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem>;

	abstract getChildren(): BaseNode[] | Promise<BaseNode[]>;
}
