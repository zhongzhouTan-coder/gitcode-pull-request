import * as vscode from 'vscode';
import { AuthService } from '../authentication/authService';
import { SessionStore } from '../authentication/sessionStore';
import { ExtensionConfiguration } from '../common/configuration';
import { COMMAND_ID, CONTEXT_KEY_FILE_LIST_LAYOUT, GITCODE_PR_SCHEME, VIEW_ID_CREATE_PULL_REQUEST } from '../common/constants';
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
import { PullRequestOverviewPanel } from './overview/pullRequestOverviewPanel';
import { PullRequestCommentsStore } from './state/pullRequestCommentsStore';
import { PullRequestOperationLogsStore } from './overview/pullRequestOperationLogsStore';
import { PullRequestTreeStore } from './state/pullRequestTreeStore';
import { IssueTreeStore } from './state/issueTreeStore';
import { IssueTreeDataProvider } from './tree/issueTreeDataProvider';
import { IssueService } from '../gitcode/services/issueService';
import { IssueCommentService } from '../gitcode/services/issueCommentService';
import { IssueOperationLogService } from '../gitcode/services/issueOperationLogService';
import { IssueOverviewPanel } from './issueOverview/issueOverviewPanel';
import { IssueOverviewStore } from './issueOverview/issueOverviewStore';
import { IssueCommentsStore } from './issueOverview/issueCommentsStore';
import { IssueOperationLogsStore } from './issueOverview/issueOperationLogsStore';
import { IssueRelatedPullRequestsStore } from './issueOverview/issueRelatedPullRequestsStore';
import { registerIssueCommands } from './commands/registerIssueCommands';
import { CopilotPullRequestContextStore } from './copilot/copilotPullRequestContextStore';
import { CopilotPullRequestContextBuilder } from './copilot/copilotPullRequestContextBuilder';
import { CopilotIssueContextStore } from './copilot/copilotIssueContextStore';
import { CopilotIssueContextBuilder } from './copilot/copilotIssueContextBuilder';
import { SettlementNextActionResolver } from './copilot/settlementNextActionResolver';
import { registerCreatePullRequestCommands } from './commands/registerCreatePullRequestCommands';
import { registerSettleIssueCommands } from './commands/registerSettleIssueCommands';
import { registerCopilotPullRequestParticipant } from './copilot/registerCopilotPullRequestParticipant';
import { registerCopilotAgentTools } from './copilot/registerCopilotAgentTools';
import { CreatePullRequestHelper } from './createPullRequest/createPullRequestHelper';
import { CreatePullRequestViewProvider } from './createPullRequest/createPullRequestViewProvider';
import { PullRequestTemplateService } from './createPullRequest/prTemplateService';
import { CreateIssueHelper } from './createIssue/createIssueHelper';
import { NodeFactory } from './tree/nodeFactory';
import { PullRequestTreeDataProvider } from './tree/pullRequestTreeDataProvider';
import { GitCodeClientImpl } from '../gitcode/client/gitcodeClient';
import { RepositoryService } from '../gitcode/services/repositoryService';
import { PermissionService } from '../gitcode/services/permissionService';
import { PermissionStore } from './state/permissionStore';

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
	private readonly issueStore: IssueTreeStore;
	private readonly overviewStore: PullRequestOverviewStore;
	private readonly issueOverviewStore: IssueOverviewStore;
	private readonly issueCommentsStore: IssueCommentsStore;
	private readonly issueOperationLogsStore: IssueOperationLogsStore;
	private readonly issueRelatedPrsStore: IssueRelatedPullRequestsStore;
	private readonly commentsStore: PullRequestCommentsStore;
	private readonly treeDataProvider: PullRequestTreeDataProvider;
	private readonly issueTreeDataProvider: IssueTreeDataProvider;
	private readonly treeView: vscode.TreeView<import('./tree/nodes/baseNode').BaseNode>;
	private readonly issueTreeView: vscode.TreeView<import('./tree/nodes/baseNode').BaseNode>;
	private readonly patchContentProvider: PullRequestPatchContentProvider;
	private readonly diffStore: PullRequestDiffStore;
	private readonly diffController: PullRequestDiffController;
	private readonly diffCommentController: DiffCommentController;
	private readonly fileSystemProvider: GitCodePullRequestFileSystemProvider;
	private readonly copilotContextStore: CopilotPullRequestContextStore;
	private readonly copilotIssueContextStore: CopilotIssueContextStore;
	private readonly createPullRequestHelper: CreatePullRequestHelper;
	private readonly createIssueHelper: CreateIssueHelper;
	private readonly permissionStore: PermissionStore;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly layoutSupplier: () => 'tree' | 'flat';

	constructor(private readonly options: ViewControllerOptions) {
		// Core client used by multiple services
		const gitCodeClient = new GitCodeClientImpl(
			options.configuration,
			options.sessionStore,
			options.logger,
		);

		const issueService = new IssueService(gitCodeClient);

		this.store = new PullRequestTreeStore(
			options.authService,
			options.repositoryContext,
			options.repositoryResolver,
			options.pullRequestService,
			options.configuration,
		);

		this.issueStore = new IssueTreeStore(
			options.authService,
			options.repositoryContext,
			options.repositoryResolver,
			issueService,
			options.configuration,
		);

		this.layoutSupplier = () => options.configuration.getPullRequestFileListLayout();
		this.treeDataProvider = new PullRequestTreeDataProvider(
			this.store,
			new NodeFactory(this.store, this.layoutSupplier),
			options.logger,
		);
		this.issueTreeDataProvider = new IssueTreeDataProvider(
			this.issueStore,
			options.logger,
		);
		this.treeView = vscode.window.createTreeView(options.viewId, {
			treeDataProvider: this.treeDataProvider,
			showCollapseAll: true,
		});
		this.issueTreeView = vscode.window.createTreeView('issues:gitcode', {
			treeDataProvider: this.issueTreeDataProvider,
			showCollapseAll: true,
		});

		// Repository service needed by overview store for edit options
		const repositoryService = new RepositoryService(gitCodeClient);

		this.overviewStore = new PullRequestOverviewStore(
			options.authService,
			options.pullRequestService,
			repositoryService,
			issueService,
		);

		// Comment components
		const commentService = new CommentService(gitCodeClient, options.logger);
		this.commentsStore = new PullRequestCommentsStore(
			options.authService,
			commentService,
		);
		this.diffStore = new PullRequestDiffStore(options.pullRequestService);
		this.diffCommentController = new DiffCommentController(
			this.commentsStore,
			this.diffStore,
			options.logger,
		);

		// Copilot context components
		this.copilotContextStore = new CopilotPullRequestContextStore();
		this.copilotIssueContextStore = new CopilotIssueContextStore();

		// Wire up edit dependencies for the pull request overview panel
		PullRequestOverviewPanel.setEditDependencies(
			repositoryService,
			options.pullRequestService,
			this.store,
		);

		// Permission system
		const permissionService = new PermissionService(gitCodeClient);
		this.permissionStore = new PermissionStore(permissionService, options.logger);
		PullRequestOverviewPanel.setPermissionStore(this.permissionStore);
		IssueOverviewPanel.setPermissionStore(this.permissionStore);
		IssueOverviewPanel.setSettleDependencies(
			this.copilotIssueContextStore,
			new SettlementNextActionResolver(),
		);

		// Operation logs store
		const operationLogsStore = new PullRequestOperationLogsStore(
			options.authService,
			options.pullRequestService,
		);
		PullRequestOverviewPanel.setOperationLogsStore(operationLogsStore);

		const rawContentService = new RawContentService(
			options.configuration,
			options.sessionStore,
			options.logger,
		);

		// Create Pull Request components
		const createPullRequestProvider = new CreatePullRequestViewProvider(
			options.context.extensionUri,
			repositoryService,
			options.pullRequestService,
			options.authService,
			{
				onCreateSuccess: (repo, prNumber) => this.createPullRequestHelper.handleCreateSuccess(repo, prNumber),
			},
			this.permissionStore,
			options.logger,
		);
		this.createPullRequestHelper = new CreatePullRequestHelper(
			options.repositoryContext,
			options.repositoryResolver,
			options.pullRequestService,
			createPullRequestProvider,
			this.store,
			this.overviewStore,
			this.commentsStore,
			this.copilotIssueContextStore,
			this.permissionStore,
			options.logger,
			new PullRequestTemplateService(),
		);

		// Issue components
		const issueCommentService = new IssueCommentService(gitCodeClient);
		const issueOperationLogService = new IssueOperationLogService(gitCodeClient);
		this.issueOverviewStore = new IssueOverviewStore(
			options.authService,
			issueService,
			repositoryService,
		);
		this.issueCommentsStore = new IssueCommentsStore(
			options.authService,
			issueCommentService,
		);
		this.issueOperationLogsStore = new IssueOperationLogsStore(
			options.authService,
			issueOperationLogService,
		);
		this.issueRelatedPrsStore = new IssueRelatedPullRequestsStore(
			options.authService,
			issueService,
		);
		IssueOverviewPanel.setEditDependencies(this.issueStore);
		this.createIssueHelper = new CreateIssueHelper(
			options.repositoryResolver,
			repositoryService,
			rawContentService,
			issueService,
			this.issueStore,
			this.issueOverviewStore,
			this.issueCommentsStore,
			this.issueOperationLogsStore,
			this.issueRelatedPrsStore,
			this.overviewStore,
			this.commentsStore,
			this.permissionStore,
			options.logger,
		);

		this.patchContentProvider = new PullRequestPatchContentProvider();

		// Diff view components
		this.fileSystemProvider = new GitCodePullRequestFileSystemProvider(
			rawContentService,
			options.logger,
		);
		this.diffController = new PullRequestDiffController(
			this.diffStore,
			this.patchContentProvider,
			options.logger,
		);
		PullRequestOverviewPanel.setDiffDependencies(this.diffController);

		this.disposables.push(
			this.treeView,
			this.issueTreeView,
			this.patchContentProvider,
			this.fileSystemProvider,
			this.diffCommentController,
			operationLogsStore,
			this.issueOperationLogsStore,
			vscode.window.registerWebviewViewProvider(VIEW_ID_CREATE_PULL_REQUEST, createPullRequestProvider),
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
				copilotContextStore: this.copilotContextStore,
				permissionStore: this.permissionStore,
			}),
			registerIssueCommands({
				authService: options.authService,
				store: this.issueStore,
				issueOverviewStore: this.issueOverviewStore,
				issueCommentsStore: this.issueCommentsStore,
				issueOperationLogsStore: this.issueOperationLogsStore,
				issueRelatedPrsStore: this.issueRelatedPrsStore,
				prOverviewStore: this.overviewStore,
				prCommentsStore: this.commentsStore,
				copilotIssueContextStore: this.copilotIssueContextStore,
				repositoryContext: options.repositoryContext,
				createIssueHelper: this.createIssueHelper,
				permissionStore: this.permissionStore,
				logger: options.logger,
			}),
			registerOverviewCommands({
				logger: options.logger,
			}),
			registerCreatePullRequestCommands(this.createPullRequestHelper),
			registerSettleIssueCommands({
				copilotIssueContextStore: this.copilotIssueContextStore,
				repositoryContext: options.repositoryContext,
				logger: options.logger,
			}),
			registerCopilotPullRequestParticipant(
				this.copilotContextStore,
				new CopilotPullRequestContextBuilder(options.pullRequestService, commentService),
			),
			registerCopilotAgentTools(
			this.copilotIssueContextStore,
			this.copilotContextStore,
			new CopilotIssueContextBuilder(issueService, issueCommentService, options.repositoryContext),
			new CopilotPullRequestContextBuilder(options.pullRequestService, commentService),
			options.pullRequestService,
			issueService,
			commentService,
			options.repositoryResolver,
		),
			options.authService.onDidChangeSession(() => {
				this.commentsStore.clear();
				operationLogsStore.clear();
				this.issueCommentsStore.clear();
				this.issueOperationLogsStore.clear();
				this.issueRelatedPrsStore.clear();
				this.copilotContextStore.clear();
				this.copilotIssueContextStore.clear();
				this.permissionStore.clear();
				void this.store.refreshAll();
				void this.issueStore.refreshAll();
			}),
			vscode.workspace.onDidChangeWorkspaceFolders(() => {
				this.copilotContextStore.clear();
				this.copilotIssueContextStore.clear();
				void this.store.refreshAll();
				void this.issueStore.refreshAll();
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
					void this.issueStore.refreshAll();
				}),
				gitApi.onDidCloseRepository(() => {
					void this.store.refreshAll();
					void this.issueStore.refreshAll();
				}),
			);
		}

		await this.store.refreshAll();
		await this.issueStore.refreshAll();
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
