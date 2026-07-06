import * as vscode from 'vscode';
import { getApiRequestErrorMessage } from '../../common/errors';
import { CreateIssueInput, CreateIssuePermissions, GitCodeRepository } from '../../common/models';
import { Logger } from '../../common/logger';
import { IssueService } from '../../gitcode/services/issueService';
import { RawContentService } from '../../gitcode/services/rawContentService';
import { RepositoryService } from '../../gitcode/services/repositoryService';
import { checkPermission } from '../permissions/permissionChecks';
import { createIssueDeniedMessage, updateIssueDeniedMessage } from '../permissions/permissionMessages';
import { PermissionStore } from '../state/permissionStore';
import { CreateIssueDataModel } from './createIssueDataModel';
import { getCreateIssueHtml } from './createIssueHtml';
import { CreateIssueTemplateService } from './createIssueTemplateService';

type CreateIssueMessage =
	| { command: 'ready' }
	| { command: 'cancel' }
	| { command: 'submit'; input: CreateIssueInput };

export interface CreateIssuePanelCallbacks {
	onCreateSuccess(repository: GitCodeRepository, issueNumber?: number, url?: string): void;
}

interface CreateIssuePanelDependencies {
	repositoryService: RepositoryService;
	rawContentService: RawContentService;
	issueService: IssueService;
	permissionStore: PermissionStore;
	logger: Logger;
	callbacks: CreateIssuePanelCallbacks;
}

export class CreateIssuePanel implements vscode.Disposable {
	private static currentPanel: CreateIssuePanel | undefined;

	static async createOrShow(repository: GitCodeRepository, dependencies: CreateIssuePanelDependencies): Promise<void> {
		const existing = this.currentPanel;
		if (existing) {
			existing.panel.reveal(vscode.ViewColumn.Active, true);
			await existing.initialize(repository);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'gitcode.createIssue',
			'Create Issue',
			vscode.ViewColumn.Active,
			{ enableScripts: true },
		);

		this.currentPanel = new CreateIssuePanel(panel, dependencies);
		await this.currentPanel.initialize(repository);
	}

	private dataModel: CreateIssueDataModel;
	private defaultsLoaded = false;
	private pendingRepository?: GitCodeRepository;
	private permissions: CreateIssuePermissions = {
		canCreateIssue: false,
		canEditIssue: false,
	};
	private webviewReady = false;

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		private readonly dependencies: CreateIssuePanelDependencies,
	) {
		this.dataModel = new CreateIssueDataModel(
			dependencies.repositoryService,
			dependencies.issueService,
			new CreateIssueTemplateService(dependencies.rawContentService, dependencies.logger),
			dependencies.logger,
		);

		this.panel.webview.html = getCreateIssueHtml();
		this.panel.onDidDispose(() => {
			if (CreateIssuePanel.currentPanel === this) {
				CreateIssuePanel.currentPanel = undefined;
			}
		});

		this.panel.webview.onDidReceiveMessage(async (message: CreateIssueMessage) => {
			switch (message.command) {
				case 'ready':
					this.webviewReady = true;
					if (this.defaultsLoaded && this.dataModel.getDefaults()) {
						this.postMessage({
							command: 'initialize',
							defaults: this.dataModel.getDefaults(),
							permissions: this.permissions,
						});
						break;
					}

					if (this.pendingRepository) {
						const repository = this.pendingRepository;
						await this.load(repository);
					}
					break;
				case 'cancel':
					this.dispose();
					break;
				case 'submit':
					await this.handleSubmit(message.input);
					break;
			}
		});
	}

	dispose(): void {
		this.panel.dispose();
	}

	private async initialize(repository: GitCodeRepository): Promise<void> {
		this.pendingRepository = repository;
		await this.load(repository);
	}

	private async load(repository: GitCodeRepository): Promise<void> {
		this.panel.title = `Create Issue (${repository.fullName})`;
		if (this.webviewReady) {
			this.postMessage({ command: 'loading' });
		}

		try {
			const [defaults, permissions] = await Promise.all([
				this.dataModel.initialize(repository),
				this.buildPermissions(repository),
			]);
			this.defaultsLoaded = true;
			this.pendingRepository = undefined;
			this.permissions = permissions;
			if (this.webviewReady) {
				this.postMessage({ command: 'initialize', defaults, permissions });
			}
		} catch (error) {
			this.dependencies.logger.error(`Create issue initialization failed for ${repository.fullName}: ${getApiRequestErrorMessage(error)}`);
			if (this.webviewReady) {
				this.postMessage({
					command: 'error',
					message: getApiRequestErrorMessage(error) || 'Failed to initialize the create issue form.',
				});
			}
		}
	}

	private async handleSubmit(input: CreateIssueInput): Promise<void> {
		const repository = this.dataModel.currentRepository;
		if (!repository) {
			this.postMessage({ command: 'error', message: 'No repository selected.' });
			return;
		}

		const canCreateIssue = await checkPermission(this.dependencies.permissionStore, repository, {
			scope: 'issue',
			action: 'create',
			message: createIssueDeniedMessage,
		});
		if (!canCreateIssue) {
			this.postMessage({ command: 'error', message: createIssueDeniedMessage(repository) });
			vscode.window.showWarningMessage(createIssueDeniedMessage(repository));
			return;
		}

		const canEditIssue = await checkPermission(this.dependencies.permissionStore, repository, {
			scope: 'issue',
			action: 'update',
			message: updateIssueDeniedMessage,
		});

		this.permissions = {
			canCreateIssue,
			canEditIssue,
		};
		this.postMessage({ command: 'permissions', permissions: this.permissions });

		const sanitizedInput = this.sanitizeInput(input, canEditIssue);
		const errors = this.dataModel.validate(sanitizedInput);
		if (errors.length > 0) {
			this.postMessage({ command: 'validationError', message: errors.join('\n') });
			return;
		}

		try {
			const result = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Creating issue...',
					cancellable: false,
				},
				() => this.dataModel.createIssue(sanitizedInput),
			);

			vscode.window.showInformationMessage(`GitCode issue #${result.number} created.`);
			this.dependencies.callbacks.onCreateSuccess(this.dataModel.currentRepository!, result.number, result.htmlUrl ?? result.url);
			this.postMessage({ command: 'submitDone' });
			this.dispose();
		} catch (error) {
			const message = getApiRequestErrorMessage(error) || 'Failed to create issue.';
			this.dependencies.logger.error(`Create issue submit failed: ${message}`);
			this.postMessage({ command: 'error', message });
			vscode.window.showErrorMessage(`Failed to create issue: ${message}`);
		}
	}

	private postMessage(message: unknown): void {
		void this.panel.webview.postMessage(message);
	}

	private async buildPermissions(repository: GitCodeRepository): Promise<CreateIssuePermissions> {
		const [canCreateIssue, canEditIssue] = await Promise.all([
			checkPermission(this.dependencies.permissionStore, repository, {
				scope: 'issue',
				action: 'create',
				message: createIssueDeniedMessage,
			}),
			checkPermission(this.dependencies.permissionStore, repository, {
				scope: 'issue',
				action: 'update',
				message: updateIssueDeniedMessage,
			}),
		]);

		return {
			canCreateIssue,
			canEditIssue,
		};
	}

	private sanitizeInput(input: CreateIssueInput, canEditIssue: boolean): CreateIssueInput {
		if (canEditIssue) {
			return input;
		}

		return {
			...input,
			assignees: [],
			labels: [],
			milestoneNumber: undefined,
		};
	}
}
