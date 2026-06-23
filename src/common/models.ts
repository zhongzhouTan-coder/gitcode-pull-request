export interface GitCodeRepository {
	remoteName: string;
	owner: string;
	name: string;
	fullName: string;
	webUrl: string;
}

export interface PullRequestSummary {
	id: number;
	number: number;
	title: string;
	author: string;
	updatedAt: string;
	sourceBranch?: string;
	targetBranch?: string;
	url?: string;
	isDraft?: boolean;
}

export interface PullRequestParticipant {
	login: string;
	name?: string;
	avatarUrl?: string;
	htmlUrl?: string;
}

export interface PullRequestLabel {
	id: number;
	name: string;
	color?: string;
}

export interface PullRequestBranchRef {
	label: string;
	ref: string;
	sha?: string;
	repositoryFullName?: string;
	repositoryUrl?: string;
	owner?: string;
}

export interface PullRequestMergeabilityState {
	mergeable: boolean;
	canMergeCheck?: boolean;
	hasConflicts?: boolean;
	ciPassed?: boolean;
	reviewPassed?: boolean;
	reasons: string[];
}

export interface PullRequestDetail {
	id: number;
	number: number;
	title: string;
	state: 'open' | 'closed' | 'merged';
	body: string;
	url?: string;
	htmlUrl?: string;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
	closedAt?: string;
	mergedAt?: string;
	author: PullRequestParticipant;
	source: PullRequestBranchRef;
	target: PullRequestBranchRef;
	assignees: PullRequestParticipant[];
	reviewers: PullRequestParticipant[];
	testers: PullRequestParticipant[];
	labels: PullRequestLabel[];
	mergeability: PullRequestMergeabilityState;
}

export type PullRequestFileStatus =
	| 'added'
	| 'modified'
	| 'deleted'
	| 'renamed';

export interface PullRequestFileChange {
	sha: string;
	path: string;
	previousPath?: string;
	status: PullRequestFileStatus;
	additions: number;
	deletions: number;
	blobId?: string;
	blobUrl?: string;
	rawUrl?: string;
	patch?: string;
	tooLarge: boolean;
	sourceBranch?: string;
	targetBranch?: string;
	sourceRepository?: string;
	targetRepository?: string;
}
