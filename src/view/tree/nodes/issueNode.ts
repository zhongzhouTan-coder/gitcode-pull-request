import * as vscode from 'vscode';
import { COMMAND_ID } from '../../../common/constants';
import { GitCodeRepository, IssueSummary } from '../../../common/models';
import { BaseNode } from './baseNode';

export interface IssueNodeContext {
	repository: GitCodeRepository;
	issue: IssueSummary;
}

export class IssueNode extends BaseNode {
	readonly id: string;
	readonly context: IssueNodeContext;

	constructor(
		repository: GitCodeRepository,
		private readonly issue: IssueSummary,
		parent?: BaseNode,
	) {
		super(parent);
		this.id = `issue:${repository.fullName}:${issue.number}`;
		this.context = { repository, issue };
	}

	getTreeItem(): vscode.TreeItem {
		const item = new vscode.TreeItem(
			this.buildLabel(),
			vscode.TreeItemCollapsibleState.None,
		);
		item.id = this.id;
		item.contextValue = 'issue';
		item.description = this.describe();
		item.tooltip = this.buildTooltip();
		item.command = {
			command: COMMAND_ID.openIssue,
			title: 'Open Issue',
			arguments: [this.context],
		};
		item.iconPath = this.issue.state === 'closed'
			? new vscode.ThemeIcon('issues')
			: new vscode.ThemeIcon('issues');
		return item;
	}

	getChildren(): BaseNode[] {
		return [];
	}

	private buildLabel(): string {
		let label = `#${this.issue.number}`;
		if (this.issue.issueType) {
			label += ` [${this.issue.issueType}]`;
		}
		label += ` ${this.issue.title}`;
		return label;
	}

	private describe(): string | undefined {
		const parts: string[] = [this.issue.author.login];
		if (this.issue.labels.length > 0) {
			parts.push(this.issue.labels.map((l) => l.name).join(', '));
		}
		if (this.issue.comments > 0) {
			parts.push(`${this.issue.comments} comment${this.issue.comments === 1 ? '' : 's'}`);
		}
		return parts.join(' ');
	}

	private buildTooltip(): vscode.MarkdownString {
		const lines: string[] = [
			`**#${this.issue.number} ${this.issue.title}**`,
			`Author: ${this.issue.author.login}`,
			`State: ${this.issue.state}`,
		];

		if (this.issue.issueState) {
			lines.push(`Issue State: ${this.issue.issueState}`);
		}

		if (this.issue.labels.length > 0) {
			lines.push(`Labels: ${this.issue.labels.map((l) => l.name).join(', ')}`);
		}

		if (this.issue.assignees.length > 0) {
			lines.push(`Assignees: ${this.issue.assignees.map((a) => a.login).join(', ')}`);
		}

		if (this.issue.comments > 0) {
			lines.push(`Comments: ${this.issue.comments}`);
		}

		if (this.issue.milestone) {
			lines.push(`Milestone: ${this.issue.milestone.title}`);
		}

		if (this.issue.updatedAt) {
			lines.push(`Updated: ${this.issue.updatedAt}`);
		}

		if (this.issue.url) {
			lines.push(`[Open on GitCode](${this.issue.url})`);
		}

		return new vscode.MarkdownString(lines.join('\n\n'));
	}
}

export function getIssueUrl(context: IssueNodeContext): string {
	return context.issue.url ?? `${context.repository.webUrl}/issues/${context.issue.number}`;
}
