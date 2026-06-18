import { GitCodeClient } from '../client/gitcodeClient';

interface CurrentUserResponse {
	login?: string;
	username?: string;
	name?: string;
}

export class UserService {
	constructor(private readonly client: GitCodeClient) {}

	async getCurrentUser(tokenOverride?: string): Promise<{ login: string }> {
		const response = await this.client.get<CurrentUserResponse>('/api/v5/user', undefined, tokenOverride);
		return {
			login: response.login ?? response.username ?? response.name ?? 'unknown',
		};
	}
}
