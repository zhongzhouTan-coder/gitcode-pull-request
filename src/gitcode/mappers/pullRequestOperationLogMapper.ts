import { PullRequestOperationLog, PullRequestOperationLogActor } from '../../common/models';

function mapActor(dto: any): PullRequestOperationLogActor {
	const login = dto?.login ?? dto?.nick_name ?? dto?.name ?? 'unknown';
	const name = dto?.name;
	const nickName = dto?.nick_name;

	return {
		id: typeof dto?.id === 'number' ? String(dto.id) : dto?.id ?? undefined,
		login,
		name: typeof name === 'string' && name.length > 0 ? name : (typeof nickName === 'string' ? nickName : undefined),
		nickName: typeof nickName === 'string' ? nickName : undefined,
		htmlUrl: typeof dto?.web_url === 'string' ? dto.web_url : typeof dto?.html_url === 'string' ? dto.html_url : undefined,
		state: dto?.state,
	};
}

export function mapPullRequestOperationLog(dto: any): PullRequestOperationLog {
	const id = typeof dto.id === 'number' ? String(dto.id) : String(dto.id ?? '');
	const pullRequestId = dto.merge_request_id !== undefined
		? String(dto.merge_request_id)
		: undefined;
	const createdAt = typeof dto.created_at === 'string' ? dto.created_at : '';
	const updatedAt = typeof dto.updated_at === 'string' ? dto.updated_at : '';
	const action = typeof dto.action === 'string' ? dto.action : '';
	const actionType = typeof dto.action_type === 'string' ? dto.action_type : action || 'activity';
	const content = typeof dto.content === 'string' ? dto.content : '';

	return {
		id,
		content,
		action,
		actionType,
		pullRequestId,
		discussionId: typeof dto.discussion_id === 'string' ? dto.discussion_id : undefined,
		project: typeof dto.project === 'string' ? dto.project : undefined,
		actor: mapActor(dto.user),
		createdAt,
		updatedAt,
	};
}

export function mapPullRequestOperationLogs(dtos: any[]): PullRequestOperationLog[] {
	const logs = dtos.map(mapPullRequestOperationLog);

	// Sort by createdAt ascending; fall back to numeric ID when dates are equal or invalid
	return logs.sort((a, b) => {
		const dateA = new Date(a.createdAt).getTime();
		const dateB = new Date(b.createdAt).getTime();

		if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) {
			if (dateA !== dateB) {
				return dateA - dateB;
			}
		}

		const idA = Number(a.id);
		const idB = Number(b.id);
		if (!Number.isNaN(idA) && !Number.isNaN(idB)) {
			return idA - idB;
		}

		return 0;
	});
}
