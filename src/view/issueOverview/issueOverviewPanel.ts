import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ApiRequestError, NotSignedInError } from '../../common/errors';
import { Logger } from '../../common/logger';
import { IssueCommentsSnapshot, IssueDetail, IssueRelatedPullRequestsSnapshot, GitCodeRepository } from '../../common/models';
import { getIssueErrorHtml, getIssueLoadingHtml, getIssueOverviewHtml } from './issueOverviewHtml';
import { IssueOverviewStore } from './issueOverviewStore';
import { IssueCommentsStore } from './issueCommentsStore';
import { IssueRelatedPullRequestsStore } from './issueRelatedPullRequestsStore';
import { PullRequestOverviewPanel } from '../overview/pullRequestOverviewPanel';
import { PullRequestOverviewStore } from '../overview/pullRequestOverviewStore';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';

interface IssueOverviewContext {
	repository: GitCodeRepository;
	issueNumber: number;
	url?: string;
}

function createNonce(): string {
	return crypto.randomBytes(16).toString('base64');
}

function keyFor(repository: GitCodeRepository, issueNumber: number): string {
	return `${repository.fullName}#${issueNumber}`;
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

function repositoryFullNameFromUrl(url: string | undefined, currentRepository: GitCodeRepository): string | undefined {
	if (!url || !isTrustedGitCodeUrl(url, currentRepository.webUrl)) {
		return undefined;
	}

	try {
		const parsedUrl = new URL(url);
		const [owner, name] = parsedUrl.pathname.split('/').filter(Boolean);
		return owner && name ? `${owner}/${name}` : undefined;
	} catch {
		return undefined;
	}
}

export function resolveRelatedPullRequestRepository(
	currentRepository: GitCodeRepository,
	targetRepositoryFullName?: string,
	prUrl?: string,
): GitCodeRepository {
	const relatedRepositoryFullName = targetRepositoryFullName?.trim()
		|| repositoryFullNameFromUrl(prUrl, currentRepository);
	return relatedRepositoryFullName
		? repositoryFromFullName(relatedRepositoryFullName, currentRepository) ?? currentRepository
		: currentRepository;
}

export class IssueOverviewPanel implements vscode.Disposable {
	private static readonly panels = new Map<string, IssueOverviewPanel>();
	private static activePanel: IssueOverviewPanel | undefined;

	static async createOrShow(
		context: IssueOverviewContext,
		store: IssueOverviewStore,
		commentsStore: IssueCommentsStore,
		relatedPrsStore: IssueRelatedPullRequestsStore,
		prOverviewStore: PullRequestOverviewStore,
		prCommentsStore: PullRequestCommentsStore,
		logger: Logger,
	): Promise<void> {
		const key = keyFor(context.repository, context.issueNumber);
		let panel = this.panels.get(key);

		if (panel) {
			panel.panel.reveal(vscode.ViewColumn.Active, true);
			await panel.show(context);
			return;
		}

		const webviewPanel = vscode.window.createWebviewPanel(
			'gitcode.issueOverview',
			`Issue #${context.issueNumber}`,
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
			},
		);

		panel = new IssueOverviewPanel(webviewPanel, store, commentsStore, relatedPrsStore, prOverviewStore, prCommentsStore, logger, context);
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

	private detail?: IssueDetail;
	private commentsSnapshot?: IssueCommentsSnapshot;
	private commentsError?: Error;
	private relatedPullRequestsSnapshot?: IssueRelatedPullRequestsSnapshot;
	private relatedPullRequestsError?: Error;

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		private readonly store: IssueOverviewStore,
		private readonly commentsStore: IssueCommentsStore,
		private readonly relatedPrsStore: IssueRelatedPullRequestsStore,
		private readonly prOverviewStore: PullRequestOverviewStore,
		private readonly prCommentsStore: PullRequestCommentsStore,
		private readonly logger: Logger,
		private context: IssueOverviewContext,
	) {
		this.panel.onDidDispose(() => {
			IssueOverviewPanel.panels.delete(keyFor(this.context.repository, this.context.issueNumber));
			if (IssueOverviewPanel.activePanel === this) {
				IssueOverviewPanel.activePanel = undefined;
			}
		});

		this.panel.onDidChangeViewState((event) => {
			if (event.webviewPanel.active) {
				IssueOverviewPanel.activePanel = this;
			}
		});

		this.panel.webview.onDidReceiveMessage(async (message: {
			command?: string;
			url?: string;
			prNumber?: number;
			prUrl?: string;
			prTargetRepository?: string;
		}) => {
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
			}

			if (message.command === 'openRelatedPullRequest' && message.prNumber !== undefined) {
				await this.openRelatedPullRequest(message.prNumber, message.prUrl, message.prTargetRepository);
			}
		});
	}

	dispose(): void {
		this.panel.dispose();
	}

	private async show(context: IssueOverviewContext): Promise<void> {
		this.context = context;
		this.panel.title = `Issue #${context.issueNumber}`;
		IssueOverviewPanel.activePanel = this;
		await this.load(false);
	}

	private async refresh(): Promise<void> {
		await this.store.refresh(this.context.repository, this.context.issueNumber);
		await this.commentsStore.refresh(this.context.repository, this.context.issueNumber);
		await this.relatedPrsStore.refresh(this.context.repository, this.context.issueNumber);
		await this.load(true);
	}

	private async load(forceRefresh: boolean): Promise<void> {
		if (forceRefresh) {
			this.detail = undefined;
			this.commentsSnapshot = undefined;
			this.commentsError = undefined;
			this.relatedPullRequestsSnapshot = undefined;
			this.relatedPullRequestsError = undefined;
		}

		this.panel.webview.html = getIssueLoadingHtml(
			'Loading issue',
			'Fetching issue details from GitCode.',
			createNonce(),
		);

		try {
			this.detail = await this.store.getDetail(this.context.repository, this.context.issueNumber);
		} catch (error) {
			this.logger.error(
				`Failed to load issue #${this.context.issueNumber}: ${error instanceof Error ? error.message : String(error)}`,
			);
			this.panel.webview.html = this.renderError(error);
			return;
		}

		// Update panel title with the issue title
		const truncatedTitle =
			this.detail.title.length > 40
				? this.detail.title.substring(0, 40) + '...'
				: this.detail.title;
		this.panel.title = `#${this.detail.number} ${truncatedTitle}`;

		this.panel.webview.html = getIssueOverviewHtml({
			detail: this.detail,
			comments: this.commentsSnapshot,
			commentsError: this.commentsError,
			relatedPullRequests: this.relatedPullRequestsSnapshot,
			relatedPullRequestsError: this.relatedPullRequestsError,
			nonce: createNonce(),
		});

		// Load comments and related pull requests independently so issue details
		// remain visible if either request is slow or fails.
		try {
			this.commentsSnapshot = await this.commentsStore.getComments(
				this.context.repository,
				this.context.issueNumber,
			);
			this.commentsError = undefined;
		} catch (error) {
			this.logger.error(
				`Failed to load comments for issue #${this.context.issueNumber}: ${error instanceof Error ? error.message : String(error)}`,
			);
			this.commentsError = error instanceof Error ? error : new Error(String(error));
			this.commentsSnapshot = undefined;
		}

		// Load related pull requests independently
		try {
			this.relatedPullRequestsSnapshot = await this.relatedPrsStore.getPullRequests(
				this.context.repository,
				this.context.issueNumber,
			);
			this.relatedPullRequestsError = undefined;
		} catch (error) {
			this.logger.error(
				`Failed to load related pull requests for issue #${this.context.issueNumber}: ${error instanceof Error ? error.message : String(error)}`,
			);
			this.relatedPullRequestsError = error instanceof Error ? error : new Error(String(error));
			this.relatedPullRequestsSnapshot = undefined;
		}

		this.panel.webview.html = getIssueOverviewHtml({
			detail: this.detail,
			comments: this.commentsSnapshot,
			commentsError: this.commentsError,
			relatedPullRequests: this.relatedPullRequestsSnapshot,
			relatedPullRequestsError: this.relatedPullRequestsError,
			nonce: createNonce(),
		});
	}

	private async openRelatedPullRequest(prNumber: number, prUrl?: string, targetRepositoryFullName?: string): Promise<void> {
		try {
			const repository = resolveRelatedPullRequestRepository(
				this.context.repository,
				targetRepositoryFullName,
				prUrl,
			);
			await PullRequestOverviewPanel.createOrShow(
				{
					repository,
					pullRequestNumber: prNumber,
					url: prUrl,
				},
				this.prOverviewStore,
				this.prCommentsStore,
				this.logger,
			);
		} catch (error) {
			this.logger.error(
				`Failed to open related PR #${prNumber}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private async openOnWeb(): Promise<void> {
		const url = this.detail?.url ?? this.context.url;
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
			return getIssueErrorHtml(
				'Sign in to GitCode',
				'Authenticate first, then retry loading this issue.',
				createNonce(),
			);
		}

		if (error instanceof ApiRequestError) {
			const description =
				error.statusCode === 401 || error.statusCode === 403
					? 'Your GitCode session is not authorized to read this issue.'
					: `GitCode returned HTTP ${error.statusCode}.`;
			return getIssueErrorHtml('Unable to load issue', description, createNonce());
		}

		if (error instanceof Error) {
			return getIssueErrorHtml('Unable to load issue', error.message, createNonce());
		}

		return getIssueErrorHtml('Unable to load issue', 'An unknown error occurred.', createNonce());
	}
}
