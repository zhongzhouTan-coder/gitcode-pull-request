import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { PullRequestTreeStore } from '../state/pullRequestTreeStore';
import { PullRequestOverviewPanel } from '../overview/pullRequestOverviewPanel';
import { PullRequestOverviewStore } from '../overview/pullRequestOverviewStore';
import { PullRequestNodeContext } from '../tree/nodes/pullRequestNode';
import { PullRequestFileNode, PullRequestFileNodeContext } from '../tree/nodes/pullRequestFileNode';
import { PullRequestDiffController } from '../diff/pullRequestDiffController';
import { PullRequestDiffStore } from '../diff/pullRequestDiffStore';
import { PullRequestFilesNode } from '../tree/nodes/pullRequestFilesNode';

interface RegisterTreeCommandsOptions {
	authService: AuthService;
	logger: Logger;
	overviewStore: PullRequestOverviewStore;
	commentsStore: PullRequestCommentsStore;
	store: PullRequestTreeStore;
	diffController: PullRequestDiffController;
	diffStore: PullRequestDiffStore;
}

function getPullRequestUrl(context: PullRequestNodeContext): string {
	return context.pullRequest.url ?? `${context.repository.webUrl}/merge_requests/${context.pullRequest.number}`;
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
	const { authService, logger, overviewStore, commentsStore, store, diffController, diffStore } = options;

	return vscode.Disposable.from(
		vscode.commands.registerCommand(COMMAND_ID.signIn, async () => {
			await authService.signIn();
			await store.refreshAll();
		}),
		vscode.commands.registerCommand(COMMAND_ID.refreshPullRequests, async () => {
			await store.refreshAll();
		}),
		vscode.commands.registerCommand(COMMAND_ID.openPullRequest, async (context?: PullRequestNodeContext) => {
			if (!context) {
				return;
			}

			await PullRequestOverviewPanel.createOrShow(
				{
					repository: context.repository,
					pullRequestNumber: context.pullRequest.number,
					url: getPullRequestUrl(context),
				},
				overviewStore,
				commentsStore,
				logger,
			);
		}),
		vscode.commands.registerCommand(COMMAND_ID.openPullRequestOnWeb, async (context?: PullRequestNodeContext) => {
			if (context) {
				await vscode.env.openExternal(vscode.Uri.parse(getPullRequestUrl(context)));
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
	);
}
