import { GitCodeUser } from '../../common/models';

export function mapUser(dto: any): GitCodeUser {
	return {
		login: String(dto?.login ?? dto?.username ?? dto?.name ?? ''),
		name: typeof dto?.nick_name === 'string' ? dto.nick_name : typeof dto?.name === 'string' ? dto.name : undefined,
		avatarUrl: typeof dto?.avatar_url === 'string' ? dto.avatar_url : undefined,
		htmlUrl: typeof dto?.html_url === 'string' ? dto.html_url : typeof dto?.web_url === 'string' ? dto.web_url : undefined,
		role: mapRole(dto),
	};
}

export function mapUsers(dtos: any[]): GitCodeUser[] {
	return dtos.map(mapUser);
}

function mapRole(dto: any) {
	const name = typeof dto?.role_name === 'string' ? dto.role_name : undefined;
	const displayName = typeof dto?.role_name_cn === 'string' ? dto.role_name_cn : undefined;
	const accessLevel = typeof dto?.access_level === 'number' ? dto.access_level : undefined;

	if (!name && !displayName && accessLevel === undefined) {
		return undefined;
	}

	return {
		name,
		displayName,
		accessLevel,
	};
}
