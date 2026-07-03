import { GitCodePermissionSnapshot, GitCodeRepository } from '../../common/models';
import { GitCodeClient } from '../client/gitcodeClient';
import { mapPermissionSnapshot } from '../mappers/permissionMapper';

interface PermissionApiResponse {
	role_info?: {
		role_uuid?: string;
		name?: string;
		cn_name?: string;
		roles_type?: number;
		access_level?: number;
	};
	resource_trees?: Array<{
		resource_id?: number;
		name?: string;
		cn_name?: string;
		scope?: string;
		actions?: Array<{
			permission_id?: number;
			action?: string;
			name?: string;
			cn_name?: string;
			selected?: boolean;
		}>;
	}>;
}

export class PermissionService {
	constructor(private readonly client: GitCodeClient) {}

	async getRepositoryPermissions(
		repository: GitCodeRepository,
	): Promise<GitCodePermissionSnapshot> {
		const response = await this.client.get<PermissionApiResponse>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/collaborators/self-permission`,
		);
		return mapPermissionSnapshot(repository, response);
	}
}
