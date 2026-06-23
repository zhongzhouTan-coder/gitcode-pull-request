import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { PullRequestTreeStore } from '../state/pullRequestTreeStore';
import { PullRequestOverviewPanel } from '../overview/pullRequestOverviewPanel';
import { PullRequestOverviewStore } from '../overview/pullRequestOverviewStore';
import { PullRequestNodeContext } from '../tree/nodes/pullRequestNode';
import { PullRequestFileNodeContext } from '../tree/nodes/pullRequestFileNode';
import { PullRequestPatchContentProvider } from '../diff/pullRequestPatchContentProvider';
import { PullRequestFilesNode } from '../tree/nodes/pullRequestFilesNode';

interface RegisterTreeCommandsOptions {
	authService: AuthService;
	logger: Logger;
	overviewStore: PullRequestOverviewStore;
	store: PullRequestTreeStore;
	patchContentProvider: PullRequestPatchContentProvider;
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

export function registerTreeCommands(options: RegisterTreeCommandsOptions): vscode.Disposable {
	const { authService, logger, overviewStore, store, patchContentProvider } = options;

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
		vscode.commands.registerCommand(COMMAND_ID.openPullRequestFile, async (context?: PullRequestFileNodeContext) => {
			if (!context) {
				return;
			}

			const { repository, pullRequestNumber, file } = context;

			if (file.tooLarge || !file.patch) {
				if (isSafeUrl(file.blobUrl)) {
					await vscode.env.openExternal(vscode.Uri.parse(file.blobUrl));
				}

				return;
			}

			const uri = patchContentProvider.registerPatch(file, repository.fullName, pullRequestNumber);
			const doc = await vscode.workspace.openTextDocument(uri);
			await vscode.languages.setTextDocumentLanguage(doc, 'diff');
			await vscode.window.showTextDocument(doc, { preview: true });
		}),
		vscode.commands.registerCommand(COMMAND_ID.openPullRequestFileOnWeb, async (context?: PullRequestFileNodeContext) => {
			if (!context) {
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
