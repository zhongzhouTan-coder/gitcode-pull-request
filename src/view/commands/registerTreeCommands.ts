import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { COMMAND_ID } from '../../common/constants';
import { PullRequestTreeStore } from '../state/pullRequestTreeStore';
import { PullRequestNodeContext } from '../tree/nodes/pullRequestNode';

interface RegisterTreeCommandsOptions {
	authService: AuthService;
	store: PullRequestTreeStore;
}

export function registerTreeCommands(options: RegisterTreeCommandsOptions): vscode.Disposable {
	const openPullRequestUrl = async (context: PullRequestNodeContext): Promise<string> => {
		return context.pullRequest.url ?? `${context.repository.webUrl}/merge_requests/${context.pullRequest.number}`;
	};

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

			const url = await openPullRequestUrl(context);
			await vscode.env.openExternal(vscode.Uri.parse(url));
		}),
	);
}
