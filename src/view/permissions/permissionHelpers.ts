import {
	GitCodePermissionSnapshot,
	IssueOverviewPermissions,
	PullRequestOverviewPermissions,
	CreatePullRequestPermissions,
} from '../../common/models';

export function buildPullRequestOverviewPermissions(
	snapshot: GitCodePermissionSnapshot | undefined,
): PullRequestOverviewPermissions {
	if (!snapshot) {
		return {
			canEditPullRequest: false,
			canClosePullRequest: false,
			canReopenPullRequest: false,
			canCreateComment: false,
			canEditComment: false,
			canResolveComment: false,
			canUpdateReviewers: false,
			canUpdateRelatedIssues: false,
		};
	}

	return {
		canEditPullRequest: snapshot.has('pr', 'update'),
		canClosePullRequest: snapshot.has('pr', 'close'),
		canReopenPullRequest: snapshot.has('pr', 'reopen'),
		canCreateComment: snapshot.has('note', 'create'),
		canEditComment: snapshot.has('note', 'create'), // note:update is not exposed by API
		canResolveComment: snapshot.has('note', 'resolve'),
		canUpdateReviewers: snapshot.has('pr', 'update'),
		canUpdateRelatedIssues: snapshot.has('pr', 'update'),
	};
}

export function buildUnknownPullRequestOverviewPermissions(): PullRequestOverviewPermissions {
	return {
		canEditPullRequest: true,
		canClosePullRequest: true,
		canReopenPullRequest: true,
		canCreateComment: true,
		canEditComment: true,
		canResolveComment: true,
		canUpdateReviewers: true,
		canUpdateRelatedIssues: true,
	};
}

export function buildIssueOverviewPermissions(
	snapshot: GitCodePermissionSnapshot | undefined,
): IssueOverviewPermissions {
	if (!snapshot) {
		return {
			canEditIssue: false,
			canCloseIssue: false,
			canReopenIssue: false,
			canCreateComment: false,
		};
	}

	return {
		canEditIssue: snapshot.has('issue', 'update'),
		canCloseIssue: snapshot.has('issue', 'reopen'),
		canReopenIssue: snapshot.has('issue', 'reopen'),
		canCreateComment: snapshot.has('note', 'create'),
	};
}

export function buildUnknownIssueOverviewPermissions(): IssueOverviewPermissions {
	return {
		canEditIssue: true,
		canCloseIssue: true,
		canReopenIssue: true,
		canCreateComment: true,
	};
}

export function buildCreatePullRequestPermissions(
	snapshot: GitCodePermissionSnapshot | undefined,
): CreatePullRequestPermissions {
	if (!snapshot) {
		return {
			canCreatePullRequest: false,
			canCreateBranch: false,
		};
	}

	return {
		canCreatePullRequest: snapshot.has('pr', 'create'),
		canCreateBranch: snapshot.has('branch', 'create'),
	};
}
