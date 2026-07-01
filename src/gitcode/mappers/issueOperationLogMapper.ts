import { IssueOperationLog, IssueOperationLogActor } from '../../common/models';

function mapActor(dto: any): IssueOperationLogActor {
	const login = typeof dto?.login === 'string' && dto.login
		? dto.login
		: typeof dto?.name === 'string' && dto.name
			? dto.name
			: 'unknown';

	return {
		id: typeof dto?.id === 'number' ? String(dto.id) : typeof dto?.id === 'string' ? dto.id : undefined,
		login,
		name: typeof dto?.name === 'string' && dto.name ? dto.name : undefined,
		htmlUrl: typeof dto?.html_url === 'string' && dto.html_url ? dto.html_url : undefined,
	};
}

export function mapIssueOperationLog(dto: any): IssueOperationLog {
	return {
		id: typeof dto?.id === 'number' ? String(dto.id) : String(dto?.id ?? ''),
		content: typeof dto?.content === 'string' ? dto.content : '',
		actionType: typeof dto?.action_type === 'string' && dto.action_type ? dto.action_type : 'activity',
		issueId: dto?.issue_id !== undefined ? String(dto.issue_id) : undefined,
		actor: mapActor(dto?.user),
		createdAt: typeof dto?.created_at === 'string' ? dto.created_at : '',
		updatedAt: typeof dto?.updated_at === 'string'
			? dto.updated_at
			: typeof dto?.update_at === 'string'
				? dto.update_at
				: '',
	};
}

function compareIds(a: string, b: string): number {
	const numberA = Number(a);
	const numberB = Number(b);

	if (!Number.isNaN(numberA) && !Number.isNaN(numberB) && numberA !== numberB) {
		return numberA - numberB;
	}

	return 0;
}

export function mapIssueOperationLogs(dtos: any[]): IssueOperationLog[] {
	return dtos
		.map(mapIssueOperationLog)
		.sort((a, b) => {
			const dateA = new Date(a.createdAt).getTime();
			const dateB = new Date(b.createdAt).getTime();
			const hasValidDates = !Number.isNaN(dateA) && !Number.isNaN(dateB);

			if (hasValidDates && dateA !== dateB) {
				return dateA - dateB;
			}

			return compareIds(a.id, b.id);
		});
}