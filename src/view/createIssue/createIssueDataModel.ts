import {
	CreateIssueDefaults,
	CreateIssueInput,
	CreatedIssueSummary,
	GitCodeRepository,
	GitCodeUser,
	IssueTemplateOption,
} from '../../common/models';
import { Logger } from '../../common/logger';
import { IssueService } from '../../gitcode/services/issueService';
import { RepositoryService } from '../../gitcode/services/repositoryService';
import { CreateIssueTemplateService } from './createIssueTemplateService';

export class CreateIssueDataModel {
	private repository?: GitCodeRepository;
	private defaults?: CreateIssueDefaults;

	constructor(
		private readonly repositoryService: RepositoryService,
		private readonly issueService: IssueService,
		private readonly templateService: CreateIssueTemplateService,
		private readonly logger: Logger,
	) {}

	get currentRepository(): GitCodeRepository | undefined {
		return this.repository;
	}

	async initialize(repository: GitCodeRepository): Promise<CreateIssueDefaults> {
		this.repository = repository;
		const warnings: string[] = [];

		const [repositoryDetailResult, labelsResult, milestonesResult, membersResult] = await Promise.allSettled([
			this.repositoryService.getRepository(repository),
			this.repositoryService.listLabels(repository, { perPage: 100 }),
			this.repositoryService.listMilestones(repository, { state: 'open', perPage: 100 }),
			this.repositoryService.listMembers(repository, { perPage: 100 }),
		]);

		const repositoryDetail = repositoryDetailResult.status === 'fulfilled' ? repositoryDetailResult.value : undefined;
		const labels = labelsResult.status === 'fulfilled' ? labelsResult.value : [];
		const milestones = milestonesResult.status === 'fulfilled' ? milestonesResult.value : [];
		const members = membersResult.status === 'fulfilled' ? membersResult.value : [];

		if (labelsResult.status === 'rejected') {
			warnings.push('Repository labels could not be loaded. Label selection is unavailable.');
		}
		if (milestonesResult.status === 'rejected') {
			warnings.push('Repository milestones could not be loaded. Milestone selection is unavailable.');
		}
		if (membersResult.status === 'rejected') {
			warnings.push('Repository members could not be loaded. Assignee selection is unavailable.');
		}
		if (repositoryDetailResult.status === 'rejected') {
			this.logger.debug(`Create issue repository detail load failed for ${repository.fullName}: ${repositoryDetailResult.reason instanceof Error ? repositoryDetailResult.reason.message : String(repositoryDetailResult.reason)}`);
		}

		let templates: IssueTemplateOption[] = [];
		if (repositoryDetail) {
			try {
				templates = await this.templateService.detectTemplates(repository, repositoryDetail.defaultBranch);
			} catch (error) {
				warnings.push('Issue templates could not be detected automatically. You can still enter a template path manually.');
				this.logger.debug(`Create issue template detection failed for ${repository.fullName}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		this.defaults = {
			repository,
			labels,
			milestones,
			members,
			templates,
			title: '',
			body: '',
			assignees: [],
			selectedLabels: [],
			securityHole: false,
			templatePath: '',
			warnings,
		};

		return this.defaults;
	}

	getDefaults(): CreateIssueDefaults | undefined {
		return this.defaults;
	}

	listMembers(query?: string): GitCodeUser[] {
		const members = this.defaults?.members ?? [];
		const normalizedQuery = query?.trim().toLowerCase();
		if (!normalizedQuery) {
			return members;
		}

		return members.filter((member) => {
			const login = member.login.toLowerCase();
			const name = member.name?.toLowerCase() ?? '';
			return login.includes(normalizedQuery) || name.includes(normalizedQuery);
		});
	}

	validate(input: CreateIssueInput): string[] {
		const errors: string[] = [];
		const normalized = this.normalize(input);

		if (!normalized.title) {
			errors.push('Title is required.');
		}

		return errors;
	}

	normalize(input: CreateIssueInput): CreateIssueInput {
		return {
			title: input.title.trim(),
			body: input.body ?? '',
			assignees: this.normalizeList(input.assignees),
			labels: this.normalizeList(input.labels),
			milestoneNumber: Number.isFinite(input.milestoneNumber) && (input.milestoneNumber ?? 0) > 0
				? input.milestoneNumber
				: undefined,
			securityHole: Boolean(input.securityHole),
			templatePath: input.templatePath?.trim() ? input.templatePath.trim() : undefined,
		};
	}

	async createIssue(input: CreateIssueInput): Promise<CreatedIssueSummary> {
		if (!this.repository) {
			throw new Error('No repository selected.');
		}

		const normalized = this.normalize(input);
		const errors = this.validate(normalized);
		if (errors.length > 0) {
			throw new Error(errors.join('\n'));
		}

		return this.issueService.createIssue(this.repository, normalized);
	}

	private normalizeList(values: string[]): string[] {
		const seen = new Set<string>();
		const result: string[] = [];

		for (const raw of values) {
			const value = raw.trim();
			if (!value) {
				continue;
			}

			const key = value.toLowerCase();
			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			result.push(value);
		}

		return result;
	}
}