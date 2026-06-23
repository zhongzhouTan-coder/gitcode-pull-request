import * as vscode from 'vscode';
import { COMMAND_ID } from '../../../common/constants';
import { GitCodeRepository, PullRequestFileChange } from '../../../common/models';
import { BaseNode } from './baseNode';

export interface PullRequestFileNodeContext {
	repository: GitCodeRepository;
	pullRequestNumber: number;
	file: PullRequestFileChange;
}

export class PullRequestFileNode extends BaseNode {
	readonly id: string;
	readonly context: PullRequestFileNodeContext;

	constructor(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		readonly file: PullRequestFileChange,
		private readonly layout: 'tree' | 'flat',
		parent?: BaseNode,
	) {
		super(parent);
		this.id = `pullRequestFile:${repository.fullName}:${pullRequestNumber}:${file.sha}:${file.path}`;
		this.context = { repository, pullRequestNumber, file };
	}

	getTreeItem(): vscode.TreeItem {
		const label = this.layout === 'tree' ? this.baseName() : this.file.path;
		const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
		item.id = this.id;
		item.contextValue = `pullRequestFile:${this.file.status}${this.file.tooLarge ? ':tooLarge' : ''}`;
		item.description = this.describe();
		item.tooltip = this.buildTooltip();
		item.command = {
			command: COMMAND_ID.openPullRequestFile,
			title: 'Open File',
			arguments: [this.context],
		};
		item.resourceUri = vscode.Uri.parse(`gitcode-file://${this.file.path}`);
		return item;
	}

	getChildren(): BaseNode[] {
		return [];
	}

	private baseName(): string {
		const segments = this.file.path.split('/');
		return segments[segments.length - 1];
	}

	private describe(): string {
		const status = this.statusAbbreviation();
		if (this.file.status === 'renamed' && this.file.previousPath) {
			return `${status} ${this.file.previousPath} → ${this.file.path}  +${this.file.additions} -${this.file.deletions}`;
		}

		return `${status}  +${this.file.additions} -${this.file.deletions}`;
	}

	private statusAbbreviation(): string {
		switch (this.file.status) {
			case 'added': return 'A';
			case 'modified': return 'M';
			case 'deleted': return 'D';
			case 'renamed': return 'R';
		}
	}

	private buildTooltip(): vscode.MarkdownString {
		const lines = [
			`**${this.file.path}**`,
		];

		if (this.file.previousPath) {
			lines.push(`Renamed from: ${this.file.previousPath}`);
		}

		lines.push(`Status: ${this.file.status}`);
		lines.push(`Additions: ${this.file.additions}, Deletions: ${this.file.deletions}`);

		if (this.file.sourceBranch || this.file.targetBranch) {
			lines.push(`Branches: ${this.file.sourceBranch ?? '?'} → ${this.file.targetBranch ?? '?'}`);
		}

		if (this.file.tooLarge) {
			lines.push('Patch unavailable: file is too large');
		}

		return new vscode.MarkdownString(lines.join('\n\n'));
	}
}
