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
		vscode.commands.registerCommand(COMMAND_ID.editPullRequest, async () => {
			const edited = await PullRequestOverviewPanel.editCurrent();
			if (!edited) {
				options.logger.debug('No active pull request overview panel to edit.');
			}
		}),
		vscode.commands.registerCommand(COMMAND_ID.addPullRequestReviewer, async () => {
			const added = await PullRequestOverviewPanel.addReviewerToCurrent();
			if (!added) {
				options.logger.debug('No active pull request overview panel to add reviewer.');
			}
		}),
		vscode.commands.registerCommand(COMMAND_ID.removePullRequestReviewer, async () => {
			const removed = await PullRequestOverviewPanel.removeReviewerFromCurrent();
			if (!removed) {
				options.logger.debug('No active pull request overview panel to remove reviewer.');
			}
		}),
		vscode.commands.registerCommand(COMMAND_ID.addPullRequestTester, async () => {
			const added = await PullRequestOverviewPanel.addTesterToCurrent();
			if (!added) {
				options.logger.debug('No active pull request overview panel to add tester.');
			}
		}),
		vscode.commands.registerCommand(COMMAND_ID.removePullRequestTester, async () => {
			const removed = await PullRequestOverviewPanel.removeTesterFromCurrent();
			if (!removed) {
				options.logger.debug('No active pull request overview panel to remove tester.');
			}
		}),
		vscode.commands.registerCommand(COMMAND_ID.addRelatedIssue, async () => {
			const added = await PullRequestOverviewPanel.addRelatedIssueToCurrent();
			if (!added) {
				options.logger.debug('No active pull request overview panel to add related issue.');
			}
		}),
		vscode.commands.registerCommand(COMMAND_ID.removeRelatedIssue, async () => {
			const removed = await PullRequestOverviewPanel.removeRelatedIssueFromCurrent();
			if (!removed) {
				options.logger.debug('No active pull request overview panel to unlink related issue.');
			}
		}),
	);
}
