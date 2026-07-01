import { GitCodeUser } from '../../common/models';
import { GitCodeClient } from '../client/gitcodeClient';
import { mapUsers } from '../mappers/userMapper';
import { DEFAULT_LIST_PAGE_SIZE } from './pagination';

interface CurrentUserResponse {
	login?: string;
	username?: string;
	name?: string;
}

interface SearchUsersResponse {
	items?: any[];
	data?: any[];
}

export class UserService {
	constructor(private readonly client: GitCodeClient) {}

	async getCurrentUser(tokenOverride?: string): Promise<{ login: string }> {
		const response = await this.client.get<CurrentUserResponse>('/api/v5/user', undefined, tokenOverride);
		return {
			login: response.login ?? response.username ?? response.name ?? 'unknown',
		};
	}

	async searchUsers(query: string, perPage: number = DEFAULT_LIST_PAGE_SIZE): Promise<GitCodeUser[]> {
		if (!query || query.trim().length === 0) {
			return [];
		}

		const response = await this.client.get<SearchUsersResponse | any[]>(
			'/api/v5/search/users',
			{
				q: query.trim(),
				per_page: perPage,
				page: 1,
			},
		);

		// Handle both wrapped and unwrapped responses
		const items = Array.isArray(response) ? response : (response.items ?? response.data ?? []);

		return mapUsers(items);
	}
}
