import { GitCodeBranch, GitCodeCompareResult, GitCodeLabel, GitCodeMilestone, GitCodeRepository, GitCodeRepositoryDetail, GitCodeUser } from '../../common/models';
import { GitCodeWriteClient } from '../client/gitcodeClient';
import { mapBranches } from '../mappers/branchMapper';
import { mapCompareResult } from '../mappers/compareMapper';
import { mapLabels } from '../mappers/labelMapper';
import { mapMilestones } from '../mappers/milestoneMapper';
import { mapRepositoryDetail } from '../mappers/repositoryMapper';
import { mapUsers } from '../mappers/userMapper';
import { PageOptions, pageQuery } from './pagination';

interface ListBranchesOptions extends PageOptions {
	search?: string;
}

interface ListMilestonesOptions extends PageOptions {
	state?: 'open' | 'closed' | 'all';
}

export class RepositoryService {
	constructor(private readonly client: GitCodeWriteClient) {}

	async getRepository(repository: GitCodeRepository): Promise<GitCodeRepositoryDetail> {
		const response = await this.client.get<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`,
		);
		return mapRepositoryDetail(response);
	}

	async listBranches(repository: GitCodeRepository, options?: ListBranchesOptions): Promise<GitCodeBranch[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/branches`,
			{
				...pageQuery(options),
				search: options?.search,
			},
		);

		if (!Array.isArray(response)) {
			return [];
		}

		return mapBranches(response);
	}

	async createBranch(
		repository: GitCodeRepository,
		input: { refs: string; branchName: string },
	): Promise<GitCodeBranch[]> {
		const response = await this.client.post<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/branches`,
			{
				refs: input.refs,
				branch_name: input.branchName,
			},
		);

		if (Array.isArray(response)) {
			return mapBranches(response);
		}

		// Some APIs return a single branch object
		return mapBranches([response]);
	}

	async compareBranches(
		repository: GitCodeRepository,
		base: string,
		head: string,
	): Promise<GitCodeCompareResult> {
		const response = await this.client.get<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
		);
		return mapCompareResult(response);
	}

	async listLabels(repository: GitCodeRepository, options?: PageOptions): Promise<GitCodeLabel[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/labels`,
			pageQuery(options),
		);

		if (!Array.isArray(response)) {
			return [];
		}

		return mapLabels(response);
	}

	async listMilestones(
		repository: GitCodeRepository,
		options?: ListMilestonesOptions,
	): Promise<GitCodeMilestone[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/milestones`,
			{
				...pageQuery(options),
				state: options?.state ?? 'open',
			},
		);

		if (!Array.isArray(response)) {
			return [];
		}

		return mapMilestones(response);
	}

	async listMembers(repository: GitCodeRepository, options?: PageOptions): Promise<GitCodeUser[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/collaborators`,
			pageQuery(options),
		);

		if (!Array.isArray(response)) {
			return [];
		}

		return mapUsers(response);
	}
}
