import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ApiRequestError, NotSignedInError } from '../../common/errors';
import { Logger } from '../../common/logger';
import { GitCodeRepository, PullRequestCommentsSnapshot, PullRequestDetail } from '../../common/models';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { getOverviewErrorHtml, getOverviewLoadingHtml, getOverviewWithCommentsHtml, getOverviewWithCommentsLoadingHtml, getOverviewWithCommentsErrorHtml } from './overviewHtml';
import { PullRequestOverviewStore } from './pullRequestOverviewStore';

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

export class PullRequestOverviewPanel implements vscode.Disposable {
	private static readonly panels = new Map<string, PullRequestOverviewPanel>();
	private static activePanel: PullRequestOverviewPanel | undefined;

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

	private detail?: PullRequestDetail;
	private commentsSnapshot?: PullRequestCommentsSnapshot;

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

		this.panel.webview.onDidReceiveMessage(async (message: { command?: string }) => {
			if (message.command === 'refresh') {
				await this.refresh();
				return;
			}

			if (message.command === 'openOnWeb') {
				await this.openOnWeb();
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
		await this.load(true);
	}

	private async load(forceRefresh: boolean): Promise<void> {
		if (forceRefresh) {
			this.detail = undefined;
			this.commentsSnapshot = undefined;
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

		// Render detail with loading comments
		this.panel.webview.html = getOverviewWithCommentsLoadingHtml(this.detail, createNonce());

		// Phase 2: Load comments independently
		try {
			this.commentsSnapshot = await this.commentsStore.getOrFetch(
				this.context.repository,
				this.context.pullRequestNumber,
			);
			this.panel.webview.html = getOverviewWithCommentsHtml(this.detail, this.commentsSnapshot, createNonce());
		} catch (error) {
			this.logger.error(
				`Failed to load comments for PR #${this.context.pullRequestNumber}: ${error instanceof Error ? error.message : String(error)}`,
			);
			// Render detail with comment error — detail is still visible
			const errorMessage = error instanceof Error ? error.message : 'Unable to load comments.';
			this.panel.webview.html = getOverviewWithCommentsErrorHtml(this.detail, errorMessage, createNonce());
		}
	}

	private async openOnWeb(): Promise<void> {
		const url = this.detail?.htmlUrl ?? this.detail?.url ?? this.context.url;
		if (!url) {
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
}
