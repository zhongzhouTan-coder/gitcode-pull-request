import {
	IssueRelatedPullRequest,
	IssueRelatedPullRequestBranch,
	PullRequestLabel,
	PullRequestParticipant,
} from '../../common/models';

interface AssignerLike {
	login?: string;
	name?: string;
	avatar_url?: string;
	html_url?: string;
}

interface RepoLike {
	full_name?: string;
}

interface BranchDto {
	ref?: string;
	sha?: string;
	repo?: RepoLike;
	assigner?: AssignerLike;
}

interface LabelDto {
	id?: number;
	name?: string;
	color?: string;
}

interface RelatedPrDto {
	id?: number | string;
	number?: number | string;
	state?: string;
	title?: string;
	html_url?: string;
	web_url?: string;
	url?: string;
	head?: BranchDto;
	base?: BranchDto;
	user?: AssignerLike;
	author?: AssignerLike;
	labels?: LabelDto[];
	updated_at?: string;
	closed_at?: string;
	merged_at?: string;
	can_merge_check?: boolean;
}

function pickUserName(user: AssignerLike | undefined): string {
	return user?.login ?? user?.name ?? 'unknown';
}

function mapAuthor(dto: RelatedPrDto): PullRequestParticipant {
	const assigner = dto?.head?.assigner;
	if (assigner?.login) {
		return {
			login: assigner.login,
			name: assigner.name,
			avatarUrl: assigner.avatar_url,
			htmlUrl: assigner.html_url,
		};
	}

	const user = dto?.user ?? dto?.author;
	return {
		login: pickUserName(user),
		name: user?.name,
		avatarUrl: user?.avatar_url,
		htmlUrl: user?.html_url,
	};
}

function mapBranch(branch: BranchDto | undefined): IssueRelatedPullRequestBranch {
	return {
		ref: branch?.ref ?? '',
		sha: branch?.sha,
		repositoryFullName: branch?.repo?.full_name,
	};
}

function mapLabels(labels: LabelDto[] | undefined): PullRequestLabel[] {
	if (!Array.isArray(labels)) {
		return [];
	}

	return labels.map((label) => ({
		id: Number(label.id ?? 0),
		name: label.name ?? '',
		color: label.color,
	}));
}

function resolveState(dto: RelatedPrDto): 'open' | 'closed' | 'merged' {
	if (dto.merged_at) {
		return 'merged';
	}

	if (dto.state === 'closed') {
		return 'closed';
	}

	return 'open';
}

/**
 * Map a single raw GitCode related-PR DTO into the domain model.
 */
export function mapIssueRelatedPullRequest(dto: RelatedPrDto): IssueRelatedPullRequest {
	return {
		id: Number(dto.id ?? 0),
		number: Number(dto.number ?? 0),
		title: String(dto.title ?? ''),
		state: resolveState(dto),
		url: dto.html_url ?? dto.web_url ?? dto.url,
		author: mapAuthor(dto),
		source: mapBranch(dto.head),
		target: mapBranch(dto.base),
		labels: mapLabels(dto.labels),
		updatedAt: typeof dto.updated_at === 'string' ? dto.updated_at : '',
		closedAt: typeof dto.closed_at === 'string' && dto.closed_at.trim() ? dto.closed_at : undefined,
		canMergeCheck: typeof dto.can_merge_check === 'boolean' ? dto.can_merge_check : undefined,
	};
}

/**
 * Map an array of raw GitCode related-PR DTOs into domain models.
 */
export function mapIssueRelatedPullRequests(dtos: RelatedPrDto[]): IssueRelatedPullRequest[] {
	return dtos.map(mapIssueRelatedPullRequest);
}
