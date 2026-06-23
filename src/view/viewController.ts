import * as vscode from 'vscode';
import { AuthService } from '../authentication/authService';
import { ExtensionConfiguration } from '../common/configuration';
import { COMMAND_ID, CONTEXT_KEY_FILE_LIST_LAYOUT } from '../common/constants';
import { Logger } from '../common/logger';
import { RepositoryContextService } from '../common/git/repositoryContext';
import { GitCodeRepositoryResolver } from '../gitcode/resolver/gitcodeRepositoryResolver';
import { PullRequestService } from '../gitcode/services/pullRequestService';
import { registerOverviewCommands } from './commands/registerOverviewCommands';
import { registerTreeCommands } from './commands/registerTreeCommands';
import { PullRequestPatchContentProvider } from './diff/pullRequestPatchContentProvider';
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
	private readonly patchContentProvider: PullRequestPatchContentProvider;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly layoutSupplier: () => 'tree' | 'flat';

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
		this.patchContentProvider = new PullRequestPatchContentProvider();
		this.layoutSupplier = () => options.configuration.getPullRequestFileListLayout();

		this.treeDataProvider = new PullRequestTreeDataProvider(
			this.store,
			new NodeFactory(this.store, this.layoutSupplier),
			options.logger,
		);
		this.treeView = vscode.window.createTreeView(options.viewId, {
			treeDataProvider: this.treeDataProvider,
			showCollapseAll: true,
		});

		this.disposables.push(
			this.treeView,
			this.patchContentProvider,
			vscode.workspace.registerTextDocumentContentProvider('gitcode-pr-diff', this.patchContentProvider),
			registerTreeCommands({
				authService: options.authService,
				logger: options.logger,
				overviewStore: this.overviewStore,
				store: this.store,
				patchContentProvider: this.patchContentProvider,
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
			vscode.workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration('gitcode.pullRequests.fileListLayout')) {
					this.updateFileListLayoutContext();
					void this.store.refreshAll();
				}
			}),
		);

		this.updateFileListLayoutContext();
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

	private updateFileListLayoutContext(): void {
		const layout = this.layoutSupplier();
		void vscode.commands.executeCommand('setContext', CONTEXT_KEY_FILE_LIST_LAYOUT, layout);
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}
}
