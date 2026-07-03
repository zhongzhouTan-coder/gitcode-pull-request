import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { PullRequestTreeStore } from '../state/pullRequestTreeStore';
import { PullRequestOverviewPanel } from '../overview/pullRequestOverviewPanel';
import { PullRequestOverviewStore } from '../overview/pullRequestOverviewStore';
import { PullRequestNode, PullRequestNodeContext } from '../tree/nodes/pullRequestNode';
import { PullRequestFileNode, PullRequestFileNodeContext } from '../tree/nodes/pullRequestFileNode';
import { PullRequestDiffController } from '../diff/pullRequestDiffController';
import { PullRequestDiffStore } from '../diff/pullRequestDiffStore';
import { PullRequestFilesNode } from '../tree/nodes/pullRequestFilesNode';
import { CopilotPullRequestContextStore } from '../copilot/copilotPullRequestContextStore';
import { PermissionStore } from '../state/permissionStore';

interface RegisterTreeCommandsOptions {
	authService: AuthService;
	logger: Logger;
	overviewStore: PullRequestOverviewStore;
	commentsStore: PullRequestCommentsStore;
	store: PullRequestTreeStore;
	diffController: PullRequestDiffController;
	diffStore: PullRequestDiffStore;
	copilotContextStore: CopilotPullRequestContextStore;
	permissionStore: PermissionStore;
}

function getPullRequestUrl(context: PullRequestNodeContext): string {
	return context.pullRequest.url ?? `${context.repository.webUrl}/merge_requests/${context.pullRequest.number}`;
}

function resolvePullRequestContext(value: unknown): PullRequestNodeContext | undefined {
	if (!value) {
		return undefined;
	}

	// When the command is triggered from item.command (clicking the tree item label),
	// the argument is PullRequestNodeContext directly.
	if (isPullRequestNodeContext(value)) {
		return value;
	}

	// When the command is triggered from the view/item/context inline button,
	// the argument is the PullRequestNode tree node.
	if (value instanceof PullRequestNode) {
		return value.context;
	}

	return undefined;
}

function isPullRequestNodeContext(value: unknown): value is PullRequestNodeContext {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return typeof candidate.repository === 'object'
		&& typeof candidate.pullRequest === 'object';
}

function isSafeUrl(url: string | undefined): url is string {
	if (!url) {
		return false;
	}

	try {
		const parsed = vscode.Uri.parse(url);
		return parsed.scheme === 'https';
	} catch {
		return false;
	}
}

function resolvePullRequestFileContext(
	value: PullRequestFileNodeContext | PullRequestFileNode | undefined,
): PullRequestFileNodeContext | undefined {
	if (!value) {
		return undefined;
	}

	if (value instanceof PullRequestFileNode) {
		return value.context;
	}

	if (value.repository && Number.isInteger(value.pullRequestNumber) && value.file) {
		return value;
	}

	return undefined;
}

export function registerTreeCommands(options: RegisterTreeCommandsOptions): vscode.Disposable {
	const { authService, logger, overviewStore, commentsStore, store, diffController, diffStore, copilotContextStore, permissionStore } = options;

	return vscode.Disposable.from(
		vscode.commands.registerCommand(COMMAND_ID.signIn, async () => {
			await authService.signIn();
			await store.refreshAll();
		}),
		vscode.commands.registerCommand(COMMAND_ID.refreshPullRequests, async () => {
			await store.refreshAll();
			try {
				const repositories = await store.getRepositories();
				await permissionStore.refreshAll(repositories);
			} catch (error) {
				logger.debug(
					`Failed to refresh pull request permissions: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}),
		vscode.commands.registerCommand(COMMAND_ID.openPullRequest, async (context?: PullRequestNodeContext) => {
			const resolved = resolvePullRequestContext(context);
			if (!resolved) {
				return;
			}

			await PullRequestOverviewPanel.createOrShow(
				{
					repository: resolved.repository,
					pullRequestNumber: resolved.pullRequest.number,
					url: getPullRequestUrl(resolved),
				},
				overviewStore,
				commentsStore,
				logger,
			);
		}),
		vscode.commands.registerCommand(COMMAND_ID.openPullRequestOnWeb, async (context?: PullRequestNodeContext) => {
			const resolved = resolvePullRequestContext(context);
			if (resolved) {
				await vscode.env.openExternal(vscode.Uri.parse(getPullRequestUrl(resolved)));
				return;
			}

			await PullRequestOverviewPanel.openCurrentOnWeb();
		}),
		vscode.commands.registerCommand(COMMAND_ID.openPullRequestFile, async (
			value?: PullRequestFileNodeContext | PullRequestFileNode,
		) => {
			const context = resolvePullRequestFileContext(value);
			if (!context) {
				logger.error('Cannot open pull request diff: invalid file command context.');
				return;
			}

			const { repository, pullRequestNumber, file } = context;

			// Use the native diff experience via the diff controller
			await diffController.openDiff(repository, pullRequestNumber, file);
		}),
		vscode.commands.registerCommand(COMMAND_ID.openPullRequestFileOnWeb, async (
			value?: PullRequestFileNodeContext | PullRequestFileNode,
		) => {
			const context = resolvePullRequestFileContext(value);
			if (!context) {
				logger.error('Cannot open pull request file on the web: invalid file command context.');
				return;
			}

			const url = context.file.blobUrl;
			if (isSafeUrl(url)) {
				await vscode.env.openExternal(vscode.Uri.parse(url));
			}
		}),
		vscode.commands.registerCommand(COMMAND_ID.refreshPullRequestFiles, async (context?: PullRequestFilesNode) => {
			if (!context) {
				return;
			}

			const fullName = (context as any).repository?.fullName;
			const prNumber = (context as any).pullRequestNumber;

			if (fullName && prNumber) {
				// Invalidate both list-files cache and diff snapshot
				diffStore.invalidate(fullName, prNumber);
				await store.refreshPullRequestFiles(fullName, prNumber);
			}
		}),
		vscode.commands.registerCommand(COMMAND_ID.setPullRequestFilesLayoutTree, async () => {
			const config = vscode.workspace.getConfiguration('gitcode');
			await config.update('pullRequests.fileListLayout', 'tree', vscode.ConfigurationTarget.Global);
		}),
		vscode.commands.registerCommand(COMMAND_ID.setPullRequestFilesLayoutFlat, async () => {
			const config = vscode.workspace.getConfiguration('gitcode');
			await config.update('pullRequests.fileListLayout', 'flat', vscode.ConfigurationTarget.Global);
		}),
		vscode.commands.registerCommand(COMMAND_ID.usePullRequestAsCopilotContext, async (context?: PullRequestNodeContext | PullRequestNode) => {
			const resolved = resolvePullRequestContext(context);
			if (!resolved) {
				logger.error('Cannot select pull request for Copilot context: invalid command context.');
				return;
			}

			copilotContextStore.select({
				repository: resolved.repository,
				pullRequestNumber: resolved.pullRequest.number,
				title: resolved.pullRequest.title,
				url: resolved.pullRequest.url,
			});

			vscode.window.showInformationMessage(
				`GitCode PR #${resolved.pullRequest.number} selected for Copilot context.`,
			);
		}),
	);
}
