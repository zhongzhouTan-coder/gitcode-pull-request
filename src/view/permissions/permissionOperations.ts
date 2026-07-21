import {
	GitCodePermissionSnapshot,
	GitCodeRepository,
	GitCodeRoleKey,
} from '../../common/models';

/**
 * Business-level permission operations.
 *
 * These represent the actual actions a user can perform in the issue/PR UI,
 * not raw GitCode API permission points.
 */
export type PermissionOperation =
	| 'issue.create'
	| 'issue.editContent'
	| 'issue.changeState'
	| 'issue.comment.create'
	| 'issue.comment.edit'
	| 'issue.comment.delete'
	| 'pr.create'
	| 'pr.editContent'
	| 'pr.changeState'
	| 'pr.comment.create'
	| 'pr.comment.edit'
	| 'pr.comment.delete'
	| 'pr.comment.resolve'
	| 'pr.reviewers.update'
	| 'pr.testers.update'
	| 'pr.relatedIssues.update'
	| 'branch.create';

/**
 * Context for evaluating a single permission operation.
 */
export interface PermissionContext {
	repository: GitCodeRepository;
	snapshot?: GitCodePermissionSnapshot;
	actor?: {
		login?: string;
		role?: GitCodeRoleKey;
	};
	resource?: {
		kind: 'issue' | 'pr' | 'comment';
		authorLogin?: string;
		creatorLogin?: string;
	};
}

/**
 * Result of a permission evaluation.
 */
export interface PermissionDecision {
	allowed: boolean;
	source:
		| 'permission-point'
		| 'ownership-rule'
		| 'role-fallback'
		| 'unknown';
	message: string;
}

/**
 * Maps a business operation to the raw GitCode scope/action pair
 * used for {@link GitCodePermissionSnapshot.has}.
 */
export function operationToScopeAction(operation: PermissionOperation): { scope: string; action: string } | undefined {
	switch (operation) {
		case 'issue.create':
			return { scope: 'issue', action: 'create' };
		case 'issue.editContent':
			return { scope: 'issue', action: 'update' };
		case 'issue.changeState':
			return { scope: 'issue', action: 'reopen' };
		case 'issue.comment.create':
			return { scope: 'note', action: 'create' };
		case 'issue.comment.edit':
			return { scope: 'note', action: 'create' }; // note:update not exposed
		case 'issue.comment.delete':
			return { scope: 'note', action: 'delete' };
		case 'pr.create':
			return { scope: 'pr', action: 'create' };
		case 'pr.editContent':
			return { scope: 'pr', action: 'update' };
		case 'pr.changeState':
			return undefined; // resolved per-state (close vs reopen) by callers
		case 'pr.comment.create':
			return { scope: 'note', action: 'create' };
		case 'pr.comment.edit':
			return { scope: 'note', action: 'create' }; // note:update not exposed
		case 'pr.comment.delete':
			return { scope: 'note', action: 'delete' };
		case 'pr.comment.resolve':
			return { scope: 'note', action: 'resolve' };
		case 'pr.reviewers.update':
			return { scope: 'pr', action: 'update' };
		case 'pr.testers.update':
			return { scope: 'pr', action: 'update' };
		case 'pr.relatedIssues.update':
			return { scope: 'pr', action: 'update' };
		case 'branch.create':
			return { scope: 'branch', action: 'create' };
	}
}
