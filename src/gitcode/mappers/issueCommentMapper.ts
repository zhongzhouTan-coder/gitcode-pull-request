import { CreateIssueCommentResult, IssueComment, IssueCommentAuthor } from '../../common/models';

// ---- DTO shape from the list-issue-comments endpoint ----

interface IssueCommentUserDto {
	id?: unknown;
	object_id?: unknown;
	login?: unknown;
	name?: unknown;
	html_url?: unknown;
	avatar_url?: unknown;
}

interface IssueCommentTargetDto {
	issue?: {
		id?: unknown;
		title?: unknown;
		number?: unknown;
	};
}

interface IssueCommentDto {
	id?: unknown;
	body?: unknown;
	user?: IssueCommentUserDto;
	target?: IssueCommentTargetDto;
	created_at?: unknown;
	updated_at?: unknown;
}

interface CreateIssueCommentResponseDto {
	id?: unknown;
	body?: unknown;
	created_at?: unknown;
	updated_at?: unknown;
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

function mapAuthor(user: IssueCommentUserDto | undefined): IssueCommentAuthor {
	return {
		id: asString(user?.id ?? user?.object_id),
		login: asString(user?.login) || asString(user?.name) || 'unknown',
		name: typeof user?.name === 'string' ? user.name : undefined,
		htmlUrl: typeof user?.html_url === 'string' ? user.html_url : undefined,
		avatarUrl: typeof user?.avatar_url === 'string' ? user.avatar_url : undefined,
	};
}

// ---- Public API ----

/**
 * Maps a single raw GitCode issue comment DTO to the `IssueComment` domain model.
 */
export function mapIssueComment(dto: IssueCommentDto): IssueComment {
	const issueNumber = dto.target?.issue?.number !== undefined
		? Number(dto.target.issue.number)
		: undefined;

	return {
		id: asString(dto.id),
		body: typeof dto.body === 'string' ? dto.body : '',
		author: mapAuthor(dto.user),
		createdAt: asString(dto.created_at),
		updatedAt: asString(dto.updated_at),
		issueNumber,
	};
}

/**
 * Maps an array of raw GitCode issue comment DTOs to `IssueComment` domain models.
 */
export function mapIssueComments(dtos: IssueCommentDto[]): IssueComment[] {
	return dtos.map(mapIssueComment);
}

/**
 * Maps a raw GitCode create issue comment response DTO to `CreateIssueCommentResult`.
 */
export function mapCreateIssueCommentResult(dto: CreateIssueCommentResponseDto): CreateIssueCommentResult {
	return {
		id: asString(dto.id),
		body: typeof dto.body === 'string' ? dto.body : '',
		createdAt: typeof dto.created_at === 'string' ? dto.created_at : undefined,
		updatedAt: typeof dto.updated_at === 'string' ? dto.updated_at : undefined,
	};
}
