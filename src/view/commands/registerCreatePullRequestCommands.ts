import * as vscode from 'vscode';
import { COMMAND_ID } from '../../common/constants';
import { CreatePullRequestHelper } from '../createPullRequest/createPullRequestHelper';

export function registerCreatePullRequestCommands(
	helper: CreatePullRequestHelper,
): vscode.Disposable {
	return vscode.commands.registerCommand(
		COMMAND_ID.createPullRequest,
		async () => {
			await helper.create();
		},
	);
}
