import * as vscode from 'vscode';
import { AuthService } from '../../authentication/authService';
import { CreatePullRequestInput, CreatePullRequestInitialIssueContext, CreatePullRequestPermissions, GitCodeRepository } from '../../common/models';
import { Logger } from '../../common/logger';
import { GitRepository } from '../../common/git/gitTypes';
import { VIEW_ID_CREATE_PULL_REQUEST } from '../../common/constants';
import { PullRequestService } from '../../gitcode/services/pullRequestService';
import { RepositoryService } from '../../gitcode/services/repositoryService';
import { checkPermission } from '../permissions/permissionChecks';
import { createBranchDeniedMessage, createPullRequestDeniedMessage, updatePullRequestDeniedMessage } from '../permissions/permissionMessages';
import { PermissionStore } from '../state/permissionStore';
import { CreatePullRequestDataModel, CreatePullRequestDefaults } from './createPullRequestDataModel';
import { getCreatePullRequestHtml } from './createPullRequestHtml';

type CreatePullRequestMessage =
	| { command: 'ready' }
	| { command: 'changeSourceRepository'; repositoryFullName: string }
	| { command: 'changeTargetRepository'; repositoryFullName: string }
	| { command: 'changeSourceBranch'; branch: string }
	| { command: 'changeTargetBranch'; branch: string }
	| { command: 'cancel' }
	| { command: 'submit'; input: CreatePullRequestInput };

export interface CreatePullRequestViewCallbacks {
	onCreateSuccess(repository: GitCodeRepository, prNumber: number): void;
}

export class CreatePullRequestViewProvider implements vscode.WebviewViewProvider {
	private view?: vscode.WebviewView;
	private dataModel?: CreatePullRequestDataModel;
	private readonly disposables: vscode.Disposable[] = [];
	private localGitRepository?: GitRepository;
	private publishRemoteName?: string;
	private activeLocalBranch?: string;
	private permissions: CreatePullRequestPermissions = {
		canCreatePullRequest: false,
		canEditPullRequest: false,
		canCreateBranch: false,
	};
	private pendingInitialize?: {
		repositories: GitCodeRepository[];
		repository: GitCodeRepository;
		sourceBranch: string;
		localGitRepository?: GitRepository;
		issueContext?: CreatePullRequestInitialIssueContext;
		permissions?: CreatePullRequestPermissions;
	};

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly repositoryService: RepositoryService,
		private readonly pullRequestService: PullRequestService,
		private readonly authService: AuthService,
		private readonly callbacks: CreatePullRequestViewCallbacks,
		private readonly permissionStore: PermissionStore,
		private readonly logger: Logger,
	) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		const isNewView = this.view !== webviewView;
		this.view = webviewView;

		if (isNewView) {
			webviewView.webview.options = { enableScripts: true };
			webviewView.webview.html = getCreatePullRequestHtml();
		}

		webviewView.webview.onDidReceiveMessage(
			(msg: CreatePullRequestMessage) => this.handleMessage(msg),
			undefined,
			this.disposables,
		);

		webviewView.onDidDispose(() => {
			this.view = undefined;
		});
	}

	async initialize(
		repositories: GitCodeRepository[],
		repository: GitCodeRepository,
		sourceBranch: string,
		localGitRepository?: GitRepository,
		issueContext?: CreatePullRequestInitialIssueContext,
		permissions?: CreatePullRequestPermissions,
	): Promise<void> {
		// If the view isn't ready yet, store the request
		if (!this.view) {
			this.pendingInitialize = { repositories, repository, sourceBranch, localGitRepository, issueContext, permissions };
			await this.revealView();
			return;
		}

		this.localGitRepository = localGitRepository;
		this.publishRemoteName = repository.remoteName;
		this.activeLocalBranch = sourceBranch;
		this.permissions = permissions ?? {
			canCreatePullRequest: false,
			canEditPullRequest: false,
			canCreateBranch: false,
		};

		// Reveal the contributed view before posting loading so collapsed views display it.
		await this.revealView();

		this.postMessage({ command: 'loading' });

		// Create a fresh data model for this session
		const currentUserLogin = (await this.authService.getSession())?.accountName;
		this.dataModel = new CreatePullRequestDataModel(
			this.repositoryService,
			this.pullRequestService,
			currentUserLogin,
		);

		const defaults = await this.dataModel.initialize(repositories, repository, sourceBranch, issueContext);
		this.permissions = await this.buildPermissions(defaults.sourceRepository, defaults.targetRepository);
		this.postMessage({ command: 'initialize', defaults, permissions: this.permissions });
	}

	private async handleMessage(msg: CreatePullRequestMessage): Promise<void> {
		try {
			switch (msg.command) {
				case 'ready':
				// Webview JS is loaded — process any pending initialize
				if (this.pendingInitialize) {
					const pending = this.pendingInitialize;
					this.pendingInitialize = undefined;
					this.initialize(pending.repositories, pending.repository, pending.sourceBranch, pending.localGitRepository, pending.issueContext, pending.permissions);
				} else {
					const defaults = this.getCurrentDefaults();
					if (defaults) {
						this.postMessage({ command: 'initialize', defaults, permissions: this.permissions });
					}
				}
				break;

				case 'changeSourceRepository':
					await this.handleSourceRepositoryChange(msg.repositoryFullName);
					break;

				case 'changeTargetRepository':
					await this.handleTargetRepositoryChange(msg.repositoryFullName);
					break;

				case 'changeSourceBranch':
					await this.handleSourceBranchChange(msg.branch);
					break;

				case 'changeTargetBranch':
					await this.handleTargetBranchChange(msg.branch);
					break;

				case 'cancel':
					this.cancel();
					break;

				case 'submit':
					await this.handleSubmit(msg.input);
					break;
			}
		} catch (error) {
			this.logger.error(
				`Create PR provider error: ${error instanceof Error ? error.message : String(error)}`,
			);
			this.postMessage({
				command: 'submitDone',
			});
			vscode.window.showErrorMessage(
				`Failed to create pull request: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private async handleSourceRepositoryChange(repositoryFullName: string): Promise<void> {
		if (!repositoryFullName || !this.dataModel) {
			return;
		}

		const repository = this.findRepository(repositoryFullName);
		if (!repository) {
			return;
		}

		this.publishRemoteName = repository.remoteName;
		await this.dataModel.setSourceRepository(repository);
		this.permissions = await this.buildPermissions(repository, this.dataModel.targetRepository);

		this.postMessage({
			command: 'updateRepositoryFields',
			sourceRepository: this.dataModel.sourceRepository,
			targetRepository: this.dataModel.targetRepository,
			sourceBranches: this.dataModel.sourceBranches,
			targetBranches: this.dataModel.targetBranches,
			labels: this.dataModel.labels,
			milestones: this.dataModel.milestones,
			members: this.dataModel.members,
			sourceBranch: this.dataModel.sourceBranch,
			targetBranch: this.dataModel.targetBranch,
			title: this.dataModel.title,
			body: this.dataModel.body,
			warning: this.dataModel.duplicateWarning,
			permissions: this.permissions,
		});
	}

	private async handleTargetRepositoryChange(repositoryFullName: string): Promise<void> {
		if (!repositoryFullName || !this.dataModel) {
			return;
		}

		const repository = this.findRepository(repositoryFullName);
		if (!repository) {
			return;
		}

		await this.dataModel.setTargetRepository(repository);
		this.permissions = await this.buildPermissions(this.dataModel.sourceRepository, repository);

		this.postMessage({
			command: 'updateRepositoryFields',
			sourceRepository: this.dataModel.sourceRepository,
			targetRepository: this.dataModel.targetRepository,
			sourceBranches: this.dataModel.sourceBranches,
			targetBranches: this.dataModel.targetBranches,
			labels: this.dataModel.labels,
			milestones: this.dataModel.milestones,
			members: this.dataModel.members,
			sourceBranch: this.dataModel.sourceBranch,
			targetBranch: this.dataModel.targetBranch,
			title: this.dataModel.title,
			body: this.dataModel.body,
			warning: this.dataModel.duplicateWarning,
			permissions: this.permissions,
		});
	}

	private async buildPermissions(
		sourceRepository: GitCodeRepository | undefined,
		targetRepository: GitCodeRepository | undefined,
	): Promise<CreatePullRequestPermissions> {
		if (!sourceRepository || !targetRepository) {
			return {
				canCreatePullRequest: false,
				canEditPullRequest: false,
				canCreateBranch: false,
			};
		}

		const [canCreatePullRequest, canEditPullRequest, canCreateBranch] = await Promise.all([
			checkPermission(this.permissionStore, sourceRepository, {
				scope: 'pr',
				action: 'create',
				message: createPullRequestDeniedMessage,
			}),
			checkPermission(this.permissionStore, targetRepository, {
				scope: 'pr',
				action: 'update',
				message: updatePullRequestDeniedMessage,
			}),
			checkPermission(this.permissionStore, sourceRepository, {
				scope: 'branch',
				action: 'create',
				message: createBranchDeniedMessage,
			}),
		]);

		return { canCreatePullRequest, canEditPullRequest, canCreateBranch };
	}

	private async handleSourceBranchChange(branch: string): Promise<void> {
		if (!branch || !this.dataModel) {
			return;
		}

		await this.dataModel.setSourceBranch(branch);

		this.postMessage({
			command: 'updateFields',
			title: this.dataModel.title,
			body: this.dataModel.body,
			warning: this.dataModel.duplicateWarning,
		});
	}

	private async handleTargetBranchChange(branch: string): Promise<void> {
		if (!branch || !this.dataModel) {
			return;
		}

		await this.dataModel.setTargetBranch(branch);

		this.postMessage({
			command: 'updateFields',
			title: this.dataModel.title,
			body: this.dataModel.body,
			warning: this.dataModel.duplicateWarning,
		});
	}

	private async handleSubmit(input: CreatePullRequestInput): Promise<void> {
		const repo = this.dataModel?.repository;
		const sourceRepository = this.dataModel?.sourceRepository;
		if (!repo || !this.dataModel || !sourceRepository) {
			vscode.window.showErrorMessage('No repository selected.');
			this.postMessage({ command: 'submitDone' });
			return;
		}

		const canCreatePullRequest = await checkPermission(this.permissionStore, sourceRepository, {
			scope: 'pr',
			action: 'create',
			message: createPullRequestDeniedMessage,
		});
		if (!canCreatePullRequest) {
			vscode.window.showWarningMessage(createPullRequestDeniedMessage(sourceRepository));
			this.postMessage({ command: 'submitDone' });
			return;
		}

		const canEditPullRequest = await checkPermission(this.permissionStore, repo, {
			scope: 'pr',
			action: 'update',
			message: updatePullRequestDeniedMessage,
		});
		this.permissions = {
			canCreatePullRequest,
			canEditPullRequest,
			canCreateBranch: this.permissions.canCreateBranch,
		};
		this.postMessage({ command: 'permissions', permissions: this.permissions });

		const sanitizedInput = this.sanitizeInput(input, canEditPullRequest);

		// Validate
		const errors = this.dataModel.validate(sanitizedInput);
		if (errors.length > 0) {
			this.postMessage({ command: 'validationErrors', errors });
			return;
		}

		// Check if source branch exists remotely, or ask about publishing
		const branchPublished = await this.dataModel.ensureSourceBranchPublished(sanitizedInput);
		if (!branchPublished) {
			const canPublishLocalBranch = sanitizedInput.head === this.activeLocalBranch;
			const branchReady = canPublishLocalBranch
				? await this.promptAndPublishLocalBranch(sanitizedInput.head)
				: await this.promptAndCreateRemoteBranch(sanitizedInput.base, sanitizedInput.head);

			if (!branchReady) {
				this.postMessage({ command: 'submitDone' });
				return;
			}
		}

		const createInput = this.createApiInput(sanitizedInput);

		// Create the pull request
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Creating pull request...',
				cancellable: false,
			},
			async () => {
				const result = await this.pullRequestService.createPullRequest(repo, createInput);

				vscode.window.showInformationMessage(
					`GitCode pull request #${result.number} created.`,
				);

				this.callbacks.onCreateSuccess(repo, result.number);
			},
		);

		this.postMessage({ command: 'submitDone' });
	}

	private createApiInput(input: CreatePullRequestInput): CreatePullRequestInput {
		const sourceRepository = this.dataModel?.sourceRepository;
		const targetRepository = this.dataModel?.targetRepository;
		if (!sourceRepository || !targetRepository || sourceRepository.fullName === targetRepository.fullName) {
			return input;
		}

		return {
			...input,
			head: `${sourceRepository.owner}:${input.head}`,
			forkPath: sourceRepository.fullName,
		};
	}

	private cancel(): void {
		this.pendingInitialize = undefined;
		this.dataModel = undefined;
		this.localGitRepository = undefined;
		this.publishRemoteName = undefined;
		this.activeLocalBranch = undefined;
		this.permissions = {
			canCreatePullRequest: false,
			canEditPullRequest: false,
			canCreateBranch: false,
		};
		this.postMessage({ command: 'reset' });
	}

	private findRepository(repositoryFullName: string): GitCodeRepository | undefined {
		return this.dataModel?.repositories.find((repository) => repository.fullName === repositoryFullName);
	}

	private async revealView(): Promise<void> {
		await vscode.commands.executeCommand(`${VIEW_ID_CREATE_PULL_REQUEST}.focus`);
		this.view?.show?.(true);
	}

	private getCurrentDefaults(): CreatePullRequestDefaults | undefined {
		const dataModel = this.dataModel;
		const sourceRepository = dataModel?.sourceRepository;
		const targetRepository = dataModel?.targetRepository;
		const targetRepositoryDetail = dataModel?.targetRepositoryDetail;
		if (!dataModel || !sourceRepository || !targetRepository || !targetRepositoryDetail) {
			return undefined;
		}

		return {
			repository: targetRepository,
			repositories: dataModel.repositories,
			sourceRepository,
			targetRepository,
			targetRepositoryDetail,
			sourceBranches: dataModel.sourceBranches,
			targetBranches: dataModel.targetBranches,
			labels: dataModel.labels,
			milestones: dataModel.milestones,
			members: dataModel.members,
			sourceBranch: dataModel.sourceBranch,
			targetBranch: dataModel.targetBranch,
			title: dataModel.title,
			body: dataModel.body,
			duplicateWarning: dataModel.duplicateWarning,
		};
	}

	private async promptAndPublishLocalBranch(branchName: string): Promise<boolean> {
		if (!this.localGitRepository?.push || !this.publishRemoteName) {
			vscode.window.showErrorMessage('Cannot publish the source branch because no matching GitCode push remote was found.');
			return false;
		}

		const action = await vscode.window.showWarningMessage(
			`There is no remote branch for "${branchName}". Publish it before creating the pull request?`,
			{ modal: false },
			'Publish Branch',
			'Cancel',
		);

		if (action !== 'Publish Branch') {
			return false;
		}

		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Publishing ${branchName}...`,
					cancellable: false,
				},
				() => this.localGitRepository!.push!(this.publishRemoteName, branchName, true),
			);
			this.dataModel?.markSourceBranchPublished(branchName);
			return true;
		} catch (error) {
			vscode.window.showErrorMessage(
				`Failed to publish source branch: ${error instanceof Error ? error.message : String(error)}`,
			);
			return false;
		}
	}

	private async promptAndCreateRemoteBranch(baseBranch: string, sourceBranch: string): Promise<boolean> {
		const dataModel = this.dataModel;
		if (!dataModel) {
			return false;
		}

		const sourceRepository = dataModel.sourceRepository;
		if (!sourceRepository) {
			vscode.window.showErrorMessage('No source repository selected.');
			return false;
		}

		const canCreateBranch = await checkPermission(this.permissionStore, sourceRepository, {
			scope: 'branch',
			action: 'create',
			message: createBranchDeniedMessage,
		});
		if (!canCreateBranch) {
			vscode.window.showWarningMessage(createBranchDeniedMessage(sourceRepository));
			return false;
		}

		const action = await vscode.window.showWarningMessage(
			`Source branch "${sourceBranch}" does not exist on GitCode. Create it from "${baseBranch}"?`,
			{ modal: false },
			'Create Branch',
			'Cancel',
		);

		if (action !== 'Create Branch') {
			return false;
		}

		try {
			await dataModel.createSourceBranch(baseBranch, sourceBranch);
			return true;
		} catch (error) {
			vscode.window.showErrorMessage(
				`Failed to create remote branch: ${error instanceof Error ? error.message : String(error)}`,
			);
			return false;
		}
	}

	private postMessage(msg: Record<string, unknown>): void {
		this.view?.webview.postMessage(msg).then(
			undefined,
			() => {
				// Webview may have been disposed
			},
		);
	}

	private sanitizeInput(input: CreatePullRequestInput, canEditPullRequest: boolean): CreatePullRequestInput {
		if (canEditPullRequest) {
			return input;
		}

		return {
			...input,
			milestoneNumber: undefined,
			labels: undefined,
			assignees: undefined,
			testers: undefined,
		};
	}

	dispose(): void {
		this.view = undefined;
		this.dataModel = undefined;
		this.permissions = {
			canCreatePullRequest: false,
			canEditPullRequest: false,
			canCreateBranch: false,
		};
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}
