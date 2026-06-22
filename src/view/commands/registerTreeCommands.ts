import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { PullRequestTreeStore } from '../state/pullRequestTreeStore';
import { PullRequestOverviewPanel } from '../overview/pullRequestOverviewPanel';
import { PullRequestOverviewStore } from '../overview/pullRequestOverviewStore';
import { PullRequestNodeContext } from '../tree/nodes/pullRequestNode';

interface RegisterTreeCommandsOptions {
	authService: AuthService;
	logger: Logger;
	overviewStore: PullRequestOverviewStore;
	store: PullRequestTreeStore;
}

function getPullRequestUrl(context: PullRequestNodeContext): string {
	return context.pullRequest.url ?? `${context.repository.webUrl}/merge_requests/${context.pullRequest.number}`;
}

export function registerTreeCommands(options: RegisterTreeCommandsOptions): vscode.Disposable {

	return vscode.Disposable.from(
		vscode.commands.registerCommand(COMMAND_ID.signIn, async () => {
			await options.authService.signIn();
			await options.store.refreshAll();
		}),
		vscode.commands.registerCommand(COMMAND_ID.refreshPullRequests, async () => {
			await options.store.refreshAll();
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
				options.overviewStore,
				options.logger,
			);
		}),
		vscode.commands.registerCommand(COMMAND_ID.openPullRequestOnWeb, async (context?: PullRequestNodeContext) => {
			if (context) {
				await vscode.env.openExternal(vscode.Uri.parse(getPullRequestUrl(context)));
				return;
			}

			await PullRequestOverviewPanel.openCurrentOnWeb();
		}),
	);
}
