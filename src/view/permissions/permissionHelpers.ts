import {
	GitCodePermissionSnapshot,
	IssueOverviewPermissions,
	CreateIssuePermissions,
	PullRequestOverviewPermissions,
	CreatePullRequestPermissions,
	GitCodeRoleKey,
	RolePermissionProfile,
} from '../../common/models';
import { getRolePermissionProfile } from './rolePermissionProfiles';
import { hasEffectivePermission } from './permissionEvaluator';
import { isSameLogin } from './ownershipRules';

export interface PermissionRoleViewModel {
	key: GitCodeRoleKey;
	name: string;
	displayName: string;
	accessLevel?: number;
	rank: number;
	permissionSource: string;
}

/** Re-export for consumers that previously imported from this module. */
export { hasEffectivePermission };

export function buildPullRequestOverviewPermissions(
	snapshot: GitCodePermissionSnapshot | undefined,
	options?: {
		authorLogin?: string;
		currentUserLogin?: string;
	},
): PullRequestOverviewPermissions {
	if (!snapshot) {
		return {
			canEditPullRequest: false,
			canEditPullRequestAuthorSections: false,
			canClosePullRequest: false,
			canReopenPullRequest: false,
			canMergePullRequest: false,
			canCreateComment: false,
			canEditComment: false,
			canResolveComment: false,
			canUpdateReviewers: false,
			canUpdateTesters: false,
			canUpdateAssignees: false,
			canUpdateRelatedIssues: false,
		};
	}

	const isAuthor = isSameLogin(options?.authorLogin, options?.currentUserLogin);

	return {
		canEditPullRequest: hasEffectivePermission(snapshot, { scope: 'pr', action: 'update', message: () => '' }),
		canEditPullRequestAuthorSections: hasEffectivePermission(snapshot, { scope: 'pr', action: 'update', message: () => '' }, isAuthor),
		canClosePullRequest: hasEffectivePermission(snapshot, { scope: 'pr', action: 'close', message: () => '' }, isAuthor),
		canReopenPullRequest: hasEffectivePermission(snapshot, { scope: 'pr', action: 'reopen', message: () => '' }, isAuthor),
		canMergePullRequest: hasEffectivePermission(snapshot, { scope: 'pr', action: 'merge', message: () => '' }),
		canCreateComment: hasEffectivePermission(snapshot, { scope: 'note', action: 'create', message: () => '' }),
		canEditComment: hasEffectivePermission(snapshot, { scope: 'note', action: 'create', message: () => '' }), // note:update is not exposed by API
		canResolveComment: hasEffectivePermission(snapshot, { scope: 'note', action: 'resolve', message: () => '' }),
		canUpdateReviewers: hasEffectivePermission(snapshot, { scope: 'pr', action: 'update', message: () => '' }),
		canUpdateTesters: hasEffectivePermission(snapshot, { scope: 'pr', action: 'update', message: () => '' }),
		canUpdateAssignees: hasEffectivePermission(snapshot, { scope: 'pr', action: 'update', message: () => '' }),
		canUpdateRelatedIssues: hasEffectivePermission(snapshot, { scope: 'pr', action: 'update', message: () => '' }),
	};
}

export function buildUnknownPullRequestOverviewPermissions(): PullRequestOverviewPermissions {
	return {
		canEditPullRequest: true,
		canEditPullRequestAuthorSections: true,
		canClosePullRequest: true,
		canReopenPullRequest: true,
		canMergePullRequest: true,
		canCreateComment: true,
		canEditComment: true,
		canResolveComment: true,
		canUpdateReviewers: true,
		canUpdateTesters: true,
		canUpdateAssignees: true,
		canUpdateRelatedIssues: true,
	};
}

export function buildIssueOverviewPermissions(
	snapshot: GitCodePermissionSnapshot | undefined,
	options?: {
		authorLogin?: string;
		currentUserLogin?: string;
	},
): IssueOverviewPermissions {
	if (!snapshot) {
		return {
			canEditIssue: false,
			canEditIssueAuthorSections: false,
			canCloseIssue: false,
			canReopenIssue: false,
			canCreateComment: false,
		};
	}

	const isAuthor = isSameLogin(options?.authorLogin, options?.currentUserLogin);

	return {
		canEditIssue: hasEffectivePermission(snapshot, { scope: 'issue', action: 'update', message: () => '' }),
		canEditIssueAuthorSections: hasEffectivePermission(snapshot, { scope: 'issue', action: 'update', message: () => '' }, isAuthor),
		canCloseIssue: hasEffectivePermission(snapshot, { scope: 'issue', action: 'reopen', message: () => '' }, isAuthor),
		canReopenIssue: hasEffectivePermission(snapshot, { scope: 'issue', action: 'reopen', message: () => '' }, isAuthor),
		canCreateComment: hasEffectivePermission(snapshot, { scope: 'note', action: 'create', message: () => '' }),
	};
}

export function buildUnknownIssueOverviewPermissions(): IssueOverviewPermissions {
	return {
		canEditIssue: true,
		canEditIssueAuthorSections: true,
		canCloseIssue: true,
		canReopenIssue: true,
		canCreateComment: true,
	};
}

export function buildCreateIssuePermissions(
	snapshot: GitCodePermissionSnapshot | undefined,
): CreateIssuePermissions {
	if (!snapshot) {
		return {
			canCreateIssue: false,
			canEditIssue: false,
		};
	}

	return {
		canCreateIssue: hasEffectivePermission(snapshot, { scope: 'issue', action: 'create', message: () => '' }),
		canEditIssue: hasEffectivePermission(snapshot, { scope: 'issue', action: 'update', message: () => '' }),
	};
}

export function buildCreatePullRequestPermissions(
	snapshot: GitCodePermissionSnapshot | undefined,
): CreatePullRequestPermissions {
	if (!snapshot) {
		return {
			canCreatePullRequest: false,
			canEditPullRequest: false,
			canCreateBranch: false,
		};
	}

	return {
		canCreatePullRequest: hasEffectivePermission(snapshot, { scope: 'pr', action: 'create', message: () => '' }),
		canEditPullRequest: hasEffectivePermission(snapshot, { scope: 'pr', action: 'update', message: () => '' }),
		canCreateBranch: hasEffectivePermission(snapshot, { scope: 'branch', action: 'create', message: () => '' }),
	};
}

export function buildPermissionRoleViewModel(
	snapshot: GitCodePermissionSnapshot | undefined,
): PermissionRoleViewModel | undefined {
	if (!snapshot) {
		return undefined;
	}

	const profile = getRolePermissionProfile(snapshot.role);
	return mapRoleProfileToViewModel(profile);
}

function mapRoleProfileToViewModel(profile: RolePermissionProfile): PermissionRoleViewModel {
	return {
		key: profile.key,
		name: profile.name,
		displayName: profile.displayName,
		accessLevel: profile.accessLevel,
		rank: profile.rank,
		permissionSource: 'GitCode repository permissions',
	};
}
