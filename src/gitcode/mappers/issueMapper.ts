import { EditIssueInput, GitCodeRepository, IssueUser, IssueLabel, IssueMilestone, IssueSummary } from '../../common/models';

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

export function mapIssue(dto: any): IssueSummary {
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
	const finishedAt = dto.finished_at || dto.finishedAt || undefined;

	const url = dto.html_url ?? dto.web_url ?? dto.url ?? undefined;

	return {
		id: Number(dto.id ?? 0),
		number,
		title: String(dto.title ?? 'Untitled issue'),
		state,
		author,
		assignees,
		labels,
		comments,
		createdAt,
		updatedAt,
		finishedAt: typeof finishedAt === 'string' && finishedAt.length > 0 ? finishedAt : undefined,
		url,
		issueState: dto.issue_state ?? dto.issueState,
		issueType: dto.issue_type ?? dto.issueType,
		priority: dto.priority !== undefined ? Number(dto.priority) : undefined,
		milestone: mapIssueMilestone(dto.milestone),
	};
}

export function mapEditIssueInput(repository: GitCodeRepository, input: EditIssueInput): Record<string, unknown> {
	const body: Record<string, unknown> = {
		repo: repository.name,
	};

	if (input.title !== undefined) {
		body.title = input.title;
	}

	if (input.body !== undefined) {
		body.body = input.body;
	}
	if (input.state !== undefined) {
		body.state = input.state;
	}
	if (input.assignees !== undefined) {
		body.assignee = input.assignees;
	}
	if (input.milestoneNumber !== undefined) {
		body.milestone = input.milestoneNumber;
	}
	if (input.labels !== undefined) {
		body.labels = input.labels;
	}
	if (input.securityHole !== undefined) {
		body.security_hole = input.securityHole;
	}

	return body;
}
