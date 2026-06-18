import * as vscode from 'vscode';
import { COMMAND_ID } from '../../../common/constants';
import { GitCodeRepository, PullRequestSummary } from '../../../common/models';
import { BaseNode } from './baseNode';

export interface PullRequestNodeContext {
	repository: GitCodeRepository;
	pullRequest: PullRequestSummary;
}

export class PullRequestNode extends BaseNode {
	readonly id: string;
	readonly context: PullRequestNodeContext;

	constructor(
		repository: GitCodeRepository,
		private readonly pullRequest: PullRequestSummary,
		parent?: BaseNode,
	) {
		super(parent);
		this.id = `pullRequest:${repository.fullName}:${pullRequest.number}`;
		this.context = { repository, pullRequest };
	}

	getTreeItem(): vscode.TreeItem {
		const item = new vscode.TreeItem(
			`#${this.pullRequest.number} ${this.pullRequest.title}`,
			vscode.TreeItemCollapsibleState.None,
		);
		item.id = this.id;
		item.contextValue = 'pullRequest';
		item.description = this.describe();
		item.tooltip = this.buildTooltip();
		item.command = {
			command: COMMAND_ID.openPullRequest,
			title: 'Open Pull Request',
			arguments: [this.context],
		};
		item.resourceUri = vscode.Uri.parse(this.context.repository.webUrl);
		item.iconPath = this.pullRequest.isDraft
			? new vscode.ThemeIcon('git-pull-request-draft')
			: new vscode.ThemeIcon('git-pull-request');
		return item;
	}

	getChildren(): BaseNode[] {
		return [];
	}

	private describe(): string | undefined {
		const parts = [this.pullRequest.author];
		if (this.pullRequest.sourceBranch || this.pullRequest.targetBranch) {
			parts.push(`${this.pullRequest.sourceBranch ?? '?'} -> ${this.pullRequest.targetBranch ?? '?'}`);
		}

		return parts.join(' ');
	}

	private buildTooltip(): vscode.MarkdownString {
		const lines = [
			`**#${this.pullRequest.number} ${this.pullRequest.title}**`,
			`Author: ${this.pullRequest.author}`,
		];

		if (this.pullRequest.sourceBranch || this.pullRequest.targetBranch) {
			lines.push(`Branches: ${this.pullRequest.sourceBranch ?? '?'} -> ${this.pullRequest.targetBranch ?? '?'}`);
		}

		if (this.pullRequest.updatedAt) {
			lines.push(`Updated: ${this.pullRequest.updatedAt}`);
		}

		if (this.pullRequest.url) {
			lines.push(`[Open on GitCode](${this.pullRequest.url})`);
		}

		return new vscode.MarkdownString(lines.join('\n\n'));
	}
}
