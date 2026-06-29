import * as vscode from 'vscode';
import {
	CreatePullRequestInitialIssueContext,
	CreatePullRequestInput,
	GitCodeBranch,
	GitCodeLabel,
	GitCodeMilestone,
	GitCodeRepository,
	GitCodeRepositoryDetail,
	GitCodeUser,
} from '../../common/models';
import { PullRequestService } from '../../gitcode/services/pullRequestService';
import { RepositoryService } from '../../gitcode/services/repositoryService';

export interface CreatePullRequestDefaults {
	repository: GitCodeRepository;
	repositories: GitCodeRepository[];
	sourceRepository: GitCodeRepository;
	targetRepository: GitCodeRepository;
	targetRepositoryDetail: GitCodeRepositoryDetail;
	sourceBranches: GitCodeBranch[];
	targetBranches: GitCodeBranch[];
	labels: GitCodeLabel[];
	milestones: GitCodeMilestone[];
	members: GitCodeUser[];
	sourceBranch: string;
	targetBranch: string;
	title: string;
	body: string;
	duplicateWarning?: string;
}

export interface CreatePullRequestStateChange {
	sourceRepository?: GitCodeRepository;
	targetRepository?: GitCodeRepository;
	sourceBranch?: string;
	targetBranch?: string;
	title?: string;
	body?: string;
	warning?: string;
}

export class CreatePullRequestDataModel {
	private readonly _onDidChange = new vscode.EventEmitter<CreatePullRequestStateChange>();
	readonly onDidChange = this._onDidChange.event;

	private _repositories: GitCodeRepository[] = [];
	private _sourceRepository?: GitCodeRepository;
	private _targetRepository?: GitCodeRepository;
	private _targetRepositoryDetail?: GitCodeRepositoryDetail;
	private _sourceBranches: GitCodeBranch[] = [];
	private _targetBranches: GitCodeBranch[] = [];
	private _remoteSourceBranchNames = new Set<string>();
	private _labels: GitCodeLabel[] = [];
	private _milestones: GitCodeMilestone[] = [];
	private _members: GitCodeUser[] = [];
	private _sourceBranch = '';
	private _targetBranch = '';
	private _title = '';
	private _body = '';
	private _duplicateWarning?: string;

	constructor(
		private readonly repositoryService: RepositoryService,
		private readonly pullRequestService: PullRequestService,
	) {}

	get repositories(): GitCodeRepository[] {
		return this._repositories;
	}

	get sourceRepository(): GitCodeRepository | undefined {
		return this._sourceRepository;
	}

	get targetRepository(): GitCodeRepository | undefined {
		return this._targetRepository;
	}

	get repository(): GitCodeRepository | undefined {
		return this._targetRepository;
	}

	get targetRepositoryDetail(): GitCodeRepositoryDetail | undefined {
		return this._targetRepositoryDetail;
	}

	get sourceBranches(): GitCodeBranch[] {
		return this._sourceBranches;
	}

	get targetBranches(): GitCodeBranch[] {
		return this._targetBranches;
	}

	get labels(): GitCodeLabel[] {
		return this._labels;
	}

	get milestones(): GitCodeMilestone[] {
		return this._milestones;
	}

	get members(): GitCodeUser[] {
		return this._members;
	}

	get sourceBranch(): string {
		return this._sourceBranch;
	}

	get targetBranch(): string {
		return this._targetBranch;
	}

	get title(): string {
		return this._title;
	}

	get body(): string {
		return this._body;
	}

	get duplicateWarning(): string | undefined {
		return this._duplicateWarning;
	}

	async initialize(
		repository: GitCodeRepository,
		sourceBranch: string,
		issueContext?: CreatePullRequestInitialIssueContext,
	): Promise<CreatePullRequestDefaults>;
	async initialize(
		repositories: GitCodeRepository[],
		targetRepository: GitCodeRepository,
		sourceBranch: string,
		issueContext?: CreatePullRequestInitialIssueContext,
	): Promise<CreatePullRequestDefaults>;
	async initialize(
		repositoriesOrRepository: GitCodeRepository[] | GitCodeRepository,
		targetRepositoryOrSourceBranch: GitCodeRepository | string,
		sourceBranchOrIssueContext?: string | CreatePullRequestInitialIssueContext,
		issueContextArg?: CreatePullRequestInitialIssueContext,
	): Promise<CreatePullRequestDefaults> {
		const repositories = Array.isArray(repositoriesOrRepository)
			? repositoriesOrRepository
			: [repositoriesOrRepository];
		const targetRepository = Array.isArray(repositoriesOrRepository)
			? targetRepositoryOrSourceBranch as GitCodeRepository
			: repositoriesOrRepository;
		const sourceBranch = Array.isArray(repositoriesOrRepository)
			? (typeof sourceBranchOrIssueContext === 'string' ? sourceBranchOrIssueContext : '')
			: targetRepositoryOrSourceBranch as string;
		const issueContext = Array.isArray(repositoriesOrRepository)
			? issueContextArg
			: (typeof sourceBranchOrIssueContext === 'object' ? sourceBranchOrIssueContext : undefined);
		const sourceRepository = this.defaultSourceRepository(repositories, targetRepository);

		this._repositories = repositories.length ? repositories : [targetRepository];
		this._sourceRepository = sourceRepository;
		this._targetRepository = targetRepository;
		this._sourceBranch = sourceBranch;

		const [targetRepositoryDetail, sourceBranches, targetBranches, labels, milestones, members] = await Promise.all([
			this.repositoryService.getRepository(targetRepository).catch(() => undefined),
			this.repositoryService.listBranches(sourceRepository).catch(() => []),
			this.repositoryService.listBranches(targetRepository).catch(() => []),
			this.repositoryService.listLabels(targetRepository, { perPage: 100 }).catch(() => []),
			this.repositoryService.listMilestones(targetRepository, { state: 'open' }).catch(() => []),
			this.repositoryService.listMembers(targetRepository, { perPage: 100 }).catch(() => []),
		]);

		this._targetRepositoryDetail = targetRepositoryDetail;
		this._remoteSourceBranchNames = new Set(sourceBranches.map((branch) => branch.name));
		this._sourceBranches = this.withLocalSourceBranch(sourceBranches, sourceBranch);
		this._targetBranches = targetBranches;
		this._labels = labels;
		this._milestones = milestones;
		this._members = members;

		const defaultTargetBranch = targetRepositoryDetail?.defaultBranch || 'main';
		this._targetBranch = defaultTargetBranch;

		this._title = this.buildTitle(sourceBranch, issueContext);
		this._body = this.buildBody(issueContext);

		// Check for duplicate PRs
		try {
			await this.checkDuplicateWarning();
		} catch {
			// Non-critical
		}

		return {
			repository: targetRepository,
			repositories: this._repositories,
			sourceRepository,
			targetRepository,
			targetRepositoryDetail: targetRepositoryDetail!,
			sourceBranches: this._sourceBranches,
			targetBranches: this._targetBranches,
			labels,
			milestones,
			members,
			sourceBranch,
			targetBranch: defaultTargetBranch,
			title: this._title,
			body: this._body,
			duplicateWarning: this._duplicateWarning,
		};
	}

	async setSourceRepository(repository: GitCodeRepository): Promise<void> {
		if (this._sourceRepository?.fullName === repository.fullName) {
			return;
		}

		this._sourceRepository = repository;
		const branches = await this.repositoryService.listBranches(repository).catch(() => []);
		this._remoteSourceBranchNames = new Set(branches.map((branch) => branch.name));
		this._sourceBranches = this.withLocalSourceBranch(branches, this._sourceBranch);

		if (!this._sourceBranches.some((branch) => branch.name === this._sourceBranch)) {
			this._sourceBranch = this._sourceBranches[0]?.name ?? '';
		}

		await this.checkDuplicateWarning();

		this._onDidChange.fire({
			sourceRepository: repository,
			sourceBranch: this._sourceBranch,
			title: this._title,
			body: this._body,
			warning: this._duplicateWarning,
		});
	}

	async setTargetRepository(repository: GitCodeRepository): Promise<void> {
		if (this._targetRepository?.fullName === repository.fullName) {
			return;
		}

		this._targetRepository = repository;

		const [repositoryDetail, branches, labels, milestones, members] = await Promise.all([
			this.repositoryService.getRepository(repository).catch(() => undefined),
			this.repositoryService.listBranches(repository).catch(() => []),
			this.repositoryService.listLabels(repository, { perPage: 100 }).catch(() => []),
			this.repositoryService.listMilestones(repository, { state: 'open' }).catch(() => []),
			this.repositoryService.listMembers(repository, { perPage: 100 }).catch(() => []),
		]);

		this._targetRepositoryDetail = repositoryDetail;
		this._targetBranches = branches;
		this._labels = labels;
		this._milestones = milestones;
		this._members = members;

		const newTarget = repositoryDetail?.defaultBranch || 'main';
		this._targetBranch = newTarget;

		await this.checkDuplicateWarning();

		this._onDidChange.fire({
			targetRepository: repository,
			targetBranch: newTarget,
			title: this._title,
			body: this._body,
			warning: this._duplicateWarning,
		});
	}

	async setSourceBranch(branch: string): Promise<void> {
		if (this._sourceBranch === branch) {
			return;
		}

		this._sourceBranch = branch;
		const repo = this._targetRepository;
		if (!repo) {
			this._onDidChange.fire({ sourceBranch: branch });
			return;
		}

		this._title = this.branchTitle(branch);
		this._body = '';

		// Check for duplicates
		await this.checkDuplicateWarning();

		this._onDidChange.fire({
			sourceBranch: branch,
			title: this._title,
			body: this._body,
			warning: this._duplicateWarning,
		});
	}

	async setTargetBranch(branch: string): Promise<void> {
		if (this._targetBranch === branch) {
			return;
		}

		this._targetBranch = branch;

		// When target changes, re-check duplicates
		const repo = this._targetRepository;
		if (repo && this._sourceBranch) {
			await this.checkDuplicateWarning();
		}

		this._onDidChange.fire({
			targetBranch: branch,
			warning: this._duplicateWarning,
		});
	}

	async createSourceBranch(refs: string, branchName: string): Promise<GitCodeBranch[]> {
		const repo = this._sourceRepository;
		if (!repo) {
			throw new Error('No source repository selected.');
		}

		const branches = await this.repositoryService.createBranch(repo, { refs, branchName });

		// Refresh branch list
		this._sourceBranches = await this.repositoryService.listBranches(repo);
		this._remoteSourceBranchNames = new Set(this._sourceBranches.map((branch) => branch.name));
		return branches;
	}

	listMembers(query?: string): GitCodeUser[] {
		const normalizedQuery = query?.trim().toLowerCase();
		if (!normalizedQuery) {
			return this._members;
		}

		return this._members.filter((member) => {
			const login = member.login.toLowerCase();
			const name = member.name?.toLowerCase() ?? '';
			return login.includes(normalizedQuery) || name.includes(normalizedQuery);
		});
	}

	validate(input: CreatePullRequestInput): string[] {
		const errors: string[] = [];

		if (!input.title.trim()) {
			errors.push('Title is required.');
		}

		if (!input.head.trim()) {
			errors.push('Source branch is required.');
		}

		if (!input.base.trim()) {
			errors.push('Target branch is required.');
		}

		if (input.head.trim() && input.base.trim() && input.head.trim() === input.base.trim()) {
			errors.push('Source branch and target branch cannot be the same.');
		}

		// Validate branches exist in loaded lists
		if (this._sourceBranches.length > 0 && input.head.trim()) {
			const sourceExists = this._sourceBranches.some((b) => b.name === input.head.trim());
			if (!sourceExists) {
				errors.push(`Source branch "${input.head.trim()}" was not found in the repository branch list.`);
			}
		}

		if (this._targetBranches.length > 0 && input.base.trim()) {
			const targetExists = this._targetBranches.some((b) => b.name === input.base.trim());
			if (!targetExists) {
				errors.push(`Target branch "${input.base.trim()}" was not found in the repository branch list.`);
			}
		}

		return errors;
	}

	async ensureSourceBranchPublished(input: CreatePullRequestInput): Promise<boolean> {
		// Check if source branch exists remotely
		const sourceBranchName = input.head.trim();
		if (!sourceBranchName) {
			return false;
		}

		return this._remoteSourceBranchNames.has(sourceBranchName);
	}

	markSourceBranchPublished(branchName: string): void {
		const trimmed = branchName.trim();
		if (!trimmed) {
			return;
		}

		this._remoteSourceBranchNames.add(trimmed);
		if (!this._sourceBranches.some((branch) => branch.name === trimmed)) {
			this._sourceBranches = [
				...this._sourceBranches,
				{ name: trimmed, isDefault: false, isProtected: false },
			];
		}
	}

	private async checkDuplicateWarning(): Promise<void> {
		const repo = this._targetRepository;
		if (!repo || !this._sourceBranch) {
			return;
		}

		try {
			const openPrs = await this.pullRequestService.listPullRequests(repo, {
				state: 'open',
				base: this._targetBranch,
			});

			const duplicate = openPrs.find(
				(pr) => pr.sourceBranch === this._sourceBranch,
			);

			if (duplicate) {
				this._duplicateWarning = `An open pull request (#${duplicate.number}) already exists for ${this._sourceBranch} → ${this._targetBranch}.`;
			} else {
				this._duplicateWarning = undefined;
			}
		} catch {
			// Non-critical, ignore errors
		}
	}

	private branchTitle(sourceBranch: string): string {
		// Convert branch name to a readable title
		return sourceBranch
			.replace(/[-_]/g, ' ')
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/\b\w/g, (c) => c.toUpperCase())
			.trim();
	}

	private buildTitle(
		sourceBranch: string,
		issueContext?: CreatePullRequestInitialIssueContext,
	): string {
		if (issueContext) {
			return `Fix #${issueContext.issueNumber}: ${issueContext.issueTitle}`;
		}
		return this.branchTitle(sourceBranch);
	}

	private buildBody(issueContext?: CreatePullRequestInitialIssueContext): string {
		if (!issueContext) {
			return '';
		}

		const lines = [
			'## Summary',
			'',
			`Fixes #${issueContext.issueNumber}`,
			'',
			'## Changes',
			'',
			'-',
			'',
			'## Test Plan',
			'',
			'-',
		];

		return lines.join('\n');
	}

	private defaultSourceRepository(
		repositories: GitCodeRepository[],
		targetRepository: GitCodeRepository,
	): GitCodeRepository {
		return repositories.find((repository) => repository.remoteName === 'origin') ?? targetRepository;
	}

	private withLocalSourceBranch(branches: GitCodeBranch[], localBranch: string): GitCodeBranch[] {
		if (!localBranch || branches.some((branch) => branch.name === localBranch)) {
			return branches;
		}

		return [
			{ name: localBranch, isDefault: false, isProtected: false },
			...branches,
		];
	}

}
