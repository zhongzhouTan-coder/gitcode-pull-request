import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ApiRequestError, NotSignedInError } from '../../common/errors';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { EditPullRequestInput, EditPullRequestOptions, EditPullRequestSection, GitCodeRepository, PullRequestCommentsSnapshot, PullRequestDetail, PullRequestRelatedIssuesSnapshot } from '../../common/models';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { PullRequestTreeStore } from '../state/pullRequestTreeStore';
import { PullRequestDiffController } from '../diff/pullRequestDiffController';
import { RepositoryService } from '../../gitcode/services/repositoryService';
import { PullRequestService } from '../../gitcode/services/pullRequestService';
import { getOverviewErrorHtml, getOverviewLoadingHtml, getOverviewWithCommentsHtml, getOverviewWithCommentsLoadingHtml, getOverviewWithCommentsErrorHtml, renderRelatedIssuesSection, renderRelatedIssuesLoading, renderRelatedIssuesError } from './overviewHtml';
import { PullRequestOverviewStore } from './pullRequestOverviewStore';
import { buildDiffCommentContexts } from './diffCommentContext';

interface PullRequestOverviewContext {
	repository: GitCodeRepository;
	pullRequestNumber: number;
	url?: string;
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
	private editOptions?: EditPullRequestOptions;

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
		this.commentsSnapshot = undefined;
		this.relatedIssuesSnapshot = undefined;
		await this.load(true);
	}

	private async load(forceRefresh: boolean): Promise<void> {
		if (forceRefresh) {
			this.detail = undefined;
			this.commentsSnapshot = undefined;
			this.relatedIssuesSnapshot = undefined;
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

		// Render detail with loading comments and loading related issues
		const relatedIssuesLoadingHtml = renderRelatedIssuesLoading();
		this.panel.webview.html = getOverviewWithCommentsLoadingHtml(this.detail, createNonce(), relatedIssuesLoadingHtml);

		// Phase 2: Load comments and related issues independently in parallel
		const commentsPromise = this.commentsStore.getOrFetch(
			this.context.repository,
			this.context.pullRequestNumber,
		);

		const editOptionsPromise = this.store.getEditOptions(
			this.context.repository,
		);

		const relatedIssuesPromise = this.store.getRelatedIssues(
			this.context.repository,
			this.context.pullRequestNumber,
		);

		// Wait for both and render
		const [commentsResult, relatedIssuesResult, editOptionsResult] = await Promise.allSettled([commentsPromise, relatedIssuesPromise, editOptionsPromise]);

		let commentsSnapshot: PullRequestCommentsSnapshot | undefined;
		let relatedIssuesSnapshot: PullRequestRelatedIssuesSnapshot | undefined;
		let commentsError: string | undefined;
		let relatedIssuesError: string | undefined;

		if (commentsResult.status === 'fulfilled') {
			commentsSnapshot = commentsResult.value;
		} else {
			const error = commentsResult.reason;
			this.logger.error(
				`Failed to load comments for PR #${this.context.pullRequestNumber}: ${error instanceof Error ? error.message : String(error)}`,
			);
			commentsError = error instanceof Error ? error.message : 'Unable to load comments.';
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
		let relatedIssuesHtml: string;
		if (relatedIssuesSnapshot) {
			relatedIssuesHtml = renderRelatedIssuesSection(relatedIssuesSnapshot);
		} else if (relatedIssuesError) {
			relatedIssuesHtml = renderRelatedIssuesError(relatedIssuesError);
		} else {
			relatedIssuesHtml = '';
		}

		// Build comments HTML
		if (commentsSnapshot) {
			let diffContexts;
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

			this.panel.webview.html = getOverviewWithCommentsHtml(this.detail, commentsSnapshot, createNonce(), relatedIssuesHtml, this.editOptions, diffContexts);
		} else {
			const errorMessage = commentsError ?? 'Unable to load comments.';
			this.panel.webview.html = getOverviewWithCommentsErrorHtml(this.detail, errorMessage, createNonce(), relatedIssuesHtml, this.editOptions);
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

	// ---- Section-Level Editing ----

	private async handleSaveSection(section: EditPullRequestSection, input: EditPullRequestInput): Promise<void> {
		const treeStore = PullRequestOverviewPanel.treeStore;
		if (!treeStore) {
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
			treeStore.refreshRepository(this.context.repository.fullName).catch(() => {
				treeStore.refreshAll();
			});

			// Reload the overview with fresh data
			this.commentsSnapshot = undefined;
			this.relatedIssuesSnapshot = undefined;
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

		try {
			await this.store.editPullRequest(
				this.context.repository,
				this.context.pullRequestNumber,
				{
					title: this.detail.title,
					state: state as 'open' | 'closed',
				},
			);

			vscode.window.showInformationMessage(
				`GitCode pull request #${this.context.pullRequestNumber} ${state === 'closed' ? 'closed' : 'reopened'}.`,
			);

			await this.commentsStore.refresh(this.context.repository.fullName, this.context.pullRequestNumber);
			const treeStore = PullRequestOverviewPanel.treeStore;
			if (treeStore) {
				treeStore.refreshRepository(this.context.repository.fullName).catch(() => {
					treeStore.refreshAll();
				});
			}

			this.commentsSnapshot = undefined;
			this.relatedIssuesSnapshot = undefined;
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

			this.commentsSnapshot = undefined;
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
		this.commentsSnapshot = undefined;
		await this.load(true);
	}

	private async handleRevisePullRequestCommentStatus(discussionId: string, resolved: boolean): Promise<void> {
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
		this.commentsSnapshot = undefined;
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
}
