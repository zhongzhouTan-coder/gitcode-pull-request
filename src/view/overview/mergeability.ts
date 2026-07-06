import { PullRequestDetail } from '../../common/models';

export function getPullRequestMergeBlockedReason(detail: PullRequestDetail): string {
	if (detail.state === 'merged') {
		return 'This pull request has already been merged.';
	}

	if (detail.state === 'closed') {
		return 'Only open pull requests can be merged.';
	}

	const mergeability = detail.mergeability;

	if (mergeability.canMergeCheck === false) {
		return 'GitCode merge checks are blocking this pull request.';
	}

	if (mergeability.hasConflicts === true) {
		return 'This pull request has merge conflicts.';
	}

	if (mergeability.ciPassed === false) {
		return 'Required CI checks have not passed.';
	}

	if (mergeability.reviewPassed === false) {
		return 'Required reviews or approvals are not complete.';
	}

	if (mergeability.reasons.length > 0) {
		return mergeability.reasons[0];
	}

	if (!mergeability.mergeable) {
		return 'GitCode reports this pull request is not mergeable.';
	}

	return '';
}

export function isPullRequestMergeAllowed(detail: PullRequestDetail): boolean {
	return getPullRequestMergeBlockedReason(detail) === '';
}
