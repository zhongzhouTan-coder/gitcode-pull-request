import {
	GitCodePermissionSnapshot,
	PermissionRequirement,
} from '../../common/models';
import { roleCanByDefault } from './rolePermissionProfiles';
import { PermissionDecision, PermissionOperation, operationToScopeAction } from './permissionOperations';
import {
	canChangeOwnIssueState,
	canChangeOwnPullRequestState,
	canDeleteOwnComment,
	canEditOwnComment,
	canEditOwnIssue,
	canEditOwnPullRequest,
} from './ownershipRules';

/**
 * Evaluates a business-level permission operation against the current
 * repository snapshot, role defaults, and object ownership rules.
 *
 * Evaluation order:
 * 1. Check explicit repository permission point (primary authority).
 * 2. Apply operation-specific ownership rule.
 * 3. Apply role fallback only when the permission point is denied or missing.
 * 4. Otherwise deny.
 *
 * If the snapshot explicitly denies an action, role does not override that deny.
 */
export function evaluatePermission(
	operation: PermissionOperation,
	snapshot: GitCodePermissionSnapshot | undefined,
	requirement: PermissionRequirement,
	options?: {
		objectRuleAllows?: boolean;
	},
): PermissionDecision {
	const denied: PermissionDecision = {
		allowed: false,
		source: 'unknown',
		message: requirement.message({ fullName: '', owner: '', name: '', remoteName: '', webUrl: '' }),
	};

	if (!snapshot) {
		return denied;
	}

	const scopeAction = operationToScopeAction(operation);
	const hasPermissionPoint = scopeAction
		? snapshot.has(scopeAction.scope, scopeAction.action)
		: false;

	// 1. Explicit permission point — primary authority
	if (hasPermissionPoint) {
		return {
			allowed: true,
			source: 'permission-point',
			message: '',
		};
	}

	// 2. Operation-specific ownership rule
	if (options?.objectRuleAllows) {
		return {
			allowed: true,
			source: 'ownership-rule',
			message: '',
		};
	}

	// 3. Role fallback (only when permission point is denied/missing)
	if (roleCanByDefault(snapshot.role, requirement)) {
		return {
			allowed: true,
			source: 'role-fallback',
			message: '',
		};
	}

	// 4. Deny
	return denied;
}

/**
 * Simplified boolean check — wraps {@link evaluatePermission} and returns
 * only the allowed flag. Prefer {@link evaluatePermission} when the caller
 * needs to know *why* permission was granted.
 */
export function hasEffectivePermission(
	snapshot: GitCodePermissionSnapshot | undefined,
	requirement: PermissionRequirement,
	objectRuleAllows: boolean = false,
): boolean {
	if (!snapshot) {
		return false;
	}

	const hasPoint = snapshot.has(requirement.scope, requirement.action);
	if (hasPoint) {
		return true;
	}

	if (objectRuleAllows) {
		return true;
	}

	return roleCanByDefault(snapshot.role, requirement);
}

/**
 * Resolves the ownership rule for a given operation and resource context.
 * Returns true when the current user is the resource author and the
 * operation supports ownership-based access.
 */
export function resolveOwnershipRule(
	operation: PermissionOperation,
	currentUserLogin: string | undefined,
	authorLogin: string | undefined,
): boolean {
	switch (operation) {
		case 'issue.editContent':
			return canEditOwnIssue(currentUserLogin, authorLogin);
		case 'issue.changeState':
			return canChangeOwnIssueState(currentUserLogin, authorLogin);
		case 'pr.editContent':
			return canEditOwnPullRequest(currentUserLogin, authorLogin);
		case 'pr.changeState':
			return canChangeOwnPullRequestState(currentUserLogin, authorLogin);
		case 'pr.comment.edit':
		case 'issue.comment.edit':
			return canEditOwnComment(currentUserLogin, authorLogin);
		case 'pr.comment.delete':
		case 'issue.comment.delete':
			return canDeleteOwnComment(currentUserLogin, authorLogin);
		default:
			return false;
	}
}
