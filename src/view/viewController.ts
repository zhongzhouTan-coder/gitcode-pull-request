import * as vscode from 'vscode';
import { AuthService } from '../authentication/authService';
import { ExtensionConfiguration } from '../common/configuration';
import { Logger } from '../common/logger';
import { RepositoryContextService } from '../common/git/repositoryContext';
import { GitCodeRepositoryResolver } from '../gitcode/resolver/gitcodeRepositoryResolver';
import { PullRequestService } from '../gitcode/services/pullRequestService';
import { registerOverviewCommands } from './commands/registerOverviewCommands';
import { registerTreeCommands } from './commands/registerTreeCommands';
import { PullRequestOverviewStore } from './overview/pullRequestOverviewStore';
import { PullRequestTreeStore } from './state/pullRequestTreeStore';
import { NodeFactory } from './tree/nodeFactory';
import { PullRequestTreeDataProvider } from './tree/pullRequestTreeDataProvider';

interface ViewControllerOptions {
	context: vscode.ExtensionContext;
	authService: AuthService;
	configuration: ExtensionConfiguration;
	repositoryContext: RepositoryContextService;
	repositoryResolver: GitCodeRepositoryResolver;
	pullRequestService: PullRequestService;
	logger: Logger;
	viewId: string;
}

export class ViewController implements vscode.Disposable {
	private readonly store: PullRequestTreeStore;
	private readonly overviewStore: PullRequestOverviewStore;
	private readonly treeDataProvider: PullRequestTreeDataProvider;
	private readonly treeView: vscode.TreeView<import('./tree/nodes/baseNode').BaseNode>;
	private readonly disposables: vscode.Disposable[] = [];

	constructor(private readonly options: ViewControllerOptions) {
		this.store = new PullRequestTreeStore(
			options.authService,
			options.repositoryResolver,
			options.pullRequestService,
			options.configuration,
		);
		this.overviewStore = new PullRequestOverviewStore(
			options.authService,
			options.pullRequestService,
		);
		this.treeDataProvider = new PullRequestTreeDataProvider(
			this.store,
			new NodeFactory(this.store),
			options.logger,
		);
		this.treeView = vscode.window.createTreeView(options.viewId, {
			treeDataProvider: this.treeDataProvider,
			showCollapseAll: true,
		});

		this.disposables.push(
			this.treeView,
			registerTreeCommands({
				authService: options.authService,
				logger: options.logger,
				overviewStore: this.overviewStore,
				store: this.store,
			}),
			registerOverviewCommands({
				logger: options.logger,
			}),
			options.authService.onDidChangeSession(() => {
				void this.store.refreshAll();
			}),
			vscode.workspace.onDidChangeWorkspaceFolders(() => {
				void this.store.refreshAll();
			}),
		);
	}

	async initialize(): Promise<void> {
		const gitApi = await this.options.repositoryContext.getGitApi();
		if (gitApi) {
			this.disposables.push(
				gitApi.onDidOpenRepository(() => {
					void this.store.refreshAll();
				}),
				gitApi.onDidCloseRepository(() => {
					void this.store.refreshAll();
				}),
			);
		}

		await this.store.refreshAll();
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}
}
