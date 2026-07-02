import {
	CreatePullRequestCommentInput,
	CreatePullRequestCommentResult,
	PullRequestComment,
	PullRequestCommentAuthor,
	PullRequestCommentReply,
	PullRequestDiffComment,
	PullRequestDiffCommentDetail,
	PullRequestDiffCommentLocation,
	PullRequestGeneralComment,
	ReplyPullRequestCommentResult,
} from '../../common/models';

// ---- DTO shapes from the list-comments endpoint ----

interface ListCommentUserDto {
	id?: unknown;
	login?: unknown;
	object_id?: unknown;
	name?: unknown;
	avatar_url?: unknown;
	html_url?: unknown;
}

interface ListCommentReplyDto {
	id?: unknown;
	body?: unknown;
	created_at?: unknown;
	updated_at?: unknown;
	user?: ListCommentUserDto;
}

interface ListCommentDto {
	id?: unknown;
	discussion_id?: unknown;
	body?: unknown;
	created_at?: unknown;
	updated_at?: unknown;
	comment_type?: unknown;
	resolved?: unknown;
	diff_position?: {
		start_new_line?: unknown;
		end_new_line?: unknown;
		position_type?: unknown;
	};
	reply?: ListCommentReplyDto[];
	user?: ListCommentUserDto;
}

// ---- DTO shape from the get-comment detail endpoint ----

interface GetCommentPositionDto {
	base_sha?: unknown;
	start_sha?: unknown;
	head_sha?: unknown;
	old_path?: unknown;
	new_path?: unknown;
	position_type?: unknown;
	new_line?: unknown;
}

interface GetCommentDto {
	id?: unknown;
	discussion_id?: unknown;
	body?: unknown;
	comment_type?: unknown;
	is_outdated?: unknown;
	position?: GetCommentPositionDto;
	user?: ListCommentUserDto;
}

interface CreatePullRequestCommentDto {
	id?: unknown;
	body?: unknown;
	note_id?: unknown;
}

// ---- Helpers ----

function asString(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number') {
		return String(value);
	}
	return '';
}

function asPositiveInt(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
		return value;
	}
	return undefined;
}

function asBool(value: unknown): boolean {
	return Boolean(value);
}

function mapAuthor(user: ListCommentUserDto | undefined): PullRequestCommentAuthor {
	return {
		id: asString(user?.id ?? user?.object_id),
		login: asString(user?.login),
		name: typeof user?.name === 'string' ? user.name : undefined,
		avatarUrl: typeof user?.avatar_url === 'string' ? user.avatar_url : undefined,
		htmlUrl: typeof user?.html_url === 'string' ? user.html_url : undefined,
	};
}

function mapReply(reply: ListCommentReplyDto): PullRequestCommentReply | undefined {
	const id = asString(reply.id);
	if (!id) {
		return undefined;
	}

	return {
		id,
		body: asString(reply.body),
		author: mapAuthor(reply.user),
		createdAt: asString(reply.created_at),
		updatedAt: asString(reply.updated_at),
	};
}

function mapReplies(replies: unknown): PullRequestCommentReply[] {
	if (!Array.isArray(replies)) {
		return [];
	}

	return replies
		.map((reply: ListCommentReplyDto) => mapReply(reply))
		.filter((r): r is PullRequestCommentReply => r !== undefined);
}

// ---- Public API ----

/**
 * Map a list-comments DTO entry into a domain comment.
 * Returns undefined when the record cannot be mapped (missing ID, unknown type, etc).
 */
export function mapListComment(dto: ListCommentDto): PullRequestComment | undefined {
	const id = asString(dto.id);
	const discussionId = asString(dto.discussion_id);
	const body = asString(dto.body);
	const createdAt = asString(dto.created_at);
	const updatedAt = asString(dto.updated_at);

	if (!id || !discussionId || !body || !createdAt) {
		return undefined;
	}

	const author = mapAuthor(dto.user);
	if (!author.id) {
		return undefined;
	}

	const commentType = asString(dto.comment_type);
	const replies = mapReplies(dto.reply);

	if (commentType === 'pr_comment') {
		const general: PullRequestGeneralComment = {
			kind: 'pullRequest',
			id,
			discussionId,
			body,
			author,
			createdAt,
			updatedAt,
			replies,
		};
		return general;
	}

	if (commentType === 'diff_comment') {
		const diffPos = dto.diff_position;
		const startLine = asPositiveInt(diffPos?.start_new_line) ?? 0;
		const endLine = asPositiveInt(diffPos?.end_new_line) ?? startLine;

		const diff: PullRequestDiffComment = {
			kind: 'diff',
			id,
			discussionId,
			body,
			author,
			createdAt,
			updatedAt,
			replies,
			resolved: asBool(dto.resolved),
			isOutdated: false, // list doesn't provide; enriched from detail later
			location: {
				side: 'head', // list comments only provide new-side positions
				startLine: Math.min(startLine, endLine || startLine),
				endLine: Math.max(startLine, endLine || startLine),
				positionType: asString(diffPos?.position_type),
			},
		};
		return diff;
	}

	// Unknown comment type — skip
	return undefined;
}

/**
 * Map a get-comment detail response into a diff comment detail.
 * Returns undefined when required fields are missing or the type is not DiffNote.
 */
export function mapCommentDetail(dto: GetCommentDto): PullRequestDiffCommentDetail | undefined {
	const id = asString(dto.id);
	const discussionId = asString(dto.discussion_id);
	const commentType = asString(dto.comment_type);

	if (!id || !discussionId || commentType !== 'DiffNote') {
		return undefined;
	}

	const pos = dto.position;
	const newLine = asPositiveInt(pos?.new_line);
	if (!newLine) {
		return undefined;
	}

	const startLine = newLine;
	const endLine = newLine;

	const location: PullRequestDiffCommentLocation = {
		path: typeof pos?.new_path === 'string' ? pos.new_path : undefined,
		previousPath: typeof pos?.old_path === 'string' ? pos.old_path : undefined,
		side: 'head',
		startLine,
		endLine,
		baseSha: typeof pos?.base_sha === 'string' ? pos.base_sha : undefined,
		startSha: typeof pos?.start_sha === 'string' ? pos.start_sha : undefined,
		headSha: typeof pos?.head_sha === 'string' ? pos.head_sha : undefined,
		positionType: asString(pos?.position_type),
	};

	return {
		id,
		discussionId,
		isOutdated: asBool(dto.is_outdated),
		location,
	};
}

/**
 * Merge a list diff comment with its get-comment detail response.
 * The detail enriches path, snapshot refs, outdated state, and anchor line.
 * Returns a new PullRequestDiffComment (does not mutate original).
 */
export function mergeCommentDetail(
	listComment: PullRequestDiffComment,
	detail: PullRequestDiffCommentDetail,
): PullRequestDiffComment {
	if (listComment.id !== detail.id) {
		return listComment;
	}

	// Preserve list's line range when detail line falls within it
	const detailLine = detail.location.startLine;
	let startLine = detailLine;
	let endLine = detailLine;

	if (
		listComment.location.startLine > 0 &&
		listComment.location.endLine > 0 &&
		detailLine >= listComment.location.startLine &&
		detailLine <= listComment.location.endLine
	) {
		startLine = listComment.location.startLine;
		endLine = listComment.location.endLine;
	}

	return {
		...listComment,
		isOutdated: detail.isOutdated,
		location: {
			...listComment.location,
			path: detail.location.path ?? listComment.location.path,
			previousPath: detail.location.previousPath ?? listComment.location.previousPath,
			side: detail.location.side,
			startLine,
			endLine,
			baseSha: detail.location.baseSha ?? listComment.location.baseSha,
			startSha: detail.location.startSha ?? listComment.location.startSha,
			headSha: detail.location.headSha ?? listComment.location.headSha,
			positionType: detail.location.positionType || listComment.location.positionType,
		},
	};
}

export function mapCreatePullRequestCommentInput(
	input: CreatePullRequestCommentInput,
): Record<string, unknown> {
	const body: Record<string, unknown> = {
		body: input.body,
	};

	if (input.kind === 'pullRequest') {
		return body;
	}

	body.path = input.path;
	body.position_type = input.positionType;

	if (input.kind === 'diff') {
		body.position = input.position;
	}

	return body;
}

export function mapCreatePullRequestCommentResult(
	dto: CreatePullRequestCommentDto,
	fallbackBody: string,
): CreatePullRequestCommentResult {
	const id = asString(dto.id);
	if (!id) {
		throw new Error('Failed to map created pull request comment: missing id.');
	}

	const noteId = asPositiveInt(dto.note_id);
	const body = asString(dto.body) || fallbackBody;

	return {
		id,
		noteId,
		body,
	};
}

interface ReplyPullRequestCommentDto {
	id?: unknown;
	body?: unknown;
	note_id?: unknown;
}

/**
 * Map a reply pull request comment response into a domain result.
 * Throws when the response is missing the required id field.
 */
export function mapReplyPullRequestCommentResult(
	dto: ReplyPullRequestCommentDto,
	fallbackBody: string,
): ReplyPullRequestCommentResult {
	const id = asString(dto.id);
	if (!id) {
		throw new Error('Failed to map reply pull request comment: missing id.');
	}

	const noteId = asPositiveInt(dto.note_id);
	const body = asString(dto.body) || fallbackBody;

	return {
		id,
		noteId,
		body,
	};
}
