import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ApiRequestError, NotSignedInError } from '../../common/errors';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { EditPullRequestInput, EditPullRequestOptions, EditPullRequestSection, GitCodeRepository, GitCodeUser, IssueSummary, PullRequestCommentsSnapshot, PullRequestDetail, PullRequestOperationLogsSnapshot, PullRequestOverviewPermissions, PullRequestRelatedIssuesSnapshot } from '../../common/models';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { PullRequestTreeStore } from '../state/pullRequestTreeStore';
import { PullRequestDiffController } from '../diff/pullRequestDiffController';
import { RepositoryService } from '../../gitcode/services/repositoryService';
import { PullRequestService } from '../../gitcode/services/pullRequestService';
import { getOverviewErrorHtml, getOverviewLoadingHtml, getOverviewWithTimelineHtml, getOverviewWithCommentsLoadingHtml, getOverviewWithCommentsErrorHtml, renderRelatedIssuesSection, renderRelatedIssuesLoading, renderRelatedIssuesError } from './overviewHtml';
import { PullRequestOverviewStore } from './pullRequestOverviewStore';
import { PullRequestOperationLogsStore } from './pullRequestOperationLogsStore';
import { buildDiffCommentContexts, DiffCommentContext } from './diffCommentContext';
import { PermissionStore } from '../state/permissionStore';
import { checkPermission } from '../permissions/permissionChecks';
import { buildPullRequestOverviewPermissions, buildUnknownPullRequestOverviewPermissions, hasEffectivePermission } from '../permissions/permissionHelpers';
import { canEditOwnPullRequest, canChangeOwnPullRequestState } from '../permissions/ownershipRules';

interface PullRequestOverviewContext {
	repository: GitCodeRepository;
	pullRequestNumber: number;
	url?: string;
}

export interface RelatedIssueQuickPickItem extends vscode.QuickPickItem {
	issueNumber?: number;
	manual?: boolean;
}

interface ReviewerQuickPickItem extends vscode.QuickPickItem {
	login: string;
}

function createNonce(): string {
	return crypto.randomBytes(16).toString('base64');
}

function keyFor(repository: GitCodeRepository, pullRequestNumber: number): string {
	return `${repository.fullName}#${pullRequestNumber}`;
}

function repositoryFromFullName(fullName: string, currentRepository: GitCodeRepository): GitCodeRepository | undefined {
	const [owner, name, ...rest] = fullName.split('/');
	if (!owner || !name || rest.length > 0) {
		return undefined;
	}

	const webUrl = new URL(currentRepository.webUrl);
	webUrl.pathname = `/${owner}/${name}`;
	webUrl.search = '';
	webUrl.hash = '';

	return {
		remoteName: currentRepository.remoteName,
		owner,
		name,
		fullName: `${owner}/${name}`,
		webUrl: webUrl.toString().replace(/\/$/, ''),
	};
}

export function isTrustedGitCodeUrl(candidate: string, webUrl: string): boolean {
	try {
		const parsedCandidate = new URL(candidate);
		const parsedWebUrl = new URL(webUrl);
		const isWebProtocol = parsedCandidate.protocol === 'http:' || parsedCandidate.protocol === 'https:';
		return isWebProtocol && parsedCandidate.origin === parsedWebUrl.origin;
	} catch {
		return false;
	}
}

export function validatePullRequestStateChange(requestedState: string, detail: PullRequestDetail): string[] {
	if (requestedState !== 'open' && requestedState !== 'closed') {
		return ['Pull request state must be open or closed.'];
	}

	if (detail.state === 'merged') {
		return ['Merged pull requests cannot be reopened or closed.'];
	}

	if (requestedState === 'closed' && detail.state !== 'open') {
		return ['Only open pull requests can be closed.'];
	}

	if (requestedState === 'open' && detail.state !== 'closed') {
		return ['Only closed pull requests can be reopened.'];
	}

	return [];
}

export function validatePullRequestCommentBody(body: string): string[] {
	if (!body.trim()) {
		return ['Comment body is required.'];
	}

	return [];
}

export class PullRequestOverviewPanel implements vscode.Disposable {
	private static readonly panels = new Map<string, PullRequestOverviewPanel>();
	private static activePanel: PullRequestOverviewPanel | undefined;
	private static repositoryService: RepositoryService | undefined;
	private static pullRequestService: PullRequestService | undefined;
	private static treeStore: PullRequestTreeStore | undefined;
	private static diffController: PullRequestDiffController | undefined;
	private static operationLogsStore: PullRequestOperationLogsStore | undefined;
	private static permissionStore: PermissionStore | undefined;

	static setEditDependencies(
		repositoryService: RepositoryService,
		pullRequestService: PullRequestService,
		treeStore: PullRequestTreeStore,
	): void {
		this.repositoryService = repositoryService;
		this.pullRequestService = pullRequestService;
		this.treeStore = treeStore;
	}

	static setDiffDependencies(diffController: PullRequestDiffController): void {
		this.diffController = diffController;
	}

	static setOperationLogsStore(store: PullRequestOperationLogsStore): void {
		this.operationLogsStore = store;
	}

	static setPermissionStore(store: PermissionStore): void {
		this.permissionStore = store;
	}

	static async createOrShow(
		context: PullRequestOverviewContext,
		store: PullRequestOverviewStore,
		commentsStore: PullRequestCommentsStore,
		logger: Logger,
	): Promise<void> {
		const key = keyFor(context.repository, context.pullRequestNumber);
		let panel = this.panels.get(key);

		if (panel) {
			panel.panel.reveal(vscode.ViewColumn.Active, true);
			await panel.show(context);
			return;
		}

		const webviewPanel = vscode.window.createWebviewPanel(
			'gitcode.pullRequestOverview',
			`Pull Request #${context.pullRequestNumber}`,
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
			},
		);

		panel = new PullRequestOverviewPanel(webviewPanel, store, commentsStore, logger, context);
		this.panels.set(key, panel);
		await panel.show(context);
	}

	static async openCurrentOnWeb(): Promise<boolean> {
		if (!this.activePanel) {
			return false;
		}

		await this.activePanel.openOnWeb();
		return true;
	}

	static async refreshCurrent(): Promise<boolean> {
		if (!this.activePanel) {
			return false;
		}

		await this.activePanel.refresh();
		return true;
	}

	static async editCurrent(): Promise<boolean> {
		if (!this.activePanel) {
			return false;
		}

		// The edit command navigates to the active panel; section editing is done
		// via pencil icons in the overview itself per the design.
		this.activePanel.panel.reveal(vscode.ViewColumn.Active, true);
		return true;
	}

	private detail?: PullRequestDetail;
	private commentsSnapshot?: PullRequestCommentsSnapshot;
	private relatedIssuesSnapshot?: PullRequestRelatedIssuesSnapshot;
	private operationLogsSnapshot?: PullRequestOperationLogsSnapshot;
	private editOptions?: EditPullRequestOptions;
	private reviewerMutationInProgress: boolean = false;
	private addReviewerInProgress: boolean = false;
	private removeReviewerInProgress: boolean = false;
	private removingReviewerLogins: readonly string[] = [];
	private testerMutationInProgress: boolean = false;
	private addTesterInProgress: boolean = false;
	private removeTesterInProgress: boolean = false;
	private removingTesterLogins: readonly string[] = [];
	private addRelatedIssueInProgress: boolean = false;
	private removeRelatedIssueInProgress: boolean = false;
	private removingRelatedIssueNumbers: readonly number[] = [];
	private permissions: PullRequestOverviewPermissions = {
		canEditPullRequest: false,
		canEditPullRequestTitleAndBody: false,
		canEditPullRequestDraft: false,
		canClosePullRequest: false,
		canReopenPullRequest: false,
		canCreateComment: false,
		canEditComment: false,
		canResolveComment: false,
		canUpdateReviewers: false,
		canUpdateTesters: false,
		canUpdateRelatedIssues: false,
	};

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		private readonly store: PullRequestOverviewStore,
		private readonly commentsStore: PullRequestCommentsStore,
		private readonly logger: Logger,
		private context: PullRequestOverviewContext,
	) {
		this.panel.onDidDispose(() => {
			PullRequestOverviewPanel.panels.delete(keyFor(this.context.repository, this.context.pullRequestNumber));
			if (PullRequestOverviewPanel.activePanel === this) {
				PullRequestOverviewPanel.activePanel = undefined;
			}
		});

		this.panel.onDidChangeViewState((event) => {
			if (event.webviewPanel.active) {
				PullRequestOverviewPanel.activePanel = this;
			}
		});

		this.panel.webview.onDidReceiveMessage(async (message: {
			command?: string;
			body?: string;
			commentId?: string;
			url?: string;
			repository?: string;
			issue?: number | string;
			section?: EditPullRequestSection;
			input?: EditPullRequestInput;
			state?: string;
			discussionId?: string;
			resolved?: boolean;
			login?: string;
			path?: string;
			line?: number | string;
		}) => {
			if (message.command === 'refresh') {
				await this.refresh();
				return;
			}

			if (message.command === 'openOnWeb') {
				await this.openOnWeb();
				return;
			}

			if (message.command === 'submitPullRequestComment' && typeof message.body === 'string') {
				await this.handleSubmitPullRequestComment(message.body);
				return;
			}

			if (message.command === 'editPullRequestComment' && typeof message.commentId === 'string' && typeof message.body === 'string') {
				await this.handleEditPullRequestComment(message.commentId, message.body);
				return;
			}

			if (message.command === 'revisePullRequestCommentStatus' && typeof message.discussionId === 'string' && typeof message.resolved === 'boolean') {
				await this.handleRevisePullRequestCommentStatus(message.discussionId, message.resolved);
				return;
			}

			if (message.command === 'replyPullRequestComment' && typeof message.discussionId === 'string' && typeof message.body === 'string') {
				await this.handleReplyPullRequestComment(message.discussionId, message.body);
				return;
			}

			if (message.command === 'addRelatedIssue') {
				await this.handleAddRelatedIssue();
				return;
			}

			if (message.command === 'addReviewer') {
				await this.handleAddReviewers();
				return;
			}

			if (message.command === 'removeReviewer' && typeof message.login === 'string') {
				if (!message.login.trim()) {
					return;
				}
				await this.handleRemoveReviewers([message.login]);
				return;
			}

			if (message.command === 'addTester') {
				await this.handleAddTesters();
				return;
			}

			if (message.command === 'removeTester' && typeof message.login === 'string') {
				if (!message.login.trim()) {
					return;
				}
				await this.handleRemoveTesters([message.login]);
				return;
			}

			if (message.command === 'removeRelatedIssue' && message.issue !== undefined) {
				const issueNumber = Number(message.issue);
				if (!Number.isFinite(issueNumber) || issueNumber <= 0) {
					return;
				}
				await this.handleRemoveRelatedIssues([issueNumber]);
				return;
			}

			if (message.command === 'openDiffComment' && typeof message.path === 'string') {
				await this.handleOpenDiffComment(message.path, Number(message.line));
				return;
			}

			if (message.command === 'savePullRequestSection' && message.section && message.input) {
				await this.handleSaveSection(message.section, message.input);
				return;
			}

			if (message.command === 'changePullRequestState' && message.state) {
				await this.handleChangePullRequestState(message.state);
				return;
			}

			if (message.command === 'openUrl' && message.url) {
				await this.openTrustedUrl(message.url);
				return;
			}

			if (message.command === 'openIssue' && message.issue !== undefined) {
				const issueNumber = Number(message.issue);
				if (!Number.isFinite(issueNumber) || issueNumber <= 0) {
					return;
				}

				const targetRepository = message.repository
					? repositoryFromFullName(message.repository, this.context.repository) ?? this.context.repository
					: this.context.repository;

				await vscode.commands.executeCommand(COMMAND_ID.openIssue, {
					repository: targetRepository,
					issue: {
						number: issueNumber,
						title: '',
						url: message.url,
					},
				});
			}
		});
	}

	dispose(): void {
		this.panel.dispose();
	}

	private async show(context: PullRequestOverviewContext): Promise<void> {
		this.context = context;
		this.panel.title = `Pull Request #${context.pullRequestNumber}`;
		PullRequestOverviewPanel.activePanel = this;
		await this.load(false);
	}

	private async refresh(): Promise<void> {
		await this.store.refresh(this.context.repository, this.context.pullRequestNumber);
		// Also invalidate comments and notify inline diff consumers before reloading.
		await this.commentsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
		if (PullRequestOverviewPanel.operationLogsStore) {
			await PullRequestOverviewPanel.operationLogsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
		}
		this.commentsSnapshot = undefined;
		this.relatedIssuesSnapshot = undefined;
		this.operationLogsSnapshot = undefined;
		await this.load(true);
	}

	private async load(forceRefresh: boolean): Promise<void> {
		if (forceRefresh) {
			this.detail = undefined;
			this.commentsSnapshot = undefined;
			this.relatedIssuesSnapshot = undefined;
			this.operationLogsSnapshot = undefined;
			this.editOptions = undefined;
		}

		// Phase 1: Render a loading indicator — no scripts, so acquireVsCodeApi is not called yet
		this.panel.webview.html = getOverviewLoadingHtml('Loading pull request', 'Fetching pull request details from GitCode.', createNonce());

		try {
			this.detail = await this.store.getDetail(this.context.repository, this.context.pullRequestNumber);
		} catch (error) {
			this.logger.error(`Failed to load pull request #${this.context.pullRequestNumber}: ${error instanceof Error ? error.message : String(error)}`);
			this.panel.webview.html = this.renderError(error);
			return;
		}

		// Load permissions for this repository
		await this.refreshPermissions();

		// Render detail with loading timeline and related issues.
		const relatedIssuesLoadingHtml = renderRelatedIssuesLoading(this.buildRelatedIssuesOptions());
		this.panel.webview.html = getOverviewWithCommentsLoadingHtml(this.detail, createNonce(), relatedIssuesLoadingHtml, undefined, undefined, this.permissions, this.buildReviewerOptions(), this.buildTesterOptions());

		// Phase 2: Load comments, operation logs, related issues, and edit options independently in parallel
		const commentsPromise = this.commentsStore.getOrFetch(
			this.context.repository,
			this.context.pullRequestNumber,
		);

		const operationLogsPromise = PullRequestOverviewPanel.operationLogsStore
			? PullRequestOverviewPanel.operationLogsStore.getOrFetch(
				this.context.repository,
				this.context.pullRequestNumber,
			)
			: Promise.resolve(undefined);

		const editOptionsPromise = this.store.getEditOptions(
			this.context.repository,
		);

		const relatedIssuesPromise = this.store.getRelatedIssues(
			this.context.repository,
			this.context.pullRequestNumber,
		);

		// Wait for all and render
		const [commentsResult, operationLogsResult, relatedIssuesResult, editOptionsResult] = await Promise.allSettled([commentsPromise, operationLogsPromise, relatedIssuesPromise, editOptionsPromise]);

		let commentsSnapshot: PullRequestCommentsSnapshot | undefined;
		let relatedIssuesSnapshot: PullRequestRelatedIssuesSnapshot | undefined;
		let operationLogsSnapshot: PullRequestOperationLogsSnapshot | undefined;
		let commentsError: string | undefined;
		let relatedIssuesError: string | undefined;
		let activityError: string | undefined;

		if (commentsResult.status === 'fulfilled') {
			commentsSnapshot = commentsResult.value;
		} else {
			const error = commentsResult.reason;
			this.logger.error(
				`Failed to load comments for PR #${this.context.pullRequestNumber}: ${error instanceof Error ? error.message : String(error)}`,
			);
			commentsError = error instanceof Error ? error.message : 'Unable to load comments.';
		}

		if (operationLogsResult.status === 'fulfilled' && operationLogsResult.value) {
			this.operationLogsSnapshot = operationLogsResult.value;
			operationLogsSnapshot = this.operationLogsSnapshot;
		} else if (operationLogsResult.status === 'rejected') {
			const error = operationLogsResult.reason;
			this.logger.error(
				`Failed to load operation logs for PR #${this.context.pullRequestNumber}: ${error instanceof Error ? error.message : String(error)}`,
			);
			activityError = error instanceof Error ? error.message : 'Unable to load activity.';
		}

		if (relatedIssuesResult.status === 'fulfilled') {
			this.relatedIssuesSnapshot = {
				repositoryKey: this.context.repository.fullName,
				pullRequestNumber: this.context.pullRequestNumber,
				issues: relatedIssuesResult.value,
				loadedAt: Date.now(),
			};
			relatedIssuesSnapshot = this.relatedIssuesSnapshot;
		} else {
			const error = relatedIssuesResult.reason;
			this.logger.error(
				`Failed to load related issues for PR #${this.context.pullRequestNumber}: ${error instanceof Error ? error.message : String(error)}`,
			);
			relatedIssuesError = error instanceof Error ? error.message : 'Unable to load related issues.';
		}

		if (commentsSnapshot) {
			this.commentsSnapshot = commentsSnapshot;
		}

		if (editOptionsResult.status === 'fulfilled') {
			this.editOptions = editOptionsResult.value;
		} else {
			const error = editOptionsResult.reason;
			this.logger.debug(`Failed to load edit options for PR #${this.context.pullRequestNumber}: ${error instanceof Error ? error.message : String(error)}`);
			this.editOptions = undefined;
		}

		// Build related issues HTML
		const relatedIssuesOptions = this.buildRelatedIssuesOptions();
		let relatedIssuesHtml: string;
		if (relatedIssuesSnapshot) {
			relatedIssuesHtml = renderRelatedIssuesSection(relatedIssuesSnapshot, relatedIssuesOptions);
		} else if (relatedIssuesError) {
			relatedIssuesHtml = renderRelatedIssuesError(relatedIssuesError, relatedIssuesOptions);
		} else {
			relatedIssuesHtml = '';
		}

		// Build comments HTML
		if (commentsSnapshot) {
			let diffContexts: ReadonlyMap<string, DiffCommentContext> | undefined;
			const treeStore = PullRequestOverviewPanel.treeStore;
			if (treeStore) {
				try {
					const files = await treeStore.getPullRequestFiles(this.context.repository, this.context.pullRequestNumber);
					diffContexts = buildDiffCommentContexts(commentsSnapshot, files);
				} catch (error) {
					this.logger.debug(
						`Failed to load diff context for PR #${this.context.pullRequestNumber}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
			if (this.hasMissingDiffContexts(commentsSnapshot, diffContexts) && PullRequestOverviewPanel.pullRequestService) {
				try {
					const diffSnapshot = await PullRequestOverviewPanel.pullRequestService.getPullRequestDiffSnapshot(
						this.context.repository,
						this.context.pullRequestNumber,
					);
					diffContexts = this.mergeDiffContexts(
						diffContexts,
						buildDiffCommentContexts(commentsSnapshot, diffSnapshot.files),
					);
				} catch (error) {
					this.logger.debug(
						`Failed to load structured diff context for PR #${this.context.pullRequestNumber}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}

			this.panel.webview.html = getOverviewWithTimelineHtml(this.detail, commentsSnapshot, createNonce(), relatedIssuesHtml, this.editOptions, diffContexts, operationLogsSnapshot, activityError, this.permissions, this.buildReviewerOptions(), this.buildTesterOptions());
		} else {
			const errorMessage = commentsError ?? 'Unable to load comments.';
			this.panel.webview.html = getOverviewWithCommentsErrorHtml(this.detail, errorMessage, createNonce(), relatedIssuesHtml, this.editOptions, undefined, this.permissions, this.buildReviewerOptions(), this.buildTesterOptions());
		}
	}

	private async openOnWeb(): Promise<void> {
		const url = this.detail?.htmlUrl ?? this.detail?.url ?? this.context.url;
		if (!url) {
			return;
		}

		await vscode.env.openExternal(vscode.Uri.parse(url));
	}

	private async openTrustedUrl(url: string): Promise<void> {
		if (!isTrustedGitCodeUrl(url, this.context.repository.webUrl)) {
			return;
		}

		await vscode.env.openExternal(vscode.Uri.parse(url));
	}

	private async refreshPermissions(): Promise<void> {
		if (!PullRequestOverviewPanel.permissionStore) {
			return;
		}

		try {
			const snapshot = await PullRequestOverviewPanel.permissionStore.get(this.context.repository);
			this.permissions = buildPullRequestOverviewPermissions(snapshot, {
				authorLogin: this.detail?.author.login,
				currentUserLogin: await this.store.getCurrentUserLogin(),
			});
		} catch (error) {
			this.logger.debug(
				`Failed to load permissions for ${this.context.repository.fullName}: ${error instanceof Error ? error.message : String(error)}`,
			);
			this.permissions = buildUnknownPullRequestOverviewPermissions();
		}
	}

	private async checkWritePermission(scope: string, action: string, deniedMessage: string, objectRuleAllows: boolean = false): Promise<boolean> {
		if (!PullRequestOverviewPanel.permissionStore) {
			return true;
		}

		let allowed: boolean;
		if (objectRuleAllows) {
			try {
				const snapshot = await PullRequestOverviewPanel.permissionStore.get(this.context.repository);
				allowed = hasEffectivePermission(snapshot, {
					scope,
					action,
					message: () => deniedMessage,
				}, objectRuleAllows);
			} catch {
				allowed = true;
			}
		} else {
			allowed = await checkPermission(PullRequestOverviewPanel.permissionStore, this.context.repository, {
				scope,
				action,
				message: () => deniedMessage,
			});
		}

		if (!allowed) {
			vscode.window.showWarningMessage(deniedMessage);
			return false;
		}

		return true;
	}

	private async isCurrentUserPullRequestAuthor(): Promise<boolean> {
		const currentUserLogin = await this.store.getCurrentUserLogin();
		return canEditOwnPullRequest(currentUserLogin, this.detail?.author.login);
	}

	private renderError(error: unknown): string {
		if (error instanceof NotSignedInError) {
			return getOverviewErrorHtml('Sign in to GitCode', 'Authenticate first, then retry loading this pull request.', createNonce());
		}

		if (error instanceof ApiRequestError) {
			const description = error.statusCode === 401 || error.statusCode === 403
				? 'Your GitCode session is not authorized to read this pull request.'
				: `GitCode returned HTTP ${error.statusCode}.`;
			return getOverviewErrorHtml('Unable to load pull request', description, createNonce());
		}

		if (error instanceof Error) {
			return getOverviewErrorHtml('Unable to load pull request', error.message, createNonce());
		}

		return getOverviewErrorHtml('Unable to load pull request', 'An unknown error occurred.', createNonce());
	}

	private hasMissingDiffContexts(
		commentsSnapshot: PullRequestCommentsSnapshot,
		diffContexts: ReadonlyMap<string, DiffCommentContext> | undefined,
	): boolean {
		return commentsSnapshot.comments.some((comment) => comment.kind === 'diff'
			&& Boolean(comment.location.path)
			&& !diffContexts?.has(comment.id));
	}

	private mergeDiffContexts(
		primary: ReadonlyMap<string, DiffCommentContext> | undefined,
		fallback: ReadonlyMap<string, DiffCommentContext>,
	): ReadonlyMap<string, DiffCommentContext> {
		if (!primary?.size) {
			return fallback;
		}

		const merged = new Map(primary);
		for (const [commentId, context] of fallback) {
			if (!merged.has(commentId)) {
				merged.set(commentId, context);
			}
		}
		return merged;
	}

	// ---- Section-Level Editing ----

	private async handleSaveSection(section: EditPullRequestSection, input: EditPullRequestInput): Promise<void> {
		const treeStore = PullRequestOverviewPanel.treeStore;
		if (!treeStore) {
			return;
		}

		const authorCanEditSection = section === 'title' || section === 'body' || section === 'draft';
		if (!await this.checkWritePermission('pr', 'update', `You do not have permission to update pull requests in ${this.context.repository.fullName}.`, authorCanEditSection && await this.isCurrentUserPullRequestAuthor())) {
			return;
		}

		try {
			await this.store.editPullRequest(
				this.context.repository,
				this.context.pullRequestNumber,
				input,
			);

			vscode.window.showInformationMessage(
				`GitCode pull request #${this.context.pullRequestNumber} updated.`,
			);

			// Invalidate comments and refresh the pull request tree
			await this.commentsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
			if (PullRequestOverviewPanel.operationLogsStore) {
				await PullRequestOverviewPanel.operationLogsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
			}
			treeStore.refreshRepository(this.context.repository.fullName).catch(() => {
				treeStore.refreshAll();
			});

			// Reload the overview with fresh data
			this.commentsSnapshot = undefined;
			this.relatedIssuesSnapshot = undefined;
			this.operationLogsSnapshot = undefined;
			this.editOptions = undefined;
			await this.load(true);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to update pull request.';
			this.logger.error(`Failed to save section "${section}" for PR #${this.context.pullRequestNumber}: ${errorMessage}`);

			// Send the error back to the webview so the section stays in edit mode
			this.panel.webview.postMessage({
				command: 'sectionSaveError',
				section,
				message: errorMessage,
			});
		}
	}

	private async handleChangePullRequestState(state: string): Promise<void> {
		if (!this.detail) {
			return;
		}

		const errors = validatePullRequestStateChange(state, this.detail);
		if (errors.length) {
			this.panel.webview.postMessage({
				command: 'pullRequestStateChangeError',
				message: errors.join(' '),
			});
			return;
		}

		const permissionAction = state === 'closed' ? 'close' : 'reopen';
		const deniedMessage = state === 'closed'
			? `You do not have permission to close pull requests in ${this.context.repository.fullName}.`
			: `You do not have permission to reopen pull requests in ${this.context.repository.fullName}.`;
		if (!await this.checkWritePermission('pr', permissionAction, deniedMessage, await this.isCurrentUserPullRequestAuthor())) {
			return;
		}

		try {
			await this.store.editPullRequest(
				this.context.repository,
				this.context.pullRequestNumber,
				{
					state: state as 'open' | 'closed',
				},
			);

			vscode.window.showInformationMessage(
				`GitCode pull request #${this.context.pullRequestNumber} ${state === 'closed' ? 'closed' : 'reopened'}.`,
			);

			await this.commentsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
			if (PullRequestOverviewPanel.operationLogsStore) {
				await PullRequestOverviewPanel.operationLogsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
			}
			const treeStore = PullRequestOverviewPanel.treeStore;
			if (treeStore) {
				treeStore.refreshRepository(this.context.repository.fullName).catch(() => {
					treeStore.refreshAll();
				});
			}

			this.commentsSnapshot = undefined;
			this.relatedIssuesSnapshot = undefined;
			this.operationLogsSnapshot = undefined;
			this.editOptions = undefined;
			await this.load(true);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to update pull request state.';
			this.logger.error(`Failed to change state for PR #${this.context.pullRequestNumber}: ${errorMessage}`);
			this.panel.webview.postMessage({
				command: 'pullRequestStateChangeError',
				message: errorMessage,
			});
		}
	}

	private async handleSubmitPullRequestComment(body: string): Promise<void> {
		if (!this.detail) {
			this.panel.webview.postMessage({
				command: 'pullRequestCommentSubmitError',
				message: 'Pull request context is not available.',
			});
			return;
		}

		if (!await this.checkWritePermission('note', 'create', `You do not have permission to comment in ${this.context.repository.fullName}.`)) {
			return;
		}

		const errors = validatePullRequestCommentBody(body);
		if (errors.length) {
			this.panel.webview.postMessage({
				command: 'pullRequestCommentSubmitError',
				message: errors.join(' '),
			});
			return;
		}

		try {
			await this.commentsStore.submitComment(
				this.context.repository,
				this.context.pullRequestNumber,
				{
					kind: 'pullRequest',
					body,
				},
			);

			if (PullRequestOverviewPanel.operationLogsStore) {
				await PullRequestOverviewPanel.operationLogsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
			}

			this.commentsSnapshot = undefined;
			this.operationLogsSnapshot = undefined;
			await this.load(true);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to submit pull request comment.';
			this.logger.error(`Failed to submit comment for PR #${this.context.pullRequestNumber}: ${errorMessage}`);
			this.panel.webview.postMessage({
				command: 'pullRequestCommentSubmitError',
				message: errorMessage,
			});
		}
	}

	private async handleEditPullRequestComment(commentId: string, body: string): Promise<void> {
		if (!commentId) {
			this.panel.webview.postMessage({
				command: 'editPullRequestCommentError',
				commentId,
				message: 'Comment ID is required.',
			});
			return;
		}

		if (!body.trim()) {
			this.panel.webview.postMessage({
				command: 'editPullRequestCommentError',
				commentId,
				message: 'Comment body is required.',
			});
			return;
		}

		if (!await this.checkWritePermission('note', 'create', `You do not have permission to edit comments in ${this.context.repository.fullName}.`)) {
			return;
		}

		const result = await this.commentsStore.editComment(
			this.context.repository,
			this.context.pullRequestNumber,
			{ commentId, body },
		);

		if (result.status === 'failed') {
			this.panel.webview.postMessage({
				command: 'editPullRequestCommentError',
				commentId,
				message: result.error ?? 'Failed to edit comment.',
			});
			return;
		}

		// On success the store refreshes; reload to show updated comments
		if (PullRequestOverviewPanel.operationLogsStore) {
			await PullRequestOverviewPanel.operationLogsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
		}
		this.commentsSnapshot = undefined;
		this.operationLogsSnapshot = undefined;
		await this.load(true);
	}

	private async handleRevisePullRequestCommentStatus(discussionId: string, resolved: boolean): Promise<void> {
		if (!await this.checkWritePermission('note', 'resolve', `You do not have permission to resolve comments in ${this.context.repository.fullName}.`)) {
			return;
		}

		const result = await this.commentsStore.reviseCommentStatus(
			this.context.repository,
			this.context.pullRequestNumber,
			{ discussionId, resolved },
		);

		if (result.status === 'failed') {
			this.panel.webview.postMessage({
				command: 'reviseCommentStatusError',
				discussionId,
				error: result.error ?? 'Failed to revise comment status.',
			});
			return;
		}

		// On success, reload to show refreshed comments from the store
		if (PullRequestOverviewPanel.operationLogsStore) {
			await PullRequestOverviewPanel.operationLogsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
		}
		this.commentsSnapshot = undefined;
		this.operationLogsSnapshot = undefined;
		await this.load(true);
	}

	private async handleReplyPullRequestComment(discussionId: string, body: string): Promise<void> {
		if (!discussionId) {
			this.panel.webview.postMessage({
				command: 'replyPullRequestCommentError',
				discussionId,
				message: 'Discussion ID is required.',
			});
			return;
		}

		if (!body.trim()) {
			this.panel.webview.postMessage({
				command: 'replyPullRequestCommentError',
				discussionId,
				message: 'Reply body is required.',
			});
			return;
		}

		if (!await this.checkWritePermission('note', 'create', `You do not have permission to comment in ${this.context.repository.fullName}.`)) {
			return;
		}

		const result = await this.commentsStore.replyToComment(
			this.context.repository,
			this.context.pullRequestNumber,
			{ discussionId, body },
		);

		if (result.status === 'failed') {
			this.panel.webview.postMessage({
				command: 'replyPullRequestCommentError',
				discussionId,
				message: result.error ?? 'Failed to submit reply.',
			});
			return;
		}

		// On success, reload to show refreshed comments from the store
		if (PullRequestOverviewPanel.operationLogsStore) {
			await PullRequestOverviewPanel.operationLogsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
		}
		this.commentsSnapshot = undefined;
		this.operationLogsSnapshot = undefined;
		await this.load(true);
	}

	private async handleOpenDiffComment(path: string, line: number): Promise<void> {
		const treeStore = PullRequestOverviewPanel.treeStore;
		const diffController = PullRequestOverviewPanel.diffController;
		if (!treeStore || !diffController) {
			return;
		}

		try {
			const files = await treeStore.getPullRequestFiles(this.context.repository, this.context.pullRequestNumber);
			const file = files.find((candidate) => candidate.path === path || candidate.previousPath === path);
			if (!file) {
				await vscode.window.showWarningMessage(`Cannot find ${path} in pull request files.`);
				return;
			}

			await diffController.openDiff(
				this.context.repository,
				this.context.pullRequestNumber,
				file,
				{ line: Number.isFinite(line) ? line : undefined },
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to open pull request diff.';
			this.logger.error(`Failed to open diff comment location for PR #${this.context.pullRequestNumber}: ${message}`);
			await vscode.window.showErrorMessage(message);
		}
	}

	// ---- Reviewers ----

	static async addReviewerToCurrent(): Promise<boolean> {
		const activePanel = PullRequestOverviewPanel.activePanel;
		if (!activePanel) {
			await vscode.window.showInformationMessage('Open a pull request before adding a reviewer.');
			return false;
		}

		await activePanel.handleAddReviewers();
		return true;
	}

	static async removeReviewerFromCurrent(): Promise<boolean> {
		const activePanel = PullRequestOverviewPanel.activePanel;
		if (!activePanel) {
			await vscode.window.showInformationMessage('Open a pull request before removing a reviewer.');
			return false;
		}

		await activePanel.handleRemoveReviewers();
		return true;
	}

	private async handleAddReviewers(): Promise<void> {
		if (this.reviewerMutationInProgress) {
			return;
		}

		this.reviewerMutationInProgress = true;
		await this.reloadOverviewHtml();

		try {
			if (!await this.checkWritePermission('pr', 'update', `You do not have permission to update pull requests in ${this.context.repository.fullName}.`)) {
				return;
			}

			const currentReviewers = this.detail?.reviewers ?? [];
			const currentLogins = currentReviewers.map((reviewer) => reviewer.login);
			const selectedLogins = await this.promptReviewerLoginsToAdd(currentLogins);
			if (!selectedLogins.length) {
				return;
			}

			this.addReviewerInProgress = true;
			await this.reloadOverviewHtml();

			try {
				await this.store.addReviewers(
					this.context.repository,
					this.context.pullRequestNumber,
					selectedLogins,
				);

				if (PullRequestOverviewPanel.operationLogsStore) {
					await PullRequestOverviewPanel.operationLogsStore.refresh(
						this.context.repository.fullName,
						this.context.pullRequestNumber,
					);
				}

				const message = selectedLogins.length === 1
					? `Reviewer added to pull request #${this.context.pullRequestNumber}`
					: `Reviewers added to pull request #${this.context.pullRequestNumber}`;
				void vscode.window.showInformationMessage(message);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to add reviewers.';
				this.logger.error(
					`Failed to add reviewers to PR #${this.context.pullRequestNumber}: ${errorMessage}`,
				);
				void vscode.window.showErrorMessage(errorMessage);
			} finally {
				this.addReviewerInProgress = false;
			}

			await this.load(true);
		} finally {
			this.reviewerMutationInProgress = false;
			await this.reloadOverviewHtml();
		}
	}

	private async promptReviewerLoginsToAdd(currentLogins: readonly string[]): Promise<string[]> {
		let reviewers: GitCodeUser[];
		try {
			reviewers = await this.store.listSelectableReviewers(
				this.context.repository,
				this.context.pullRequestNumber,
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to load reviewers.';
			this.logger.error(
				`Failed to list selectable reviewers for PR #${this.context.pullRequestNumber}: ${errorMessage}`,
			);
			void vscode.window.showErrorMessage(errorMessage);
			return [];
		}
		const availableReviewers = getAddableReviewers(reviewers, currentLogins, this.detail?.author.login);

		if (!availableReviewers.length) {
			await vscode.window.showInformationMessage('No additional reviewers are available for this pull request.');
			return [];
		}

		const picked = await vscode.window.showQuickPick(
			availableReviewers.map(formatReviewerQuickPickItem),
			{
				title: `Select reviewers for PR #${this.context.pullRequestNumber}`,
				placeHolder: 'Choose one or more reviewers to add',
				canPickMany: true,
			},
		);

		if (!picked?.length) {
			return [];
		}

		return [...new Set(picked.map((item) => item.login).filter((login) => login.trim().length > 0))];
	}

	private async handleRemoveReviewers(logins?: readonly string[]): Promise<void> {
		if (this.reviewerMutationInProgress) {
			return;
		}

		this.reviewerMutationInProgress = true;
		await this.reloadOverviewHtml();

		try {
			if (!await this.checkWritePermission('pr', 'update', `You do not have permission to update pull requests in ${this.context.repository.fullName}.`)) {
				return;
			}

			const currentReviewers = this.detail?.reviewers ?? [];
			if (!currentReviewers.length) {
				await vscode.window.showInformationMessage('No reviewers to remove.');
				return;
			}

			let selectedLogins: string[];
			if (logins?.length) {
				const currentLogins = new Set(currentReviewers.map((reviewer) => reviewer.login));
				selectedLogins = [...new Set(logins.map((login) => login.trim()))].filter((login) => currentLogins.has(login));
				if (!selectedLogins.length) {
					await vscode.window.showInformationMessage('Selected reviewers are no longer assigned to this pull request.');
					return;
				}
			} else {
				const picked = await vscode.window.showQuickPick(
					currentReviewers.map(formatReviewerQuickPickItem),
					{
						title: `Select reviewers to remove from PR #${this.context.pullRequestNumber}`,
						placeHolder: 'Choose one or more reviewers to remove',
						canPickMany: true,
					},
				);

				if (!picked?.length) {
					return;
				}

				selectedLogins = [...new Set(picked.map((item) => item.login).filter((login) => login.trim().length > 0))];
			}

			if (!selectedLogins.length) {
				return;
			}

			const reviewerList = selectedLogins.map((login) => `@${login}`).join(', ');
			const confirmMessage = selectedLogins.length === 1
				? `Remove reviewer ${reviewerList} from PR #${this.context.pullRequestNumber}?`
				: `Remove reviewers ${reviewerList} from PR #${this.context.pullRequestNumber}?`;
			const choice = await vscode.window.showWarningMessage(
				confirmMessage,
				{ modal: true },
				'Remove reviewer',
			);

			if (choice !== 'Remove reviewer') {
				return;
			}

			this.removeReviewerInProgress = true;
			this.removingReviewerLogins = selectedLogins;
			await this.reloadOverviewHtml();

			try {
				await this.store.removeReviewers(
					this.context.repository,
					this.context.pullRequestNumber,
					selectedLogins,
				);

				if (PullRequestOverviewPanel.operationLogsStore) {
					await PullRequestOverviewPanel.operationLogsStore.refresh(
						this.context.repository.fullName,
						this.context.pullRequestNumber,
					);
				}

				const message = selectedLogins.length === 1
					? `Reviewer removed from pull request #${this.context.pullRequestNumber}`
					: `Reviewers removed from pull request #${this.context.pullRequestNumber}`;
				void vscode.window.showInformationMessage(message);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to remove reviewers.';
				this.logger.error(
					`Failed to remove reviewers from PR #${this.context.pullRequestNumber}: ${errorMessage}`,
				);
				void vscode.window.showErrorMessage(errorMessage);
			} finally {
				this.removeReviewerInProgress = false;
				this.removingReviewerLogins = [];
			}

			await this.load(true);
		} finally {
			this.reviewerMutationInProgress = false;
			await this.reloadOverviewHtml();
		}
	}

	// ---- Testers ----

	static async addTesterToCurrent(): Promise<boolean> {
		const activePanel = PullRequestOverviewPanel.activePanel;
		if (!activePanel) {
			await vscode.window.showInformationMessage('Open a pull request before adding a tester.');
			return false;
		}

		await activePanel.handleAddTesters();
		return true;
	}

	static async removeTesterFromCurrent(): Promise<boolean> {
		const activePanel = PullRequestOverviewPanel.activePanel;
		if (!activePanel) {
			await vscode.window.showInformationMessage('Open a pull request before removing a tester.');
			return false;
		}

		await activePanel.handleRemoveTesters();
		return true;
	}

	private async handleAddTesters(): Promise<void> {
		if (this.testerMutationInProgress) {
			return;
		}

		this.testerMutationInProgress = true;
		await this.reloadOverviewHtml();

		try {
			if (!await this.checkWritePermission('pr', 'update', `You do not have permission to update pull requests in ${this.context.repository.fullName}.`)) {
				return;
			}

			const currentTesters = this.detail?.testers ?? [];
			const currentLogins = currentTesters.map((tester) => tester.login);
			const selectedLogins = await this.promptTesterLoginsToAdd(currentLogins);
			if (!selectedLogins.length) {
				return;
			}

			this.addTesterInProgress = true;
			await this.reloadOverviewHtml();

			try {
				await this.store.addTesters(
					this.context.repository,
					this.context.pullRequestNumber,
					selectedLogins,
				);

				if (PullRequestOverviewPanel.operationLogsStore) {
					await PullRequestOverviewPanel.operationLogsStore.refresh(
						this.context.repository.fullName,
						this.context.pullRequestNumber,
					);
				}

				const message = selectedLogins.length === 1
					? `Tester added to pull request #${this.context.pullRequestNumber}`
					: `Testers added to pull request #${this.context.pullRequestNumber}`;
				void vscode.window.showInformationMessage(message);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to add testers.';
				this.logger.error(
					`Failed to add testers to PR #${this.context.pullRequestNumber}: ${errorMessage}`,
				);
				void vscode.window.showErrorMessage(errorMessage);
			} finally {
				this.addTesterInProgress = false;
			}

			await this.load(true);
		} finally {
			this.testerMutationInProgress = false;
			await this.reloadOverviewHtml();
		}
	}

	private async promptTesterLoginsToAdd(currentLogins: readonly string[]): Promise<string[]> {
		let testers: GitCodeUser[];
		try {
			testers = await this.store.listSelectableTesters(
				this.context.repository,
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to load testers.';
			this.logger.error(
				`Failed to list selectable testers for PR #${this.context.pullRequestNumber}: ${errorMessage}`,
			);
			void vscode.window.showErrorMessage(errorMessage);
			return [];
		}
		const availableTesters = getAddableTesters(testers, currentLogins, this.detail?.author.login);

		if (!availableTesters.length) {
			await vscode.window.showInformationMessage('No additional testers are available for this pull request.');
			return [];
		}

		const picked = await vscode.window.showQuickPick(
			availableTesters.map(formatReviewerQuickPickItem),
			{
				title: `Select testers for PR #${this.context.pullRequestNumber}`,
				placeHolder: 'Choose one or more testers to add',
				canPickMany: true,
			},
		);

		if (!picked?.length) {
			return [];
		}

		return [...new Set(picked.map((item) => item.login).filter((login) => login.trim().length > 0))];
	}

	private async handleRemoveTesters(logins?: readonly string[]): Promise<void> {
		if (this.testerMutationInProgress) {
			return;
		}

		this.testerMutationInProgress = true;
		await this.reloadOverviewHtml();

		try {
			if (!await this.checkWritePermission('pr', 'update', `You do not have permission to update pull requests in ${this.context.repository.fullName}.`)) {
				return;
			}

			const currentTesters = this.detail?.testers ?? [];
			if (!currentTesters.length) {
				await vscode.window.showInformationMessage('No testers to remove.');
				return;
			}

			let selectedLogins: string[];
			if (logins?.length) {
				const currentLogins = new Set(currentTesters.map((tester) => tester.login));
				selectedLogins = [...new Set(logins.map((login) => login.trim()))].filter((login) => currentLogins.has(login));
				if (!selectedLogins.length) {
					await vscode.window.showInformationMessage('Selected testers are no longer assigned to this pull request.');
					return;
				}
			} else {
				const picked = await vscode.window.showQuickPick(
					currentTesters.map(formatReviewerQuickPickItem),
					{
						title: `Select testers to remove from PR #${this.context.pullRequestNumber}`,
						placeHolder: 'Choose one or more testers to remove',
						canPickMany: true,
					},
				);

				if (!picked?.length) {
					return;
				}

				selectedLogins = [...new Set(picked.map((item) => item.login).filter((login) => login.trim().length > 0))];
			}

			if (!selectedLogins.length) {
				return;
			}

			const testerList = selectedLogins.map((login) => `@${login}`).join(', ');
			const confirmMessage = selectedLogins.length === 1
				? `Remove tester ${testerList} from PR #${this.context.pullRequestNumber}?`
				: `Remove testers ${testerList} from PR #${this.context.pullRequestNumber}?`;
			const choice = await vscode.window.showWarningMessage(
				confirmMessage,
				{ modal: true },
				'Remove tester',
			);

			if (choice !== 'Remove tester') {
				return;
			}

			this.removeTesterInProgress = true;
			this.removingTesterLogins = selectedLogins;
			await this.reloadOverviewHtml();

			try {
				await this.store.removeTesters(
					this.context.repository,
					this.context.pullRequestNumber,
					selectedLogins,
				);

				if (PullRequestOverviewPanel.operationLogsStore) {
					await PullRequestOverviewPanel.operationLogsStore.refresh(
						this.context.repository.fullName,
						this.context.pullRequestNumber,
					);
				}

				const message = selectedLogins.length === 1
					? `Tester removed from pull request #${this.context.pullRequestNumber}`
					: `Testers removed from pull request #${this.context.pullRequestNumber}`;
				void vscode.window.showInformationMessage(message);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to remove testers.';
				this.logger.error(
					`Failed to remove testers from PR #${this.context.pullRequestNumber}: ${errorMessage}`,
				);
				void vscode.window.showErrorMessage(errorMessage);
			} finally {
				this.removeTesterInProgress = false;
				this.removingTesterLogins = [];
			}

			await this.load(true);
		} finally {
			this.testerMutationInProgress = false;
			await this.reloadOverviewHtml();
		}
	}

	// ---- Add Related Issue ----

	static async addRelatedIssueToCurrent(): Promise<boolean> {
		const activePanel = PullRequestOverviewPanel.activePanel;
		if (!activePanel) {
			await vscode.window.showInformationMessage('Open a pull request before adding a related issue.');
			return false;
		}

		await activePanel.handleAddRelatedIssue();
		return true;
	}

	static async removeRelatedIssueFromCurrent(): Promise<boolean> {
		const activePanel = PullRequestOverviewPanel.activePanel;
		if (!activePanel) {
			await vscode.window.showInformationMessage('Open a pull request before removing a related issue.');
			return false;
		}

		await activePanel.handleRemoveRelatedIssues();
		return true;
	}

	private async handleAddRelatedIssue(): Promise<void> {
		if (this.addRelatedIssueInProgress) {
			return;
		}

		if (!await this.checkWritePermission('pr', 'update', `You do not have permission to update pull requests in ${this.context.repository.fullName}.`)) {
			return;
		}

		const linkedNumbers = (this.relatedIssuesSnapshot?.issues ?? []).map((issue) => issue.number);
		const filteredNumbers = await this.promptRelatedIssueNumbers(linkedNumbers);
		if (!filteredNumbers.length) {
			return; // User cancelled
		}

		this.addRelatedIssueInProgress = true;
		await this.reloadOverviewHtml();

		try {
			await this.store.addRelatedIssues(
				this.context.repository,
				this.context.pullRequestNumber,
				filteredNumbers,
			);

			this.addRelatedIssueInProgress = false;

			const message = filteredNumbers.length === 1
				? `Related issue added to pull request #${this.context.pullRequestNumber}`
				: `Related issues added to pull request #${this.context.pullRequestNumber}`;
			void vscode.window.showInformationMessage(message);

			// Refresh related issues and operation logs
			if (PullRequestOverviewPanel.operationLogsStore) {
				await PullRequestOverviewPanel.operationLogsStore.refresh(
					this.context.repository.fullName,
					this.context.pullRequestNumber,
				);
			}
			this.commentsSnapshot = undefined;
			this.relatedIssuesSnapshot = undefined;
			this.operationLogsSnapshot = undefined;
			this.editOptions = undefined;
		} catch (error) {
			this.addRelatedIssueInProgress = false;
			const errorMessage = error instanceof Error ? error.message : 'Failed to add related issues.';
			this.logger.error(
				`Failed to add related issues to PR #${this.context.pullRequestNumber}: ${errorMessage}`,
			);
			void vscode.window.showErrorMessage(errorMessage);
		} finally {
			this.addRelatedIssueInProgress = false;
		}

		// Reload the overview with fresh data
		await this.load(true);
	}

	private async promptRelatedIssueNumbers(linkedNumbers: readonly number[]): Promise<number[]> {
		let issues: IssueSummary[] = [];
		try {
			issues = await this.store.listLinkableIssues(this.context.repository);
		} catch (error) {
			this.logger.debug(
				`Failed to list issues for related issue picker in ${this.context.repository.fullName}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		const linkableIssues = getLinkableIssues(issues, linkedNumbers);
		if (!linkableIssues.length) {
			return this.promptRelatedIssueNumbersManually(linkedNumbers);
		}

		const manualItem: RelatedIssueQuickPickItem = {
			label: '$(edit) Enter issue numbers manually',
			description: 'Use when an issue is not shown in the list',
			manual: true,
			alwaysShow: true,
		};
		const picked = await vscode.window.showQuickPick(
			[
				manualItem,
				...linkableIssues.map(formatRelatedIssueQuickPickItem),
			],
			{
				title: `Select issues to link to PR #${this.context.pullRequestNumber}`,
				placeHolder: 'Choose one or more issues, or enter issue numbers manually',
				canPickMany: true,
			},
		);

		if (!picked) {
			return [];
		}

		if (picked.some((item) => item.manual)) {
			return this.promptRelatedIssueNumbersManually(linkedNumbers);
		}

		return picked
			.map((item) => item.issueNumber)
			.filter((issueNumber): issueNumber is number => issueNumber !== undefined);
	}

	private async promptRelatedIssueNumbersManually(linkedNumbers: readonly number[]): Promise<number[]> {
		const input = await vscode.window.showInputBox({
			title: `Issue numbers to link to PR #${this.context.pullRequestNumber}`,
			placeHolder: 'Example: 339 or 339,341,342',
			prompt: 'Enter one or more issue numbers, separated by commas.',
			validateInput: (value) => validateIssueNumberInput(value, linkedNumbers),
		});

		if (input === undefined) {
			return [];
		}

		const issueNumbers = parseIssueNumbers(input);
		const filteredNumbers = issueNumbers.filter((n) => !linkedNumbers.includes(n));
		if (!filteredNumbers.length) {
			await vscode.window.showInformationMessage(
				'All selected issues are already related to this pull request.',
			);
		}

		return filteredNumbers;
	}

	private async handleRemoveRelatedIssues(issueNumbers?: readonly number[]): Promise<void> {
		if (this.removeRelatedIssueInProgress) {
			return;
		}

		if (!await this.checkWritePermission('pr', 'update', `You do not have permission to update pull requests in ${this.context.repository.fullName}.`)) {
			return;
		}

		// Validate that we have a related issues snapshot loaded
		const currentIssues = this.relatedIssuesSnapshot?.issues ?? [];
		if (!currentIssues.length) {
			await vscode.window.showInformationMessage('No related issues to remove.');
			return;
		}

		let selectedNumbers: number[];
		if (issueNumbers && issueNumbers.length > 0) {
			// Row-level action: validate that the numbers are in the current snapshot
			const currentNumbers = new Set(currentIssues.map((i) => i.number));
			selectedNumbers = [...new Set(issueNumbers)].filter((n) => currentNumbers.has(n));
			if (!selectedNumbers.length) {
				await vscode.window.showInformationMessage('Selected issues are no longer related to this pull request.');
				return;
			}
		} else {
			// Command palette: show multi-select quick pick
			const items = currentIssues.map((issue) => ({
				label: `#${issue.number} ${issue.title}`,
				description: issue.state === 'closed' ? 'Closed' : 'Open',
				issueNumber: issue.number,
			}));

			const picked = await vscode.window.showQuickPick(items, {
				title: `Select related issues to unlink from PR #${this.context.pullRequestNumber}`,
				placeHolder: 'Choose one or more issues to unlink',
				canPickMany: true,
			});

			if (!picked || !picked.length) {
				return;
			}

			selectedNumbers = [...new Set(picked.map((p) => p.issueNumber))];
		}

		if (!selectedNumbers.length) {
			return;
		}

		// Confirm
		const issueList = selectedNumbers.map((n) => `#${n}`).join(', ');
		const confirmMessage = selectedNumbers.length === 1
			? `Unlink issue ${issueList} from PR #${this.context.pullRequestNumber}?`
			: `Unlink issues ${issueList} from PR #${this.context.pullRequestNumber}?`;

		const choice = await vscode.window.showWarningMessage(
			confirmMessage,
			{ modal: true },
			'Unlink issue',
		);

		if (choice !== 'Unlink issue') {
			return;
		}

		this.removeRelatedIssueInProgress = true;
		this.removingRelatedIssueNumbers = selectedNumbers;
		await this.reloadOverviewHtml();

		try {
			await this.store.removeRelatedIssues(
				this.context.repository,
				this.context.pullRequestNumber,
				selectedNumbers,
			);

			this.removeRelatedIssueInProgress = false;
			this.removingRelatedIssueNumbers = [];

			const message = selectedNumbers.length === 1
				? `Related issue unlinked from pull request #${this.context.pullRequestNumber}`
				: `Related issues unlinked from pull request #${this.context.pullRequestNumber}`;
			void vscode.window.showInformationMessage(message);

			// Refresh related issues and operation logs
			if (PullRequestOverviewPanel.operationLogsStore) {
				await PullRequestOverviewPanel.operationLogsStore.refresh(
					this.context.repository.fullName,
					this.context.pullRequestNumber,
				);
			}
			this.commentsSnapshot = undefined;
			this.relatedIssuesSnapshot = undefined;
			this.operationLogsSnapshot = undefined;
			this.editOptions = undefined;
		} catch (error) {
			this.removeRelatedIssueInProgress = false;
			this.removingRelatedIssueNumbers = [];
			const errorMessage = error instanceof Error ? error.message : 'Failed to unlink related issues.';
			this.logger.error(
				`Failed to unlink related issues from PR #${this.context.pullRequestNumber}: ${errorMessage}`,
			);
			void vscode.window.showErrorMessage(errorMessage);
		} finally {
			this.removeRelatedIssueInProgress = false;
			this.removingRelatedIssueNumbers = [];
		}

		// Reload the overview with fresh data
		await this.load(true);
	}

	private async reloadOverviewHtml(): Promise<void> {
		// Re-render the existing overview HTML with the updated in-progress state
		// so the add button shows a spinner
		if (!this.detail) {
			return;
		}

		const relatedIssuesOptions = this.buildRelatedIssuesOptions();

		let relatedIssuesHtml: string;
		if (this.relatedIssuesSnapshot) {
			relatedIssuesHtml = renderRelatedIssuesSection(this.relatedIssuesSnapshot, relatedIssuesOptions);
		} else {
			relatedIssuesHtml = renderRelatedIssuesLoading(relatedIssuesOptions);
		}

		if (this.commentsSnapshot) {
			this.panel.webview.html = getOverviewWithTimelineHtml(
				this.detail,
				this.commentsSnapshot,
				createNonce(),
				relatedIssuesHtml,
				this.editOptions,
				undefined,
				this.operationLogsSnapshot,
				undefined,
				this.permissions,
				this.buildReviewerOptions(),
				this.buildTesterOptions(),
			);
		} else {
			this.panel.webview.html = getOverviewWithCommentsLoadingHtml(
				this.detail,
				createNonce(),
				relatedIssuesHtml,
				undefined,
				undefined,
				this.permissions,
				this.buildReviewerOptions(),
				this.buildTesterOptions(),
			);
		}
	}

	private buildReviewerOptions() {
		return {
			canAddReviewer: this.permissions.canUpdateReviewers,
			reviewerMutationInProgress: this.reviewerMutationInProgress,
			addReviewerInProgress: this.addReviewerInProgress,
			canRemoveReviewer: this.permissions.canUpdateReviewers,
			removeReviewerInProgress: this.removeReviewerInProgress,
			removingReviewerLogins: this.removingReviewerLogins,
		};
	}

	private buildTesterOptions() {
		return {
			canAddTester: this.permissions.canUpdateTesters,
			testerMutationInProgress: this.testerMutationInProgress,
			addTesterInProgress: this.addTesterInProgress,
			canRemoveTester: this.permissions.canUpdateTesters,
			removeTesterInProgress: this.removeTesterInProgress,
			removingTesterLogins: this.removingTesterLogins,
		};
	}

	private buildRelatedIssuesOptions() {
		return {
			canAddRelatedIssue: this.permissions.canUpdateRelatedIssues,
			addRelatedIssueInProgress: this.addRelatedIssueInProgress,
			canRemoveRelatedIssue: this.permissions.canUpdateRelatedIssues,
			removeRelatedIssueInProgress: this.removeRelatedIssueInProgress,
			removingRelatedIssueNumbers: this.removingRelatedIssueNumbers,
		};
	}
}

export function getAddableReviewers(
	reviewers: readonly GitCodeUser[],
	currentLogins: readonly string[],
	authorLogin?: string,
): GitCodeUser[] {
	const excluded = new Set(currentLogins.map(normalizeLogin).filter((login) => login.length > 0));
	const normalizedAuthorLogin = normalizeLogin(authorLogin);
	if (normalizedAuthorLogin) {
		excluded.add(normalizedAuthorLogin);
	}

	return reviewers.filter((reviewer) => {
		const reviewerLogin = normalizeLogin(reviewer.login);
		return reviewerLogin.length > 0 && !excluded.has(reviewerLogin);
	});
}

export function getAddableTesters(
	testers: readonly GitCodeUser[],
	currentLogins: readonly string[],
	authorLogin?: string,
): GitCodeUser[] {
	const excluded = new Set(currentLogins.map(normalizeLogin).filter((login) => login.length > 0));
	const normalizedAuthorLogin = normalizeLogin(authorLogin);
	if (normalizedAuthorLogin) {
		excluded.add(normalizedAuthorLogin);
	}

	return testers.filter((tester) => {
		const testerLogin = normalizeLogin(tester.login);
		return testerLogin.length > 0 && !excluded.has(testerLogin);
	});
}

function normalizeLogin(login?: string): string {
	return login?.trim().toLowerCase() ?? '';
}

export function formatReviewerQuickPickItem(reviewer: GitCodeUser): ReviewerQuickPickItem {
	const displayName = reviewer.name && reviewer.name !== reviewer.login
		? reviewer.name
		: undefined;
	return {
		label: `@${reviewer.login}`,
		description: displayName,
		detail: reviewer.htmlUrl,
		login: reviewer.login,
	};
}

export function validateIssueNumberInput(value: string, linkedNumbers: readonly number[]): string | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return 'Enter at least one issue number.';
	}

	const parts = trimmed.split(/[,\s\n]+/).filter((p) => p.length > 0);
	for (const part of parts) {
		const num = Number(part);
		if (!Number.isInteger(num) || num <= 0) {
			return 'Issue numbers must be positive integers.';
		}
	}

	const numbers = parts.map(Number);
	const newNumbers = numbers.filter((n) => !linkedNumbers.includes(n));
	if (newNumbers.length === 0) {
		return 'All selected issues are already related to this pull request.';
	}

	return null; // Valid
}

export function parseIssueNumbers(input: string): number[] {
	const trimmed = input.trim();
	if (!trimmed) {
		return [];
	}

	const parts = trimmed.split(/[,\s\n]+/).filter((p) => p.length > 0);
	const numbers = parts.map(Number).filter((n) => Number.isInteger(n) && n > 0);

	// Deduplicate
	return [...new Set(numbers)];
}

export function getLinkableIssues(
	issues: readonly IssueSummary[],
	linkedNumbers: readonly number[],
): IssueSummary[] {
	const linked = new Set(linkedNumbers);
	return issues.filter((issue) => !linked.has(issue.number));
}

export function formatRelatedIssueQuickPickItem(issue: IssueSummary): RelatedIssueQuickPickItem {
	const meta = [
		issue.state === 'closed' ? 'Closed' : 'Open',
		issue.author.login ? `@${issue.author.login}` : undefined,
		issue.issueType,
		issue.issueState,
	]
		.filter((part): part is string => Boolean(part))
		.join(' | ');

	return {
		label: `#${issue.number} ${issue.title}`,
		description: meta,
		detail: issue.labels.map((label) => label.name).join(', '),
		issueNumber: issue.number,
	};
}
