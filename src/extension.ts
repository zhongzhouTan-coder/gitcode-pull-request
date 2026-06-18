import * as vscode from 'vscode';
import { AuthService } from './authentication/authService';
import { PATAuthProvider } from './authentication/patAuthProvider';
import { SessionStore } from './authentication/sessionStore';
import { getExtensionConfiguration } from './common/configuration';
import { EXTENSION_ID, VIEW_ID_PULL_REQUESTS } from './common/constants';
import { Logger } from './common/logger';
import { RepositoryContextService } from './common/git/repositoryContext';
import { GitCodeClientImpl } from './gitcode/client/gitcodeClient';
import { GitCodeRepositoryResolver } from './gitcode/resolver/gitcodeRepositoryResolver';
import { PullRequestService } from './gitcode/services/pullRequestService';
import { UserService } from './gitcode/services/userService';
import { ViewController } from './view/viewController';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const logger = new Logger(vscode.window.createOutputChannel('GitCode Pull Request'));
	const configuration = getExtensionConfiguration();
	const sessionStore = new SessionStore(context.secrets);
	const repositoryContext = new RepositoryContextService(logger);

	const client = new GitCodeClientImpl(configuration, sessionStore, logger);
	const userService = new UserService(client);
	const authService = new AuthService(
		new PATAuthProvider(sessionStore, userService),
		sessionStore,
	);
	const repositoryResolver = new GitCodeRepositoryResolver(repositoryContext, configuration);
	const pullRequestService = new PullRequestService(client);
	const viewController = new ViewController({
		context,
		authService,
		configuration,
		repositoryContext,
		repositoryResolver,
		pullRequestService,
		logger,
		viewId: VIEW_ID_PULL_REQUESTS,
	});

	context.subscriptions.push(
		logger,
		viewController,
	);

	await viewController.initialize();
}

export function deactivate(): void {
	// VS Code disposes registered subscriptions during shutdown.
}
