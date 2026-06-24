import * as vscode from 'vscode';
import { AuthService } from '../authentication/authService';
import { SessionStore } from '../authentication/sessionStore';
import { ExtensionConfiguration } from '../common/configuration';
import { COMMAND_ID, CONTEXT_KEY_FILE_LIST_LAYOUT, GITCODE_PR_SCHEME } from '../common/constants';
import { Logger } from '../common/logger';
import { RepositoryContextService } from '../common/git/repositoryContext';
import { GitCodeRepositoryResolver } from '../gitcode/resolver/gitcodeRepositoryResolver';
import { CommentService } from '../gitcode/services/commentService';
import { PullRequestService } from '../gitcode/services/pullRequestService';
import { RawContentService } from '../gitcode/services/rawContentService';
import { registerOverviewCommands } from './commands/registerOverviewCommands';
import { registerTreeCommands } from './commands/registerTreeCommands';
import { DiffCommentController } from './comments/diffCommentController';
import { GitCodePullRequestFileSystemProvider } from './diff/gitcodePullRequestFileSystemProvider';
import { PullRequestDiffController } from './diff/pullRequestDiffController';
import { PullRequestDiffStore } from './diff/pullRequestDiffStore';
import { PullRequestPatchContentProvider } from './diff/pullRequestPatchContentProvider';
import { PullRequestOverviewStore } from './overview/pullRequestOverviewStore';
import { PullRequestCommentsStore } from './state/pullRequestCommentsStore';
import { PullRequestTreeStore } from './state/pullRequestTreeStore';
import { NodeFactory } from './tree/nodeFactory';
import { PullRequestTreeDataProvider } from './tree/pullRequestTreeDataProvider';
import { GitCodeClientImpl } from '../gitcode/client/gitcodeClient';

interface ViewControllerOptions {
	context: vscode.ExtensionContext;
	authService: AuthService;
	configuration: ExtensionConfiguration;
	repositoryContext: RepositoryContextService;
	repositoryResolver: GitCodeRepositoryResolver;
	pullRequestService: PullRequestService;
	sessionStore: SessionStore;
	logger: Logger;
	viewId: string;
}

export class ViewController implements vscode.Disposable {
	private readonly store: PullRequestTreeStore;
	private readonly overviewStore: PullRequestOverviewStore;
	private readonly commentsStore: PullRequestCommentsStore;
	private readonly treeDataProvider: PullRequestTreeDataProvider;
	private readonly treeView: vscode.TreeView<import('./tree/nodes/baseNode').BaseNode>;
	private readonly patchContentProvider: PullRequestPatchContentProvider;
	private readonly diffStore: PullRequestDiffStore;
	private readonly diffController: PullRequestDiffController;
	private readonly diffCommentController: DiffCommentController;
	private readonly fileSystemProvider: GitCodePullRequestFileSystemProvider;
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

		// Comment components
		const gitCodeClient = new GitCodeClientImpl(
			options.configuration,
			options.sessionStore,
			options.logger,
		);
		const commentService = new CommentService(gitCodeClient, options.logger);
		this.commentsStore = new PullRequestCommentsStore(
			options.authService,
			commentService,
		);
		this.diffCommentController = new DiffCommentController(
			this.commentsStore,
			options.logger,
		);

		this.patchContentProvider = new PullRequestPatchContentProvider();
		this.layoutSupplier = () => options.configuration.getPullRequestFileListLayout();

		// Diff view components
		const rawContentService = new RawContentService(
			options.configuration,
			options.sessionStore,
			options.logger,
		);
		this.fileSystemProvider = new GitCodePullRequestFileSystemProvider(
			rawContentService,
			options.logger,
		);
		this.diffStore = new PullRequestDiffStore(options.pullRequestService);
		this.diffController = new PullRequestDiffController(
			this.diffStore,
			this.patchContentProvider,
			options.logger,
		);

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
			this.fileSystemProvider,
			this.diffCommentController,
			vscode.workspace.registerTextDocumentContentProvider('gitcode-pr-diff', this.patchContentProvider),
			vscode.workspace.registerFileSystemProvider(GITCODE_PR_SCHEME, this.fileSystemProvider, {
				isReadonly: true,
				isCaseSensitive: true,
			}),
			registerTreeCommands({
				authService: options.authService,
				logger: options.logger,
				overviewStore: this.overviewStore,
				commentsStore: this.commentsStore,
				store: this.store,
				diffController: this.diffController,
				diffStore: this.diffStore,
			}),
			registerOverviewCommands({
				logger: options.logger,
			}),
			options.authService.onDidChangeSession(() => {
				this.commentsStore.clear();
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
			// Invalidate diff snapshot cache when the tree store refreshes
			this.store.onDidChange((target) => {
				if (!target) {
					// Refresh all — clear entire diff store
					this.diffStore.clear();
				} else if (typeof target === 'object' && 'type' in target) {
					const t = target as { type: string; repositoryKey?: string; pullRequestNumber?: number };
					if (t.type === 'all') {
						this.diffStore.clear();
					} else if (t.type === 'pullRequestFiles' && t.repositoryKey && t.pullRequestNumber !== undefined) {
						this.diffStore.invalidate(t.repositoryKey, t.pullRequestNumber);
					}
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

		// An override can be resolved without a local Git repository. Otherwise,
		// wait for the active repository's remotes to finish loading before the
		// initial refresh.
		if (!this.options.configuration.getRepositoryOverride()) {
			await this.options.repositoryContext.waitForRepository();
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
