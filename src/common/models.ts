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
	milestone?: IssueMilestone;
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
	files: readonly PullRequestDiffFileContext[];
}

export interface PullRequestDiffFileContext {
	path: string;
	previousPath?: string;
	type?: string;
	lines: readonly PullRequestDiffFileContextLine[];
}

export interface PullRequestDiffFileContextLine {
	kind: 'context' | 'add' | 'delete';
	oldLine?: number;
	newLine?: number;
	content: string;
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
	content?: {
		text?: PullRequestFileJsonLineDto[];
	};
}

export interface PullRequestFileJsonLineDto {
	line_content?: unknown;
	type?: unknown;
	old_line?: unknown;
	new_line?: unknown;
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

export type CreatePullRequestCommentInput =
	| {
		kind: 'pullRequest';
		body: string;
	}
	| {
		kind: 'diff';
		body: string;
		path: string;
		position: number;
		positionType: 'text';
	}
	| {
		kind: 'file';
		body: string;
		path: string;
		positionType: 'binary';
	};

export interface CreatePullRequestCommentResult {
	id: string;
	noteId?: number;
	body: string;
}

export interface RevisePullRequestCommentStatusInput {
	discussionId: string;
	resolved: boolean;
}

export interface PullRequestCommentStatusOperation {
	discussionId: string;
	resolved: boolean;
	status: 'pending' | 'failed';
	error?: string;
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

export interface CreatedIssueSummary extends IssueSummary {
	htmlUrl?: string;
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
	securityHole?: boolean;
	visibilityReason?: string;
}

// ---- Issue Comment Types ----

export interface IssueCommentAuthor {
	id?: string;
	login: string;
	name?: string;
	htmlUrl?: string;
	avatarUrl?: string;
}

export interface IssueComment {
	id: string;
	body: string;
	author: IssueCommentAuthor;
	createdAt: string;
	updatedAt: string;
	issueNumber?: number;
}

export interface IssueCommentsSnapshot {
	repositoryKey: string;
	issueNumber: number;
	comments: readonly IssueComment[];
	loadedAt: number;
}

export interface IssueOperationLogActor {
	id?: string;
	login: string;
	name?: string;
	htmlUrl?: string;
}

export interface IssueOperationLog {
	id: string;
	content: string;
	actionType: string;
	issueId?: string;
	actor: IssueOperationLogActor;
	createdAt: string;
	updatedAt: string;
}

export interface IssueOperationLogsSnapshot {
	repositoryKey: string;
	issueNumber: number;
	logs: readonly IssueOperationLog[];
	loadedAt: number;
}

export interface CreateIssueCommentInput {
	body: string;
}

export interface CreateIssueCommentResult {
	id: string;
	body: string;
	createdAt?: string;
	updatedAt?: string;
}

// ---- Issue Related Pull Request Types ----

export interface IssueRelatedPullRequestBranch {
	ref: string;
	sha?: string;
	repositoryFullName?: string;
}

export interface IssueRelatedPullRequest {
	id: number;
	number: number;
	title: string;
	state: 'open' | 'closed' | 'merged';
	url?: string;
	author: PullRequestParticipant;
	source: IssueRelatedPullRequestBranch;
	target: IssueRelatedPullRequestBranch;
	labels: PullRequestLabel[];
	updatedAt: string;
	closedAt?: string;
	canMergeCheck?: boolean;
}

export interface IssueRelatedPullRequestsSnapshot {
	repositoryKey: string;
	issueNumber: number;
	pullRequests: readonly IssueRelatedPullRequest[];
	loadedAt: number;
}

// ---- Pull Request Related Issue Types ----

export interface PullRequestRelatedIssue {
	id: number;
	number: number;
	title: string;
	state: 'open' | 'closed';
	url?: string;
	author: IssueUser;
	labels: IssueLabel[];
	repository?: IssueRepositoryRef;
	createdAt: string;
	updatedAt: string;
	issueState?: string;
	issueStateDetail?: IssueWorkflowState;
	issueType?: string;
	issueTypeDetail?: IssueTypeDetail;
	priority?: number;
	priorityDetail?: IssuePriorityDetail;
}

export interface PullRequestRelatedIssuesSnapshot {
	repositoryKey: string;
	pullRequestNumber: number;
	issues: readonly PullRequestRelatedIssue[];
	loadedAt: number;
}

export interface AddPullRequestRelatedIssuesInput {
	issueNumbers: readonly number[];
}

export interface RemovePullRequestRelatedIssuesInput {
	issueNumbers: readonly number[];
}

export interface AddedPullRequestRelatedIssue {
	id: number;
	number: number;
	title: string;
}

// ---- Create Pull Request Types ----

export interface CreatePullRequestInput {
	title: string;
	head: string;
	base: string;
	body?: string;
	milestoneNumber?: number;
	labels?: string;
	issue?: string;
	assignees?: string;
	testers?: string;
	pruneSourceBranch?: boolean;
	draft?: boolean;
	squash?: boolean;
	squashCommitMessage?: string;
	forkPath?: string;
	closeRelatedIssue?: boolean;
}

// ---- Edit Pull Request Types ----

export interface EditPullRequestInput {
	title: string;
	body?: string;
	state?: 'open' | 'closed';
	milestoneNumber?: number;
	labels?: string;
	draft?: boolean;
	closeRelatedIssue?: boolean;
}

export interface EditPullRequestOptions {
	labels: PullRequestLabel[];
	milestones: IssueMilestone[];
}

export interface EditPullRequestSnapshot {
	detail: PullRequestDetail;
	options: EditPullRequestOptions;
}

export type EditPullRequestSection =
	| 'title'
	| 'body'
	| 'labels'
	| 'milestone'
	| 'state'
	| 'draft'
	| 'closeRelatedIssue';

export interface CreatedPullRequestSummary {
	id: number;
	number: number;
	title: string;
	state: 'open' | 'closed' | 'merged';
	author: PullRequestParticipant;
	sourceBranch: string;
	targetBranch: string;
	body: string;
	url?: string;
	isDraft: boolean;
}

export interface CreatePullRequestInitialIssueContext {
	issueNumber: number;
	issueTitle: string;
	issueUrl?: string;
}

// ---- Create Issue Types ----

export interface CreateIssueInput {
	title: string;
	body: string;
	assignees: string[];
	labels: string[];
	milestoneNumber?: number;
	securityHole: boolean;
	templatePath?: string;
}

export interface EditIssueInput {
	title: string;
	body?: string;
	state?: 'reopen' | 'close';
	assignees?: string;
	milestoneNumber?: number | null;
	labels?: string;
	securityHole?: boolean;
}

export interface EditIssueOptions {
	assignees: GitCodeUser[];
	labels: GitCodeLabel[];
	milestones: GitCodeMilestone[];
}

export interface EditIssueSnapshot {
	detail: IssueDetail;
	options: EditIssueOptions;
}

export type EditIssueSection =
	| 'title'
	| 'body'
	| 'assignees'
	| 'labels'
	| 'milestone'
	| 'securityHole';

export interface IssueTemplateOption {
	label: string;
	path: string;
	body?: string;
	source: 'project' | 'organization' | 'manual';
}

export interface CreateIssueDefaults {
	repository: GitCodeRepository;
	labels: GitCodeLabel[];
	milestones: GitCodeMilestone[];
	members: GitCodeUser[];
	templates: IssueTemplateOption[];
	title: string;
	body: string;
	assignees: string[];
	selectedLabels: string[];
	milestoneNumber?: number;
	securityHole: boolean;
	templatePath: string;
	warnings?: string[];
}

export interface GitCodeRepositoryDetail {
	id: number;
	fullName: string;
	name: string;
	path: string;
	defaultBranch: string;
	webUrl: string;
	fork: boolean;
	issueTemplateSource?: 'project' | 'organization' | string;
}

export interface GitCodeBranch {
	name: string;
	sha?: string;
	isDefault: boolean;
	isProtected: boolean;
	lastCommitMessage?: string;
}

export interface GitCodeCompareResult {
	baseSha?: string;
	mergeBaseSha?: string;
	commits: GitCodeCompareCommit[];
	files: GitCodeCompareFile[];
	truncated: boolean;
}

export interface GitCodeCompareCommit {
	sha: string;
	message: string;
	authorName?: string;
}

export interface GitCodeCompareFile {
	path: string;
	status: string;
	additions: number;
	deletions: number;
}

// Reuse PullRequestParticipant for GitCodeUser
export type GitCodeUser = PullRequestParticipant;

// Reuse PullRequestLabel for GitCodeLabel
export type GitCodeLabel = PullRequestLabel;

// Reuse IssueMilestone for GitCodeMilestone
export type GitCodeMilestone = IssueMilestone;

export interface EditPullRequestCommentInput {
	commentId: string;
	body: string;
}

export interface PullRequestCommentEditOperation {
	commentId: string;
	body: string;
	status: 'pending' | 'failed';
	error?: string;
}

export interface ReplyPullRequestCommentInput {
	discussionId: string;
	body: string;
}

export interface ReplyPullRequestCommentResult {
	id: string;
	noteId?: number;
	body: string;
}

export interface PullRequestCommentReplyOperation {
	discussionId: string;
	body: string;
	status: 'pending' | 'failed';
	error?: string;
}

// ---- Pull Request Operation Log Types ----

export interface PullRequestOperationLogActor {
	id?: string;
	login: string;
	name?: string;
	nickName?: string;
	htmlUrl?: string;
	state?: string;
}

export interface PullRequestOperationLog {
	id: string;
	content: string;
	action: string;
	actionType: string;
	pullRequestId?: string;
	discussionId?: string;
	project?: string;
	actor: PullRequestOperationLogActor;
	createdAt: string;
	updatedAt: string;
}

export interface PullRequestOperationLogsSnapshot {
	repositoryKey: string;
	pullRequestNumber: number;
	logs: readonly PullRequestOperationLog[];
	loadedAt: number;
}
