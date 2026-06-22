import {
	PullRequestBranchRef,
	PullRequestDetail,
	PullRequestLabel,
	PullRequestMergeabilityState,
	PullRequestParticipant,
} from '../../common/models';

interface UserLike {
	login?: string;
	username?: string;
	name?: string;
	avatar_url?: string;
	html_url?: string;
}

interface RepoLike {
	full_name?: string;
	html_url?: string;
	namespace?: {
		path?: string;
	};
}

function pickUserName(user: UserLike | undefined): string {
	return user?.login ?? user?.username ?? user?.name ?? 'unknown';
}

function mapParticipant(user: UserLike | undefined): PullRequestParticipant {
	return {
		login: pickUserName(user),
		name: user?.name,
		avatarUrl: user?.avatar_url,
		htmlUrl: user?.html_url,
	};
}

function normalizeTimestamp(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

function mapBranchRef(dto: any): PullRequestBranchRef {
	const repo = dto?.repo as RepoLike | undefined;
	return {
		label: String(dto?.label ?? dto?.ref ?? ''),
		ref: String(dto?.ref ?? ''),
		sha: normalizeTimestamp(dto?.sha),
		repositoryFullName: repo?.full_name,
		repositoryUrl: repo?.html_url,
		owner: repo?.namespace?.path,
	};
}

function mapLabels(labels: unknown): PullRequestLabel[] {
	if (!Array.isArray(labels)) {
		return [];
	}

	return labels.map((label: any) => ({
		id: Number(label?.id ?? 0),
		name: String(label?.name ?? 'unknown'),
		color: typeof label?.color === 'string' ? label.color : undefined,
	}));
}

function mapParticipants(participants: unknown): PullRequestParticipant[] {
	if (!Array.isArray(participants)) {
		return [];
	}

	return participants.map((participant) => mapParticipant(participant as UserLike));
}

function flattenReasons(reason: unknown): string[] {
	if (!reason || typeof reason !== 'object') {
		return [];
	}

	return Object.entries(reason as Record<string, unknown>)
		.map(([key, value]) => {
			if (typeof value === 'string' && value.trim()) {
				return value.trim();
			}

			if (value === false) {
				return key;
			}

			return undefined;
		})
		.filter((value): value is string => Boolean(value));
}

function mapMergeabilityState(dto: any): PullRequestMergeabilityState {
	const mergeability = dto?.mergeable_state;
	const ciPassed = typeof mergeability?.ci_state_passed === 'boolean' ? mergeability.ci_state_passed : undefined;
	const reviewersPassed = typeof mergeability?.approval_reviewers_required_passed === 'boolean'
		? mergeability.approval_reviewers_required_passed
		: undefined;
	const approversPassed = typeof mergeability?.approval_approvers_required_passed === 'boolean'
		? mergeability.approval_approvers_required_passed
		: undefined;
	const testersPassed = typeof mergeability?.approval_testers_required_passed === 'boolean'
		? mergeability.approval_testers_required_passed
		: undefined;

	const reviewChecks = [reviewersPassed, approversPassed, testersPassed].filter((value): value is boolean => value !== undefined);

	return {
		mergeable: Boolean(dto?.mergeable ?? mergeability?.state),
		canMergeCheck: typeof dto?.can_merge_check === 'boolean' ? dto.can_merge_check : undefined,
		hasConflicts: typeof mergeability?.conflict_passed === 'boolean' ? !mergeability.conflict_passed : undefined,
		ciPassed,
		reviewPassed: reviewChecks.length ? reviewChecks.every(Boolean) : undefined,
		reasons: flattenReasons(mergeability?.reason),
	};
}

function resolveState(dto: any): 'open' | 'closed' | 'merged' {
	if (normalizeTimestamp(dto?.merged_at)) {
		return 'merged';
	}

	return dto?.state === 'closed' ? 'closed' : 'open';
}

export function mapPullRequestDetail(dto: any): PullRequestDetail {
	return {
		id: Number(dto?.id ?? dto?.number ?? 0),
		number: Number(dto?.number ?? dto?.id ?? 0),
		title: String(dto?.title ?? 'Untitled pull request'),
		state: resolveState(dto),
		body: String(dto?.body ?? ''),
		url: typeof dto?.url === 'string' ? dto.url : undefined,
		htmlUrl: typeof dto?.html_url === 'string' ? dto.html_url : undefined,
		isDraft: Boolean(dto?.draft),
		createdAt: String(dto?.created_at ?? ''),
		updatedAt: String(dto?.updated_at ?? ''),
		closedAt: normalizeTimestamp(dto?.closed_at),
		mergedAt: normalizeTimestamp(dto?.merged_at),
		author: mapParticipant(dto?.user),
		source: mapBranchRef(dto?.head),
		target: mapBranchRef(dto?.base),
		assignees: mapParticipants(dto?.assignees),
		reviewers: mapParticipants(dto?.approval_reviewers),
		testers: mapParticipants(dto?.testers),
		labels: mapLabels(dto?.labels),
		mergeability: mapMergeabilityState(dto),
	};
}
