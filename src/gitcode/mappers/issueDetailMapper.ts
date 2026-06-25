import {
	IssueDetail,
	IssueLabel,
	IssueMilestone,
	IssuePriorityDetail,
	IssueRepositoryRef,
	IssueTypeDetail,
	IssueUser,
	IssueWorkflowState,
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

function mapIssueMilestone(dto: any): IssueMilestone | undefined {
	if (!dto) {
		return undefined;
	}

	return {
		number: Number(dto?.number ?? 0),
		title: dto?.title ?? '',
		state: dto?.state,
		dueOn: dto?.due_on ?? dto?.dueOn,
		url: dto?.url,
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

function mapRepositoryRef(dto: any): IssueRepositoryRef {
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
 * Maps a raw GitCode get-issue API response to the `IssueDetail` domain model.
 * Handles API inconsistencies such as `number` returned as a string and
 * empty timestamp strings.
 */
export function mapIssueDetail(dto: any): IssueDetail {
	const number = Number(dto.number ?? dto.iid ?? dto.id ?? 0);
	const rawState = String(dto.state ?? 'open').toLowerCase();
	const state: 'open' | 'closed' = rawState === 'closed' ? 'closed' : 'open';

	const authorUser = dto.user ?? dto.author;
	const author = mapIssueUser(authorUser);

	const assignees: IssueUser[] = [];
	if (Array.isArray(dto.assignees)) {
		assignees.push(...dto.assignees.map(mapIssueUser));
	} else if (dto.assignee) {
		assignees.push(mapIssueUser(dto.assignee));
	}

	const labels: IssueLabel[] = Array.isArray(dto.labels)
		? dto.labels.map(mapIssueLabel)
		: [];

	const comments = Number(dto.comments ?? 0);
	const createdAt = String(dto.created_at ?? dto.createdAt ?? '');
	const updatedAt = String(dto.updated_at ?? dto.updatedAt ?? '');

	// finished_at can be empty string — normalize to undefined
	const finishedAtRaw = dto.finished_at ?? dto.finishedAt;
	const finishedAt: string | undefined =
		typeof finishedAtRaw === 'string' && finishedAtRaw.trim().length > 0
			? finishedAtRaw
			: undefined;

	// Prefer html_url, fall back to web_url or url
	const url = dto.html_url ?? dto.web_url ?? dto.url ?? undefined;

	return {
		id: Number(dto.id ?? 0),
		number,
		title: String(dto.title ?? 'Untitled issue'),
		state,
		body: String(dto.body ?? ''),
		author,
		assignees,
		labels,
		comments,
		createdAt,
		updatedAt,
		finishedAt,
		url,
		repository: mapRepositoryRef(dto.repository),
		issueState: normalizeEmptyString(dto.issue_state ?? dto.issueState),
		issueStateDetail: mapIssueWorkflowState(dto.issue_state_detail ?? dto.issueStateDetail),
		issueType: normalizeEmptyString(dto.issue_type ?? dto.issueType),
		issueTypeDetail: mapIssueTypeDetail(dto.issue_type_detail ?? dto.issueTypeDetail),
		priority: dto.priority !== undefined ? Number(dto.priority) : undefined,
		priorityDetail: mapIssuePriorityDetail(dto.issue_priority_detail ?? dto.issuePriorityDetail),
		milestone: mapIssueMilestone(dto.milestone),
		visibilityReason: normalizeEmptyString(dto.visibility_reason ?? dto.visibilityReason),
	};
}
