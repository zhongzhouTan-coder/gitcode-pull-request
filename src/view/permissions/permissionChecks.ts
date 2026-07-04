import { GitCodeRepository, PermissionRequirement } from '../../common/models';
import { PermissionStore } from '../state/permissionStore';
import { hasEffectivePermission } from './permissionEvaluator';
import { showPermissionDeniedWarning } from './permissionMessages';

/**
 * Checks whether the current user has the required permission for a repository.
 * Returns true if permission is granted, false otherwise.
 *
 * If the permission API previously failed for this repository (no cached snapshot),
 * this will attempt to fetch it. On fetch failure, it returns true to avoid
 * permanently blocking all write features — server-side 403 handling remains
 * the fallback.
 */
export async function checkPermission(
	permissionStore: PermissionStore,
	repository: GitCodeRepository,
	requirement: PermissionRequirement,
): Promise<boolean> {
	try {
		const snapshot = await permissionStore.get(repository);
		return hasEffectivePermission(snapshot, requirement);
	} catch {
		// If we can't verify permissions, allow the action to proceed.
		// The server will still reject unauthorized requests.
		return true;
	}
}

/**
 * Checks permission and shows a warning message if denied.
 * Returns true if the action should proceed.
 */
export async function requirePermission(
	permissionStore: PermissionStore,
	repository: GitCodeRepository,
	requirement: PermissionRequirement,
): Promise<boolean> {
	const allowed = await checkPermission(permissionStore, repository, requirement);

	if (!allowed) {
		showPermissionDeniedWarning(requirement.message(repository));
		return false;
	}

	return true;
}
