import {
	IssueLabel,
	IssuePriorityDetail,
	IssueRepositoryRef,
	IssueTypeDetail,
	IssueUser,
	IssueWorkflowState,
	PullRequestRelatedIssue,
} from '../../common/models';

function mapIssueUser(dto: any): IssueUser {
	return {
		login: dto?.login ?? 'unknown',
		name: dto?.name,
		avatarUrl: dto?.avatar_url ?? dto?.avatarUrl,
		htmlUrl: dto?.html_url ?? dto?.htmlUrl,
	};
}

function mapIssueLabel(dto: any): IssueLabel {
	return {
		id: Number(dto?.id ?? 0),
		name: dto?.name ?? '',
		color: dto?.color,
	};
}

function mapIssueWorkflowState(dto: any): IssueWorkflowState | undefined {
	if (!dto) {
		return undefined;
	}

	return {
		id: dto.id !== undefined ? Number(dto.id) : undefined,
		title: dto.title ?? '',
		serial: dto.serial !== undefined ? Number(dto.serial) : undefined,
	};
}

function mapIssueTypeDetail(dto: any): IssueTypeDetail | undefined {
	if (!dto) {
		return undefined;
	}

	return {
		id: dto.id !== undefined ? Number(dto.id) : undefined,
		title: dto.title ?? '',
		isSystem: dto.is_system !== undefined ? Boolean(dto.is_system) : undefined,
	};
}

function mapIssuePriorityDetail(dto: any): IssuePriorityDetail | undefined {
	if (!dto) {
		return undefined;
	}

	return {
		id: dto.id !== undefined ? Number(dto.id) : undefined,
		title: dto.title ?? '',
	};
}

function mapRepositoryRef(dto: any): IssueRepositoryRef | undefined {
	if (!dto) {
		return undefined;
	}

	return {
		id: dto.id !== undefined ? Number(dto.id) : undefined,
		fullName: dto?.full_name ?? '',
		name: dto?.name,
		path: dto?.path,
		description: dto?.description,
		url: dto?.url,
	};
}

function normalizeEmptyString(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

/**
 * Maps a raw GitCode pull-request-related-issues API response item
 * to the `PullRequestRelatedIssue` domain model.
 */
export function mapPullRequestRelatedIssue(dto: any): PullRequestRelatedIssue {
	const number = Number(dto.number ?? dto.iid ?? dto.id ?? 0);
	const rawState = String(dto.state ?? 'open').toLowerCase();
	const state: 'open' | 'closed' = rawState === 'closed' ? 'closed' : 'open';

	const authorUser = dto.user ?? dto.author;
	const author = mapIssueUser(authorUser);

	const labels: IssueLabel[] = Array.isArray(dto.labels)
		? dto.labels.map(mapIssueLabel)
		: [];

	const url = dto.html_url ?? dto.web_url ?? dto.url ?? undefined;

	const createdAt = String(dto.issue_created_at ?? dto.created_at ?? dto.createdAt ?? '');
	const updatedAt = String(dto.issue_updated_at ?? dto.updated_at ?? dto.updatedAt ?? '');

	return {
		id: Number(dto.id ?? 0),
		number,
		title: String(dto.title ?? 'Untitled issue'),
		state,
		url,
		author,
		labels,
		repository: mapRepositoryRef(dto.repository),
		createdAt,
		updatedAt,
		issueState: normalizeEmptyString(dto.issue_state ?? dto.issueState),
		issueStateDetail: mapIssueWorkflowState(dto.issue_state_detail ?? dto.issueStateDetail),
		issueType: normalizeEmptyString(dto.issue_type ?? dto.issueType),
		issueTypeDetail: mapIssueTypeDetail(dto.issue_type_detail ?? dto.issueTypeDetail),
		priority: dto.priority !== undefined ? Number(dto.priority) : undefined,
		priorityDetail: mapIssuePriorityDetail(dto.issue_priority_detail ?? dto.issuePriorityDetail),
	};
}

export function mapPullRequestRelatedIssues(dtos: any[]): PullRequestRelatedIssue[] {
	return dtos.map(mapPullRequestRelatedIssue);
}
