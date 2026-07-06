import { CreatePullRequestInput, CreatedPullRequestSummary, EditPullRequestInput, GitCodeRepository, GitCodeUser, PullRequestDetail, PullRequestDiffSnapshot, PullRequestFileChange, PullRequestFilesJsonDto, PullRequestMergeResult, PullRequestOperationLog, PullRequestRelatedIssue, PullRequestSummary } from '../../common/models';
import { GitCodeDeleteClient } from '../client/gitcodeClient';
import { mapDiffSnapshot } from '../mappers/pullRequestDiffSnapshotMapper';
import { mapPullRequestDetail } from '../mappers/pullRequestDetailMapper';
import { mapPullRequestFiles } from '../mappers/pullRequestFileMapper';
import { mapPullRequestOperationLogs } from '../mappers/pullRequestOperationLogMapper';
import { mapCreatePullRequestInput, mapCreatedPullRequest, mapEditPullRequestInput, mapPullRequest } from '../mappers/pullRequestMapper';
import { mapPullRequestRelatedIssues } from '../mappers/pullRequestRelatedIssueMapper';
import { mapAddedPullRequestRelatedIssues } from '../mappers/addedPullRequestRelatedIssueMapper';
import { mapUsers } from '../mappers/userMapper';
import { AddedPullRequestRelatedIssue } from '../../common/models';
import { listPagedRecords, pageQuery } from './pagination';

function normalizeReviewerLogins(logins: readonly string[]): string[] {
	const normalized = [...new Set(logins.map((login) => login.trim()).filter((login) => login.length > 0))];
	if (!normalized.length) {
		throw new Error('At least one reviewer login is required.');
	}

	return normalized;
}

function normalizeTesterLogins(logins: readonly string[]): string[] {
	const normalized = [...new Set(logins.map((login) => login.trim()).filter((login) => login.length > 0))];
	if (!normalized.length) {
		throw new Error('At least one tester login is required.');
	}

	return normalized;
}

function normalizeAssigneeLogins(logins: readonly string[]): string[] {
	const normalized = [...new Set(logins.map((login) => login.trim()).filter((login) => login.length > 0))];
	if (!normalized.length) {
		throw new Error('At least one assignee login is required.');
	}

	return normalized;
}

async function assignParticipants(
	client: GitCodeDeleteClient,
	path: string,
	field: 'reviewers' | 'testers',
	logins: readonly string[],
): Promise<any[]> {
	return client.post<any[]>(
		path,
		{
			[field]: logins.join(','),
			add: false,
		},
	);
}

export interface PullRequestFilters {
	state?: 'open' | 'closed' | 'all';
	perPage?: number;
	page?: number;
	base?: string;
	sort?: 'created' | 'updated';
	direction?: 'asc' | 'desc';
	author?: string;
}

export class PullRequestService {
	constructor(private readonly client: GitCodeDeleteClient) {}

	async listPullRequests(repository: GitCodeRepository, filters: PullRequestFilters = {}): Promise<PullRequestSummary[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls`,
			{
				state: filters.state ?? 'open',
				...pageQuery(filters),
				base: filters.base,
				sort: filters.sort,
				direction: filters.direction,
				author: filters.author,
			},
		);

		return response.map((pullRequest) => mapPullRequest(pullRequest));
	}

	async getPullRequest(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestDetail> {
		const response = await this.client.get<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}`,
		);

		return mapPullRequestDetail(response);
	}

	async createPullRequest(
		repository: GitCodeRepository,
		input: CreatePullRequestInput,
	): Promise<CreatedPullRequestSummary> {
		const requestBody = mapCreatePullRequestInput(input);
		const response = await this.client.post<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls`,
			requestBody,
		);
		return mapCreatedPullRequest(response);
	}

	async editPullRequest(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		input: EditPullRequestInput,
	): Promise<PullRequestDetail> {
		const requestBody = mapEditPullRequestInput(input);
		const response = await this.client.patch<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}`,
			requestBody,
		);
		return mapPullRequestDetail(response);
	}

	async listPullRequestFiles(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestFileChange[]> {
		const response = await listPagedRecords<any>(
			this.client,
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/files`,
		);

		return mapPullRequestFiles(response);
	}

	async getPullRequestDiffSnapshot(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestDiffSnapshot> {
		const response = await this.client.get<PullRequestFilesJsonDto>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/files.json`,
		);

		return mapDiffSnapshot(response);
	}

	async listPullRequestRelatedIssues(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestRelatedIssue[]> {
		const response = await listPagedRecords<any>(
			this.client,
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/issues`,
		);

		return mapPullRequestRelatedIssues(response);
	}

	async listPullRequestOperationLogs(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestOperationLog[]> {
		const response = await listPagedRecords<any>(
			this.client,
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/operate_logs`,
		);

		return mapPullRequestOperationLogs(response);
	}

	async listSelectableReviewers(repository: GitCodeRepository, pullRequestNumber: number): Promise<GitCodeUser[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/option_reviewers`,
		);

		if (!Array.isArray(response)) {
			return [];
		}

		return mapUsers(response);
	}

	async addReviewers(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<GitCodeUser[]> {
		const reviewers = normalizeReviewerLogins(logins);
		const response = await assignParticipants(
			this.client,
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/reviewers`,
			'reviewers',
			reviewers,
		);

		if (!Array.isArray(response)) {
			return [];
		}

		return mapUsers(response);
	}

	async removeReviewers(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<void> {
		const reviewers = normalizeReviewerLogins(logins);
		await this.client.delete(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/reviewers`,
			{
				reviewers: reviewers.join(','),
			},
		);
	}

	async addRelatedIssues(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		issueNumbers: readonly number[],
	): Promise<AddedPullRequestRelatedIssue[]> {
		if (!issueNumbers.length) {
			throw new Error('At least one issue number is required.');
		}

		const response = await this.client.post<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/issues`,
			issueNumbers,
		);

		return mapAddedPullRequestRelatedIssues(response);
	}

	async removeRelatedIssues(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		issueNumbers: readonly number[],
	): Promise<void> {
		if (!issueNumbers.length) {
			throw new Error('At least one issue number is required.');
		}

		await this.client.delete(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/issues`,
			issueNumbers,
		);
	}

	async listSelectableTesters(repository: GitCodeRepository): Promise<GitCodeUser[]> {
		const response = await this.client.get<any[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/option_testers`,
		);

		if (!Array.isArray(response)) {
			return [];
		}

		return mapUsers(response);
	}

	async addTesters(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<GitCodeUser[]> {
		const testers = normalizeTesterLogins(logins);
		const response = await assignParticipants(
			this.client,
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/testers`,
			'testers',
			testers,
		);

		if (!Array.isArray(response)) {
			return [];
		}

		return mapUsers(response);
	}

	async removeTesters(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<void> {
		const testers = normalizeTesterLogins(logins);
		await this.client.delete(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/testers`,
			{
				testers: testers.join(','),
			},
		);
	}

	async addAssignees(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<any> {
		const assignees = normalizeAssigneeLogins(logins);
		return this.client.post<any>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/assignees`,
			{
				assignees: assignees.join(','),
			},
		);
	}

	async removeAssignees(
		repository: GitCodeRepository,
		pullRequestNumber: number,
		logins: readonly string[],
	): Promise<void> {
		const assignees = normalizeAssigneeLogins(logins);
		await this.client.delete(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/assignees`,
			undefined,
			{
				assignees: assignees.join(','),
			},
		);
	}

	async mergePullRequest(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestMergeResult> {
		const response = await this.client.put<PullRequestMergeResult>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullRequestNumber}/merge`,
			{ merge_method: 'merge' },
		);

		return response;
	}
}
