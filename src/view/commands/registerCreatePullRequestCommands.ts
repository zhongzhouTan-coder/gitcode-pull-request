import * as vscode from 'vscode';
import { COMMAND_ID } from '../../common/constants';
import { CreatePullRequestInitialContext } from '../../common/models';
import { CreatePullRequestHelper } from '../createPullRequest/createPullRequestHelper';

export function registerCreatePullRequestCommands(
	helper: CreatePullRequestHelper,
): vscode.Disposable {
	return vscode.commands.registerCommand(
		COMMAND_ID.createPullRequest,
		async (initialContext?: CreatePullRequestInitialContext) => {
			await helper.create(initialContext);
		},
	);
}
