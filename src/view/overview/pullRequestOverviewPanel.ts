import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ApiRequestError, NotSignedInError } from '../../common/errors';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { GitCodeRepository, PullRequestCommentsSnapshot, PullRequestDetail, PullRequestRelatedIssuesSnapshot } from '../../common/models';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { getOverviewErrorHtml, getOverviewLoadingHtml, getOverviewWithCommentsHtml, getOverviewWithCommentsLoadingHtml, getOverviewWithCommentsErrorHtml, renderRelatedIssuesSection, renderRelatedIssuesLoading, renderRelatedIssuesError } from './overviewHtml';
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
	private relatedIssuesSnapshot?: PullRequestRelatedIssuesSnapshot;

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

		this.panel.webview.onDidReceiveMessage(async (message: { command?: string; url?: string; repository?: string; issue?: number | string }) => {
			if (message.command === 'refresh') {
				await this.refresh();
				return;
			}

			if (message.command === 'openOnWeb') {
				await this.openOnWeb();
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

		const relatedIssuesPromise = this.store.getRelatedIssues(
			this.context.repository,
			this.context.pullRequestNumber,
		);

		// Wait for both and render
		const [commentsResult, relatedIssuesResult] = await Promise.allSettled([commentsPromise, relatedIssuesPromise]);

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
			this.panel.webview.html = getOverviewWithCommentsHtml(this.detail, commentsSnapshot, createNonce(), relatedIssuesHtml);
		} else {
			const errorMessage = commentsError ?? 'Unable to load comments.';
			this.panel.webview.html = getOverviewWithCommentsErrorHtml(this.detail, errorMessage, createNonce(), relatedIssuesHtml);
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
}
