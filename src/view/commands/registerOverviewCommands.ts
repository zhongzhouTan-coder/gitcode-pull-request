import * as vscode from 'vscode';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { PullRequestOverviewPanel } from '../overview/pullRequestOverviewPanel';

interface RegisterOverviewCommandsOptions {
	logger: Logger;
}

export function registerOverviewCommands(options: RegisterOverviewCommandsOptions): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.commands.registerCommand(COMMAND_ID.refreshPullRequest, async () => {
			const refreshed = await PullRequestOverviewPanel.refreshCurrent();
			if (!refreshed) {
				options.logger.debug('No active pull request overview panel to refresh.');
			}
		}),
	);
}
