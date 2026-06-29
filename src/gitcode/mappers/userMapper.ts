import { GitCodeUser } from '../../common/models';

export function mapUser(dto: any): GitCodeUser {
	return {
		login: String(dto?.login ?? dto?.username ?? dto?.name ?? ''),
		name: typeof dto?.nick_name === 'string' ? dto.nick_name : typeof dto?.name === 'string' ? dto.name : undefined,
		avatarUrl: typeof dto?.avatar_url === 'string' ? dto.avatar_url : undefined,
		htmlUrl: typeof dto?.html_url === 'string' ? dto.html_url : typeof dto?.web_url === 'string' ? dto.web_url : undefined,
	};
}

export function mapUsers(dtos: any[]): GitCodeUser[] {
	return dtos.map(mapUser);
}
