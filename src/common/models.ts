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

// ---- Diff View Types ----

export interface PullRequestDiffRefs {
	baseSha: string;
	startSha?: string;
	headSha: string;
}

export interface PullRequestDiffSnapshot {
	refs: PullRequestDiffRefs;
	fileTypes: ReadonlyMap<string, string>;
}

/** @internal for use by the snapshot service and mapper */
export interface PullRequestFilesJsonDto {
	diff_refs?: {
		base_sha?: string;
		start_sha?: string;
		head_sha?: string;
	};
	diffs?: PullRequestFileJsonDto[];
}

export interface PullRequestFileJsonDto {
	statistic?: {
		type?: string;
		path?: string;
		old_path?: string;
		new_path?: string;
	};
}

export type DiffSide = 'base' | 'head' | 'empty';

// ---- Comment Types ----

export interface PullRequestCommentAuthor {
	id: string;
	login: string;
	name?: string;
	avatarUrl?: string;
	htmlUrl?: string;
}

export interface PullRequestCommentReply {
	id: string;
	body: string;
	author: PullRequestCommentAuthor;
	createdAt: string;
	updatedAt: string;
}

interface PullRequestCommentBase {
	id: string;
	discussionId: string;
	body: string;
	author: PullRequestCommentAuthor;
	createdAt: string;
	updatedAt: string;
	replies: PullRequestCommentReply[];
}

export interface PullRequestGeneralComment extends PullRequestCommentBase {
	kind: 'pullRequest';
}

export interface PullRequestDiffComment extends PullRequestCommentBase {
	kind: 'diff';
	resolved: boolean;
	isOutdated: boolean;
	location: PullRequestDiffCommentLocation;
}

export interface PullRequestDiffCommentLocation {
	path?: string;
	previousPath?: string;
	side: 'base' | 'head';
	startLine: number;
	endLine: number;
	baseSha?: string;
	startSha?: string;
	headSha?: string;
	positionType: string;
}

export interface PullRequestDiffCommentDetail {
	id: string;
	discussionId: string;
	isOutdated: boolean;
	location: PullRequestDiffCommentLocation;
}

export type PullRequestComment =
	| PullRequestGeneralComment
	| PullRequestDiffComment;

export interface PullRequestCommentsSnapshot {
	repositoryKey: string;
	pullRequestNumber: number;
	comments: readonly PullRequestComment[];
	loadedAt: number;
}

// ---- Issue Types ----

export interface IssueUser {
	login: string;
	name?: string;
	avatarUrl?: string;
	htmlUrl?: string;
}

export interface IssueLabel {
	id: number;
	name: string;
	color?: string;
}

export interface IssueMilestone {
	number: number;
	title: string;
	state?: string;
	dueOn?: string;
	url?: string;
}

export interface IssueSummary {
	id: number;
	number: number;
	title: string;
	state: 'open' | 'closed';
	author: IssueUser;
	assignees: IssueUser[];
	labels: IssueLabel[];
	comments: number;
	createdAt: string;
	updatedAt: string;
	finishedAt?: string;
	url?: string;
	issueState?: string;
	issueType?: string;
	priority?: number;
	milestone?: IssueMilestone;
}

// ---- Issue Detail Types ----

export interface IssueWorkflowState {
	id?: number;
	title: string;
	serial?: number;
}

export interface IssueTypeDetail {
	id?: number;
	title: string;
	isSystem?: boolean;
}

export interface IssuePriorityDetail {
	id?: number;
	title: string;
}

export interface IssueRepositoryRef {
	id?: number;
	fullName: string;
	name?: string;
	path?: string;
	description?: string;
	url?: string;
}

export interface IssueDetail {
	id: number;
	number: number;
	title: string;
	state: 'open' | 'closed';
	body: string;
	author: IssueUser;
	assignees: IssueUser[];
	labels: IssueLabel[];
	comments: number;
	createdAt: string;
	updatedAt: string;
	finishedAt?: string;
	url?: string;
	repository: IssueRepositoryRef;
	issueState?: string;
	issueStateDetail?: IssueWorkflowState;
	issueType?: string;
	issueTypeDetail?: IssueTypeDetail;
	priority?: number;
	priorityDetail?: IssuePriorityDetail;
	milestone?: IssueMilestone;
	visibilityReason?: string;
}
