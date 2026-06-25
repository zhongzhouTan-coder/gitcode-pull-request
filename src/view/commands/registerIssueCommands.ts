import * as vscode from 'vscode';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { AuthService } from '../../authentication/authService';
import { IssueTreeStore } from '../state/issueTreeStore';
import { IssueOverviewStore } from '../issueOverview/issueOverviewStore';
import { IssueOverviewPanel } from '../issueOverview/issueOverviewPanel';
import { IssueNode, IssueNodeContext, getIssueUrl } from '../tree/nodes/issueNode';

interface RegisterIssueCommandsOptions {
	authService: AuthService;
	store: IssueTreeStore;
	issueOverviewStore: IssueOverviewStore;
	logger: Logger;
}

function resolveIssueContext(value: unknown): IssueNodeContext | undefined {
	if (!value) {
		return undefined;
	}

	// Direct context object (from item.command)
	if (isIssueNodeContext(value)) {
		return value;
	}

	// Tree node (from view/item/context)
	if (value instanceof IssueNode) {
		return value.context;
	}

	return undefined;
}

function isIssueNodeContext(value: unknown): value is IssueNodeContext {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return typeof candidate.repository === 'object'
		&& typeof candidate.issue === 'object';
}

export function registerIssueCommands(options: RegisterIssueCommandsOptions): vscode.Disposable {
	const { authService, store, issueOverviewStore, logger } = options;

	return vscode.Disposable.from(
		vscode.commands.registerCommand(COMMAND_ID.refreshIssues, async () => {
			await store.refreshAll();
		}),
		vscode.commands.registerCommand(COMMAND_ID.openIssue, async (context?: IssueNodeContext) => {
			const resolved = resolveIssueContext(context);
			if (!resolved) {
				return;
			}

			// Open the issue overview panel instead of browser
			await IssueOverviewPanel.createOrShow(
				{
					repository: resolved.repository,
					issueNumber: resolved.issue.number,
					url: resolved.issue.url,
				},
				issueOverviewStore,
				logger,
			);
		}),
		vscode.commands.registerCommand(COMMAND_ID.openIssueOnWeb, async (context?: IssueNodeContext) => {
			const resolved = resolveIssueContext(context);
			if (resolved) {
				const url = getIssueUrl(resolved);
				await vscode.env.openExternal(vscode.Uri.parse(url));
				return;
			}

			await IssueOverviewPanel.openCurrentOnWeb();
		}),
		vscode.commands.registerCommand(COMMAND_ID.refreshIssue, async () => {
			await IssueOverviewPanel.refreshCurrent();
		}),
		vscode.commands.registerCommand(COMMAND_ID.copyIssueUrl, async (context?: IssueNodeContext) => {
			const resolved = resolveIssueContext(context);
			if (!resolved) {
				return;
			}

			const url = getIssueUrl(resolved);
			await vscode.env.clipboard.writeText(url);
			vscode.window.showInformationMessage('Issue URL copied to clipboard');
		}),
	);
}
