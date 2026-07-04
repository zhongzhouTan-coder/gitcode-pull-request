import {
	GitCodeRoleInfo,
	GitCodeRoleKey,
	PermissionRequirement,
	PermissionScope,
	RolePermissionProfile,
} from '../../common/models';

function createPermissionRequirement(
	scope: PermissionScope,
	action: string,
	description?: string,
): PermissionRequirement {
	const normalizedDescription = description ?? `${action} ${scope}`;
	return {
		scope,
		action,
		message: (repository) =>
			`You do not have permission to ${normalizedDescription} in ${repository.fullName}.`,
	};
}

function createRolePermissionProfile(
	key: GitCodeRoleKey,
	name: string,
	displayName: string,
	rank: number,
	accessLevel: number | undefined,
	defaultPermissions: readonly PermissionRequirement[],
): RolePermissionProfile {
	return {
		key,
		name,
		displayName,
		accessLevel,
		rank,
		defaultPermissions,
	};
}

const ownerPermissions = Object.freeze([
	createPermissionRequirement('issue', 'create', 'create issues'),
	createPermissionRequirement('issue', 'update', 'update issues'),
	createPermissionRequirement('issue', 'reopen', 'close or reopen issues'),
	createPermissionRequirement('issue', 'pin', 'pin issues'),
	createPermissionRequirement('issue', 'lock', 'lock issues'),
	createPermissionRequirement('pr', 'create', 'create pull requests'),
	createPermissionRequirement('pr', 'update', 'update pull requests'),
	createPermissionRequirement('pr', 'review', 'review pull requests'),
	createPermissionRequirement('pr', 'approve', 'approve pull requests'),
	createPermissionRequirement('pr', 'merge', 'merge pull requests'),
	createPermissionRequirement('pr', 'close', 'close pull requests'),
	createPermissionRequirement('pr', 'reopen', 'reopen pull requests'),
	createPermissionRequirement('pr', 'test', 'test pull requests'),
	createPermissionRequirement('note', 'create', 'create comments'),
	createPermissionRequirement('note', 'resolve', 'resolve comments'),
]);

const maintainerPermissions = Object.freeze([
	createPermissionRequirement('issue', 'create', 'create issues'),
	createPermissionRequirement('issue', 'update', 'update issues'),
	createPermissionRequirement('issue', 'reopen', 'close or reopen issues'),
	createPermissionRequirement('issue', 'pin', 'pin issues'),
	createPermissionRequirement('issue', 'lock', 'lock issues'),
	createPermissionRequirement('pr', 'create', 'create pull requests'),
	createPermissionRequirement('pr', 'update', 'update pull requests'),
	createPermissionRequirement('pr', 'review', 'review pull requests'),
	createPermissionRequirement('pr', 'approve', 'approve pull requests'),
	createPermissionRequirement('pr', 'merge', 'merge pull requests'),
	createPermissionRequirement('pr', 'close', 'close pull requests'),
	createPermissionRequirement('pr', 'reopen', 'reopen pull requests'),
	createPermissionRequirement('pr', 'test', 'test pull requests'),
	createPermissionRequirement('note', 'create', 'create comments'),
	createPermissionRequirement('note', 'resolve', 'resolve comments'),
]);

const developerPermissions = Object.freeze([
	createPermissionRequirement('issue', 'create', 'create issues'),
	createPermissionRequirement('issue', 'reopen', 'close or reopen issues'),
	createPermissionRequirement('pr', 'create', 'create pull requests'),
	createPermissionRequirement('pr', 'review', 'review pull requests'),
	createPermissionRequirement('pr', 'merge', 'merge pull requests'),
	createPermissionRequirement('pr', 'close', 'close pull requests'),
	createPermissionRequirement('pr', 'test', 'test pull requests'),
	createPermissionRequirement('note', 'create', 'create comments'),
	createPermissionRequirement('note', 'resolve', 'resolve comments'),
]);

const reporterPermissions = Object.freeze([
	createPermissionRequirement('issue', 'create', 'create issues'),
	createPermissionRequirement('issue', 'reopen', 'close or reopen issues'),
	createPermissionRequirement('pr', 'test', 'test pull requests'),
	createPermissionRequirement('note', 'create', 'create comments'),
	createPermissionRequirement('note', 'resolve', 'resolve comments'),
]);

const guestPermissions = Object.freeze([
	createPermissionRequirement('issue', 'create', 'create issues'),
	createPermissionRequirement('note', 'create', 'create comments'),
]);

const unknownPermissions = Object.freeze([] as PermissionRequirement[]);

const roleProfiles: Record<GitCodeRoleKey, RolePermissionProfile> = {
	owner: createRolePermissionProfile('owner', 'Owner', 'Owner', 50, 50, ownerPermissions),
	maintainer: createRolePermissionProfile('maintainer', 'Maintainer', 'Maintainer', 40, 40, maintainerPermissions),
	developer: createRolePermissionProfile('developer', 'Developer', 'Developer', 30, 30, developerPermissions),
	reporter: createRolePermissionProfile('reporter', 'Reporter', 'Reporter', 20, 20, reporterPermissions),
	guest: createRolePermissionProfile('guest', 'Guest', 'Guest', 10, 10, guestPermissions),
	unknown: createRolePermissionProfile('unknown', 'Unknown', 'Unknown', 0, undefined, unknownPermissions),
};

const roleNameToKey = new Map<string, GitCodeRoleKey>([
	['owner', 'owner'],
	['maintainer', 'maintainer'],
	['developer', 'developer'],
	['reporter', 'reporter'],
	['guest', 'guest'],
]);

const accessLevelToKey = new Map<number, GitCodeRoleKey>([
	[50, 'owner'],
	[40, 'maintainer'],
	[30, 'developer'],
	[20, 'reporter'],
	[10, 'guest'],
]);

export function normalizeRoleKey(role: GitCodeRoleInfo | undefined): GitCodeRoleKey {
	const rawName = role?.name?.trim().toLowerCase();
	if (rawName) {
		const key = roleNameToKey.get(rawName);
		if (key) {
			return key;
		}
	}

	const accessLevel = role?.accessLevel;
	if (typeof accessLevel === 'number') {
		return accessLevelToKey.get(accessLevel) ?? 'unknown';
	}

	return 'unknown';
}

export function getRolePermissionProfile(
	role: GitCodeRoleInfo | undefined,
): RolePermissionProfile {
	const key = normalizeRoleKey(role);
	const profile = roleProfiles[key];

	return {
		...profile,
		name: role?.name?.trim() || profile.name,
		displayName: role?.displayName?.trim() || role?.name?.trim() || profile.displayName,
		accessLevel: role?.accessLevel ?? profile.accessLevel,
	};
}

export function roleCanByDefault(
	role: GitCodeRoleInfo | undefined,
	requirement: PermissionRequirement,
): boolean {
	const profile = getRolePermissionProfile(role);
	return profile.defaultPermissions.some(
		(candidate) => candidate.scope === requirement.scope && candidate.action === requirement.action,
	);
}
