/**
 * Centralized resource-ownership rules.
 *
 * Ownership rules are object-level exceptions that allow a resource creator
 * to perform specific operations on their own object (issue, pull request,
 * comment) even when the repository action permission is not granted.
 *
 * These rules are always operation-specific. They must not become broad bypasses.
 */

/**
 * Normalizes two logins for case-insensitive comparison.
 * Returns true only when both values are non-empty and match.
 */
export function isSameLogin(left: string | undefined, right: string | undefined): boolean {
	const normalizedLeft = left?.trim().toLowerCase();
	const normalizedRight = right?.trim().toLowerCase();
	return Boolean(normalizedLeft)
		&& Boolean(normalizedRight)
		&& normalizedLeft === normalizedRight;
}

/** Issue creator may edit their own issue title and body. */
export function canEditOwnIssue(
	currentUserLogin: string | undefined,
	issueAuthorLogin: string | undefined,
): boolean {
	return isSameLogin(currentUserLogin, issueAuthorLogin);
}

/** Issue creator may close or reopen their own issue. */
export function canChangeOwnIssueState(
	currentUserLogin: string | undefined,
	issueAuthorLogin: string | undefined,
): boolean {
	return isSameLogin(currentUserLogin, issueAuthorLogin);
}

/** Pull request creator may edit their own PR title, body, and draft status. */
export function canEditOwnPullRequest(
	currentUserLogin: string | undefined,
	prAuthorLogin: string | undefined,
): boolean {
	return isSameLogin(currentUserLogin, prAuthorLogin);
}

/** Pull request creator may close or reopen their own PR. */
export function canChangeOwnPullRequestState(
	currentUserLogin: string | undefined,
	prAuthorLogin: string | undefined,
): boolean {
	return isSameLogin(currentUserLogin, prAuthorLogin);
}

/** Comment author may edit their own comment. */
export function canEditOwnComment(
	currentUserLogin: string | undefined,
	commentAuthorLogin: string | undefined,
): boolean {
	return isSameLogin(currentUserLogin, commentAuthorLogin);
}

/** Comment author may delete their own comment. */
export function canDeleteOwnComment(
	currentUserLogin: string | undefined,
	commentAuthorLogin: string | undefined,
): boolean {
	return isSameLogin(currentUserLogin, commentAuthorLogin);
}
