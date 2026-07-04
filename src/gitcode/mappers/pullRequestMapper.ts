import { CreatedPullRequestSummary, CreatePullRequestInput, EditPullRequestInput, PullRequestSummary } from '../../common/models';

interface UserLike {
	login?: string;
	username?: string;
	name?: string;
}

function pickUserName(user: UserLike | undefined): string {
	return user?.login ?? user?.username ?? user?.name ?? 'unknown';
}

export function mapPullRequest(dto: any): PullRequestSummary {
	return {
		id: Number(dto.id ?? dto.number ?? dto.iid ?? 0),
		number: Number(dto.number ?? dto.iid ?? dto.id ?? 0),
		title: String(dto.title ?? 'Untitled pull request'),
		author: pickUserName(dto.user ?? dto.author),
		updatedAt: String(dto.updated_at ?? dto.updatedAt ?? ''),
		sourceBranch: dto.head?.ref ?? dto.head_branch ?? dto.source_branch,
		targetBranch: dto.base?.ref ?? dto.base_branch ?? dto.target_branch,
		url: dto.html_url ?? dto.web_url ?? dto.url,
		isDraft: Boolean(dto.draft),
	};
}

export function mapCreatePullRequestInput(input: CreatePullRequestInput): Record<string, unknown> {
	const body: Record<string, unknown> = {
		title: input.title,
		head: input.head,
		base: input.base,
	};

	if (input.body) {
		body.body = input.body;
	}
	if (input.milestoneNumber !== undefined) {
		body.milestone_number = input.milestoneNumber;
	}
	if (input.labels) {
		body.labels = input.labels;
	}
	if (input.issue) {
		body.issue = input.issue;
	}
	if (input.assignees) {
		body.assignees = input.assignees;
	}
	if (input.testers) {
		body.testers = input.testers;
	}
	if (input.pruneSourceBranch !== undefined) {
		body.prune_source_branch = input.pruneSourceBranch;
	}
	if (input.draft !== undefined) {
		body.draft = input.draft;
	}
	if (input.squash !== undefined) {
		body.squash = input.squash;
	}
	if (input.squashCommitMessage) {
		body.squash_commit_message = input.squashCommitMessage;
	}
	if (input.forkPath) {
		body.fork_path = input.forkPath;
	}
	if (input.closeRelatedIssue !== undefined) {
		body.close_related_issue = input.closeRelatedIssue;
	}

	return body;
}

export function mapCreatedPullRequest(dto: any): CreatedPullRequestSummary {
	return {
		id: Number(dto?.id ?? 0),
		number: Number(dto?.iid ?? dto?.number ?? dto?.id ?? 0),
		title: String(dto?.title ?? 'Untitled pull request'),
		state: resolveCreatedState(dto),
		author: {
			login: pickUserName(dto?.author ?? dto?.user),
			name: dto?.author?.name ?? dto?.user?.name ?? dto?.author?.nick_name,
			avatarUrl: dto?.author?.avatar_url ?? dto?.user?.avatar_url,
			htmlUrl: dto?.author?.web_url ?? dto?.user?.web_url ?? dto?.author?.html_url,
		},
		sourceBranch: String(dto?.source_branch ?? dto?.head?.ref ?? ''),
		targetBranch: String(dto?.target_branch ?? dto?.base?.ref ?? ''),
		body: String(dto?.description ?? dto?.body ?? ''),
		url: dto?.web_url ?? dto?.html_url ?? dto?.url,
		isDraft: Boolean(dto?.draft ?? dto?.work_in_progress),
	};
}

function resolveCreatedState(dto: any): 'open' | 'closed' | 'merged' {
	const state = String(dto?.state ?? '').toLowerCase();
	if (state === 'merged') {
		return 'merged';
	}
	if (state === 'closed') {
		return 'closed';
	}
	return 'open';
}

export function mapEditPullRequestInput(input: EditPullRequestInput): Record<string, unknown> {
	const body: Record<string, unknown> = {};

	if (input.title !== undefined) {
		body.title = input.title;
	}

	if (input.body !== undefined) {
		body.body = input.body;
	}
	if (input.state !== undefined) {
		body.state = input.state;
	}
	if (input.milestoneNumber !== undefined) {
		body.milestone_number = input.milestoneNumber;
	}
	if (input.labels !== undefined) {
		body.labels = input.labels;
	}
	if (input.draft !== undefined) {
		body.draft = input.draft;
	}
	if (input.closeRelatedIssue !== undefined) {
		body.close_related_issue = input.closeRelatedIssue;
	}

	return body;
}
