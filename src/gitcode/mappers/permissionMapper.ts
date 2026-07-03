import {
	GitCodePermissionPoint,
	GitCodePermissionSnapshot,
	GitCodeRepository,
	GitCodeRoleInfo,
	PermissionAction,
	PermissionScope,
} from '../../common/models';

/** @internal for use by the permission service and mapper */
interface PermissionApiResponse {
	role_info?: {
		role_uuid?: string;
		name?: string;
		cn_name?: string;
		roles_type?: number;
		access_level?: number;
	};
	resource_trees?: PermissionApiResourceTree[];
}

interface PermissionApiResourceTree {
	resource_id?: number;
	name?: string;
	cn_name?: string;
	scope?: string;
	actions?: PermissionApiAction[];
}

interface PermissionApiAction {
	permission_id?: number;
	action?: string;
	name?: string;
	cn_name?: string;
	selected?: boolean;
}

function buildPermissionKey(scope: PermissionScope, action: PermissionAction): string {
	return `${scope}:${action}`;
}

export { buildPermissionKey };

function mapRoleInfo(raw: PermissionApiResponse['role_info']): GitCodeRoleInfo | undefined {
	if (!raw) {
		return undefined;
	}

	return {
		roleUuid: raw.role_uuid,
		name: raw.name,
		displayName: raw.cn_name,
		rolesType: raw.roles_type,
		accessLevel: raw.access_level,
	};
}

function mapPermissionPoints(trees: PermissionApiResourceTree[] | undefined): GitCodePermissionPoint[] {
	if (!Array.isArray(trees)) {
		return [];
	}

	const points: GitCodePermissionPoint[] = [];

	for (const tree of trees) {
		const scope = tree.scope || tree.name || '';
		if (!Array.isArray(tree.actions)) {
			continue;
		}

		for (const action of tree.actions) {
			points.push({
				scope,
				action: action.action || '',
				selected: action.selected === true,
				permissionId: action.permission_id,
				name: action.name,
				displayName: action.cn_name,
			});
		}
	}

	return points;
}

export function mapPermissionSnapshot(
	repository: GitCodeRepository,
	response: PermissionApiResponse,
): GitCodePermissionSnapshot {
	const permissions = mapPermissionPoints(response.resource_trees);
	const role = mapRoleInfo(response.role_info);

	// Build lookup map for fast has() checks
	const lookup = new Map<string, boolean>();
	for (const p of permissions) {
		const key = buildPermissionKey(p.scope, p.action);
		// If multiple actions for the same key, preserve true
		if (p.selected || !lookup.has(key)) {
			lookup.set(key, p.selected);
		}
	}

	const snapshot: GitCodePermissionSnapshot = {
		repository,
		role,
		permissions,
		loadedAt: Date.now(),
		has(scope: PermissionScope, action: PermissionAction): boolean {
			return lookup.get(buildPermissionKey(scope, action)) === true;
		},
	};

	return snapshot;
}

/**
 * Create an empty permission snapshot for a repository.
 * Used when the permission API fails and we need a fallback that denies all actions.
 */
export function createEmptyPermissionSnapshot(repository: GitCodeRepository): GitCodePermissionSnapshot {
	return mapPermissionSnapshot(repository, {});
}
