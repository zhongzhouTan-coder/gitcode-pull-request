import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { COMMAND_ID } from '../../common/constants';
import { ApiRequestError, NotSignedInError } from '../../common/errors';
import { Logger } from '../../common/logger';
import { EditIssueInput, EditIssueOptions, EditIssueSection, GitCodeRepository, IssueCommentsSnapshot, IssueDetail, IssueRelatedPullRequestsSnapshot } from '../../common/models';
import { getIssueErrorHtml, getIssueLoadingHtml, getIssueOverviewHtml } from './issueOverviewHtml';
import { IssueOverviewStore } from './issueOverviewStore';
import { IssueCommentsStore } from './issueCommentsStore';
import { IssueRelatedPullRequestsStore } from './issueRelatedPullRequestsStore';
import { PullRequestOverviewPanel } from '../overview/pullRequestOverviewPanel';
import { PullRequestOverviewStore } from '../overview/pullRequestOverviewStore';
import { PullRequestCommentsStore } from '../state/pullRequestCommentsStore';
import { IssueTreeStore } from '../state/issueTreeStore';

interface IssueOverviewContext {
	repository: GitCodeRepository;
	issueNumber: number;
	url?: string;
}

function createNonce(): string {
	return crypto.randomBytes(16).toString('base64');
}

function parseCsvValues(value: string | undefined): string[] {
	if (value === undefined) {
		return [];
	}

	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of value.split(',')) {
		const normalized = raw.trim();
		if (!normalized || seen.has(normalized)) {
			continue;
		}

		seen.add(normalized);
		result.push(normalized);
	}

	return result;
}

export function validateIssueSectionInput(
	section: EditIssueSection,
	input: EditIssueInput,
	detail: IssueDetail,
	editOptions?: EditIssueOptions,
): string[] {
	const errors: string[] = [];
	if (!input.title.trim()) {
		errors.push('Title is required.');
	}

	if (section === 'assignees') {
		if (!editOptions) {
			errors.push('Assignee options are unavailable.');
			return errors;
		}

		const allowed = new Set(editOptions.assignees.map((user) => user.login));
		const invalid = parseCsvValues(input.assignees).filter((login) => !allowed.has(login));
		if (invalid.length > 0) {
			errors.push('Selected assignees must come from the repository member list.');
		}
	}

	if (section === 'labels') {
		if (!editOptions) {
			errors.push('Label options are unavailable.');
			return errors;
		}

		const allowed = new Set(editOptions.labels.map((label) => label.name));
		const invalid = parseCsvValues(input.labels).filter((name) => !allowed.has(name));
		if (invalid.length > 0) {
			errors.push('Selected labels must come from the repository label list.');
		}
	}

	if (section === 'milestone') {
		if (!editOptions) {
			errors.push('Milestone options are unavailable.');
			return errors;
		}

		if (input.milestoneNumber !== undefined && input.milestoneNumber !== null) {
			const allowed = new Set(editOptions.milestones.map((milestone) => milestone.number));
			if (!allowed.has(input.milestoneNumber)) {
				errors.push('Selected milestone must come from the repository milestone list.');
			}
		}
	}

	if (section === 'securityHole' && detail.securityHole === undefined) {
		errors.push('Security issue state is unavailable for this issue.');
	}

	return errors;
}

export function validateIssueStateChange(requestedState: string, detail: IssueDetail): string[] {
	if (requestedState !== 'close' && requestedState !== 'reopen') {
		return ['Issue state action must be close or reopen.'];
	}

	if (requestedState === 'close' && detail.state !== 'open') {
		return ['Only open issues can be closed.'];
	}

	if (requestedState === 'reopen' && detail.state !== 'closed') {
		return ['Only closed issues can be reopened.'];
	}

	return [];
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
	private static treeStore: IssueTreeStore | undefined;

	static setEditDependencies(treeStore: IssueTreeStore): void {
		this.treeStore = treeStore;
	}

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
	private editOptions?: EditIssueOptions;

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
			section?: EditIssueSection;
			input?: EditIssueInput;
			state?: string;
			body?: string;
		}) => {
			if (message.command === 'refresh') {
				await this.refresh();
				return;
			}

			if (message.command === 'openOnWeb') {
				await this.openOnWeb();
				return;
			}

			if (message.command === 'createBranch') {
				await vscode.commands.executeCommand(COMMAND_ID.createBranchForIssue, {
					repository: this.context.repository,
					issueNumber: this.detail?.number ?? this.context.issueNumber,
					title: this.detail?.title ?? `Issue ${this.context.issueNumber}`,
					url: this.detail?.url ?? this.context.url,
				});
				return;
			}

			if (message.command === 'saveIssueSection' && message.section && message.input) {
				await this.handleSaveSection(message.section, message.input);
				return;
			}

			if (message.command === 'changeIssueState' && message.state) {
				await this.handleChangeIssueState(message.state);
				return;
			}

			if (message.command === 'openUrl' && message.url) {
				await this.openTrustedUrl(message.url);
			}

			if (message.command === 'openRelatedPullRequest' && message.prNumber !== undefined) {
				await this.openRelatedPullRequest(message.prNumber, message.prUrl, message.prTargetRepository);
			}

			if (message.command === 'submitIssueComment') {
				await this.handleSubmitIssueComment(message.body);
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
			this.editOptions = undefined;
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
			editOptions: this.editOptions,
			nonce: createNonce(),
		});

		const [commentsResult, relatedPullRequestsResult, editOptionsResult] = await Promise.allSettled([
			this.commentsStore.getComments(this.context.repository, this.context.issueNumber),
			this.relatedPrsStore.getPullRequests(this.context.repository, this.context.issueNumber),
			this.store.getEditOptions(this.context.repository),
		]);

		if (commentsResult.status === 'fulfilled') {
			this.commentsSnapshot = commentsResult.value;
			this.commentsError = undefined;
		} else {
			this.logger.error(
				`Failed to load comments for issue #${this.context.issueNumber}: ${commentsResult.reason instanceof Error ? commentsResult.reason.message : String(commentsResult.reason)}`,
			);
			this.commentsError = commentsResult.reason instanceof Error ? commentsResult.reason : new Error(String(commentsResult.reason));
			this.commentsSnapshot = undefined;
		}

		if (relatedPullRequestsResult.status === 'fulfilled') {
			this.relatedPullRequestsSnapshot = relatedPullRequestsResult.value;
			this.relatedPullRequestsError = undefined;
		} else {
			this.logger.error(
				`Failed to load related pull requests for issue #${this.context.issueNumber}: ${relatedPullRequestsResult.reason instanceof Error ? relatedPullRequestsResult.reason.message : String(relatedPullRequestsResult.reason)}`,
			);
			this.relatedPullRequestsError = relatedPullRequestsResult.reason instanceof Error ? relatedPullRequestsResult.reason : new Error(String(relatedPullRequestsResult.reason));
			this.relatedPullRequestsSnapshot = undefined;
		}

		if (editOptionsResult.status === 'fulfilled') {
			this.editOptions = editOptionsResult.value;
		} else {
			this.logger.debug(
				`Failed to load edit options for issue #${this.context.issueNumber}: ${editOptionsResult.reason instanceof Error ? editOptionsResult.reason.message : String(editOptionsResult.reason)}`,
			);
			this.editOptions = undefined;
		}

		this.panel.webview.html = getIssueOverviewHtml({
			detail: this.detail,
			comments: this.commentsSnapshot,
			commentsError: this.commentsError,
			relatedPullRequests: this.relatedPullRequestsSnapshot,
			relatedPullRequestsError: this.relatedPullRequestsError,
			editOptions: this.editOptions,
			nonce: createNonce(),
		});
	}

	private async handleSaveSection(section: EditIssueSection, input: EditIssueInput): Promise<void> {
		if (!this.detail) {
			return;
		}

		const errors = validateIssueSectionInput(section, input, this.detail, this.editOptions);
		if (errors.length > 0) {
			this.panel.webview.postMessage({
				command: 'sectionSaveError',
				section,
				message: errors.join(' '),
			});
			return;
		}

		try {
			await this.store.editIssue(this.context.repository, this.context.issueNumber, {
				...input,
				title: input.title.trim(),
			});

			vscode.window.showInformationMessage(`GitCode issue #${this.context.issueNumber} updated`);

			await this.commentsStore.refresh(this.context.repository, this.context.issueNumber);
			await this.relatedPrsStore.refresh(this.context.repository, this.context.issueNumber);
			const treeStore = IssueOverviewPanel.treeStore;
			if (treeStore) {
				treeStore.refreshRepository(this.context.repository.fullName).catch(() => {
					void treeStore.refreshAll();
				});
			}

			this.commentsSnapshot = undefined;
			this.commentsError = undefined;
			this.relatedPullRequestsSnapshot = undefined;
			this.relatedPullRequestsError = undefined;
			this.editOptions = undefined;
			await this.load(true);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to update issue.';
			this.logger.error(`Failed to save section "${section}" for issue #${this.context.issueNumber}: ${errorMessage}`);
			this.panel.webview.postMessage({
				command: 'sectionSaveError',
				section,
				message: errorMessage,
			});
		}
	}

	private async handleSubmitIssueComment(body: string | undefined): Promise<void> {
		if (!body || !body.trim()) {
			this.panel.webview.postMessage({
				command: 'issueCommentSubmitError',
				message: 'Comment body is required.',
			});
			return;
		}

		this.panel.webview.postMessage({
			command: 'issueCommentSubmitting',
		});

		try {
			const result = await this.commentsStore.submitComment(
				this.context.repository,
				this.context.issueNumber,
				{ body },
			);

			this.commentsSnapshot = undefined;
			this.commentsError = undefined;

			// Reload the panel to show the new comment
			await this.load(true);

			if (!this.panel.webview.options) {
				// Panel disposed during reload
				return;
			}

			this.panel.webview.postMessage({
				command: 'issueCommentSubmitted',
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to create comment.';
			this.logger.error(
				`Failed to submit comment on issue #${this.context.issueNumber}: ${errorMessage}`,
			);
			this.panel.webview.postMessage({
				command: 'issueCommentSubmitError',
				message: errorMessage,
			});
		}
	}

	private async handleChangeIssueState(state: string): Promise<void> {
		if (!this.detail) {
			return;
		}

		const errors = validateIssueStateChange(state, this.detail);
		if (errors.length > 0) {
			this.panel.webview.postMessage({
				command: 'issueStateChangeError',
				message: errors.join(' '),
			});
			return;
		}

		try {
			if (state !== 'close' && state !== 'reopen') {
				return;
			}

			await this.store.editIssue(this.context.repository, this.context.issueNumber, {
				title: this.detail.title,
				state,
			});

			vscode.window.showInformationMessage(
				`GitCode issue #${this.context.issueNumber} ${state === 'close' ? 'closed' : 'reopened'}`,
			);

			await this.commentsStore.refresh(this.context.repository, this.context.issueNumber);
			await this.relatedPrsStore.refresh(this.context.repository, this.context.issueNumber);
			const treeStore = IssueOverviewPanel.treeStore;
			if (treeStore) {
				treeStore.refreshRepository(this.context.repository.fullName).catch(() => {
					void treeStore.refreshAll();
				});
			}

			this.commentsSnapshot = undefined;
			this.commentsError = undefined;
			this.relatedPullRequestsSnapshot = undefined;
			this.relatedPullRequestsError = undefined;
			this.editOptions = undefined;
			await this.load(true);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to update issue state.';
			this.logger.error(`Failed to change state for issue #${this.context.issueNumber}: ${errorMessage}`);
			this.panel.webview.postMessage({
				command: 'issueStateChangeError',
				message: errorMessage,
			});
		}
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
