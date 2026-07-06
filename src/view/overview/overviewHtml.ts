import {
	EditPullRequestOptions,
	IssueLabel,
	PullRequestComment,
	PullRequestCommentReply,
	PullRequestCommentsSnapshot,
	PullRequestDetail,
	PullRequestDiffComment,
	PullRequestGeneralComment,
	PullRequestLabel,
	PullRequestOperationLog,
	PullRequestOperationLogsSnapshot,
	PullRequestOverviewPermissions,
	PullRequestParticipant,
	PullRequestRelatedIssue,
	PullRequestRelatedIssuesSnapshot,
} from '../../common/models';
import { DiffCommentContext } from './diffCommentContext';
import { getPullRequestMergeBlockedReason, isPullRequestMergeAllowed } from './mergeability';
import { renderMarkdown } from '../webview/markdown';

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll('\'', '&#39;');
}

function escapeAttr(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function serializeForInlineScript(value: unknown): string {
	return JSON.stringify(value)
		.replaceAll('<', '\\u003C')
		.replaceAll('>', '\\u003E')
		.replaceAll('&', '\\u0026')
		.replaceAll('\u2028', '\\u2028')
		.replaceAll('\u2029', '\\u2029');
}

function formatDate(value: string | undefined): string {
	if (!value) {
		return 'None';
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function labelColor(color: string | undefined): string {
	if (!color) {
		return '#d0d7de';
	}

	return color.startsWith('#') ? color : `#${color}`;
}

/** Derive a consistent hue from a login string for SVG avatar backgrounds. */
function avatarColor(login: string): string {
	let hash = 0;
	for (let i = 0; i < login.length; i++) {
		hash = login.charCodeAt(i) + ((hash << 5) - hash);
	}
	const hue = Math.abs(hash) % 360;
	return `hsl(${hue}, 50%, 48%)`;
}

/** Generate an inline SVG avatar circle with the user's initial. */
function renderSvgAvatar(login: string, name?: string, size: number = 24): string {
	const initial = (name || login)[0]?.toUpperCase() || '?';
	const color = avatarColor(login);
	const half = Math.round(size / 2);
	const fontSize = Math.round(size * 0.45);
	return `<svg class="avatar-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
		<circle cx="${half}" cy="${half}" r="${half}" fill="${color}"/>
		<text x="${half}" y="${half}" text-anchor="middle" dy=".35em" fill="white" font-size="${fontSize}" font-weight="600" font-family="var(--vscode-font-family, sans-serif)">${escapeHtml(initial)}</text>
	</svg>`;
}

/** External-link icon (16×16). */
const EXTERNAL_LINK_ICON = `<svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
	<path d="M3 2v11h11V8.5h1V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h4.5v1H3Zm5.5 0V1H15v6.5h-1V2.7L7.9 8.9l-.8-.8L13.3 2H8.5Z" fill="currentColor"/>
</svg>`;

/** Compact pencil/edit icon for section editing. */
const PENCIL_ICON = `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
	<path d="M11.01 1.427a1.75 1.75 0 0 1 2.475 0l1.088 1.088a1.75 1.75 0 0 1 0 2.475l-8.5 8.5a1.75 1.75 0 0 1-.78.448l-3.08.88a.75.75 0 0 1-.927-.927l.88-3.08a1.75 1.75 0 0 1 .448-.78l8.5-8.5Zm1.414 1.06a.25.25 0 0 0-.353 0l-1.057 1.056 1.44 1.44 1.056-1.057a.25.25 0 0 0 0-.353l-1.086-1.086Zm-2.47 2.117L3.675 10.88a.25.25 0 0 0-.064.112l-.533 1.866 1.866-.533a.25.25 0 0 0 .112-.064l6.278-6.278-1.44-1.44Z"/>
</svg>`;

function renderParticipantIdentity(participant: PullRequestParticipant, interactive: boolean): string {
	const avatar = renderSvgAvatar(participant.login, participant.name);
	const displayName = participant.name && participant.name !== participant.login
		? `${escapeHtml(participant.name)} <span class="muted">@${escapeHtml(participant.login)}</span>`
		: `@${escapeHtml(participant.login)}`;

	if (interactive && participant.htmlUrl) {
		return `<button class="participant-btn" data-action="openUrl" data-url="${escapeHtml(participant.htmlUrl)}" title="${escapeHtml(participant.login)}">
			${avatar}
			<span class="participant-name">${displayName}</span>
		</button>`;
	}

	return `<span class="participant-row">
		${avatar}
		<span class="participant-name">${displayName}</span>
	</span>`;
}

function renderParticipants(participants: PullRequestParticipant[]): string {
	if (!participants.length) {
		return '<div class="empty">None</div>';
	}

	return `<div class="participant-list">${participants.map((participant) => renderParticipantIdentity(participant, true)).join('')}</div>`;
}

export interface ReviewersSectionOptions {
	canAddReviewer: boolean;
	reviewerMutationInProgress?: boolean;
	addReviewerInProgress?: boolean;
	canRemoveReviewer?: boolean;
	removeReviewerInProgress?: boolean;
	removingReviewerLogins?: readonly string[];
}

function renderAddReviewerButton(options?: ReviewersSectionOptions): string {
	if (!options) {
		return '';
	}

	const disabled = !options.canAddReviewer || options.reviewerMutationInProgress || options.addReviewerInProgress || options.removeReviewerInProgress ? 'disabled' : '';
	const title = options.canAddReviewer
		? 'Add reviewer'
		: 'You do not have permission to update reviewers.';
	const loadingIndicator = options.addReviewerInProgress
		? '<span class="spinner" aria-hidden="true"></span>'
		: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7.25 2.5h1.5v4.75h4.75v1.5H8.75v4.75h-1.5V8.75H2.5v-1.5h4.75V2.5Z"/></svg>';
	const titleAttr = options.canAddReviewer ? `title="${escapeAttr(title)}"` : '';
	const button = `<button class="icon-button add-reviewer-btn" data-action="addReviewer" aria-label="${escapeAttr(title)}" ${titleAttr} ${disabled}>${loadingIndicator}</button>`;

	return options.canAddReviewer
		? button
		: `<span class="permission-tooltip-target" data-tooltip="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" tabindex="0">${button}</span>`;
}

function renderReviewerRow(reviewer: PullRequestParticipant, options?: ReviewersSectionOptions): string {
	const canRemoveReviewer = options?.canRemoveReviewer ?? false;
	const isRemoving = Boolean(options?.removeReviewerInProgress && options.removingReviewerLogins?.includes(reviewer.login));
	const title = canRemoveReviewer
		? 'Remove reviewer'
		: 'You do not have permission to update reviewers.';
	const titleAttr = canRemoveReviewer ? ` title="${escapeAttr(title)}"` : '';
	const disabled = !canRemoveReviewer || options?.reviewerMutationInProgress || options?.addReviewerInProgress || options?.removeReviewerInProgress ? 'disabled' : '';
	const removeButtonMarkup = `<button class="icon-button remove-reviewer-btn" data-action="removeReviewer" data-login="${escapeAttr(reviewer.login)}" aria-label="${escapeAttr(title)}"${titleAttr} ${disabled}>${isRemoving ? '<span class="spinner" aria-hidden="true"></span>' : '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 7.25h10v1.5H3v-1.5Z"/></svg>'}</button>`;
	const removeButton = options
		? canRemoveReviewer
			? removeButtonMarkup
			: `<span class="permission-tooltip-target" data-tooltip="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" tabindex="0">${removeButtonMarkup}</span>`
		: '';

	return `<div class="participant-item">
		${renderParticipantIdentity(reviewer, true)}
		${removeButton}
	</div>`;
}

function renderReviewers(reviewers: PullRequestParticipant[], options?: ReviewersSectionOptions): string {
	if (!reviewers.length) {
		return '<div class="empty">None</div>';
	}

	return `<div class="participant-list">${reviewers.map((reviewer) => renderReviewerRow(reviewer, options)).join('')}</div>`;
}

// ---- Testers ----

export interface TestersSectionOptions {
	canAddTester: boolean;
	testerMutationInProgress?: boolean;
	addTesterInProgress?: boolean;
	canRemoveTester?: boolean;
	removeTesterInProgress?: boolean;
	removingTesterLogins?: readonly string[];
}

function renderAddTesterButton(options?: TestersSectionOptions): string {
	if (!options) {
		return '';
	}

	const disabled = !options.canAddTester || options.testerMutationInProgress || options.addTesterInProgress || options.removeTesterInProgress ? 'disabled' : '';
	const title = options.canAddTester
		? 'Add tester'
		: 'You do not have permission to update testers.';
	const loadingIndicator = options.addTesterInProgress
		? '<span class="spinner" aria-hidden="true"></span>'
		: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7.25 2.5h1.5v4.75h4.75v1.5H8.75v4.75h-1.5V8.75H2.5v-1.5h4.75V2.5Z"/></svg>';
	const titleAttr = options.canAddTester ? `title="${escapeAttr(title)}"` : '';
	const button = `<button class="icon-button add-tester-btn" data-action="addTester" aria-label="${escapeAttr(title)}" ${titleAttr} ${disabled}>${loadingIndicator}</button>`;

	return options.canAddTester
		? button
		: `<span class="permission-tooltip-target" data-tooltip="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" tabindex="0">${button}</span>`;
}

function renderTesterRow(tester: PullRequestParticipant, options?: TestersSectionOptions): string {
	const canRemoveTester = options?.canRemoveTester ?? false;
	const isRemoving = Boolean(options?.removeTesterInProgress && options.removingTesterLogins?.includes(tester.login));
	const title = canRemoveTester
		? 'Remove tester'
		: 'You do not have permission to update testers.';
	const titleAttr = canRemoveTester ? ` title="${escapeAttr(title)}"` : '';
	const disabled = !canRemoveTester || options?.testerMutationInProgress || options?.addTesterInProgress || options?.removeTesterInProgress ? 'disabled' : '';
	const removeButtonMarkup = `<button class="icon-button remove-tester-btn" data-action="removeTester" data-login="${escapeAttr(tester.login)}" aria-label="${escapeAttr(title)}"${titleAttr} ${disabled}>${isRemoving ? '<span class="spinner" aria-hidden="true"></span>' : '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 7.25h10v1.5H3v-1.5Z"/></svg>'}</button>`;
	const removeButton = options
		? canRemoveTester
			? removeButtonMarkup
			: `<span class="permission-tooltip-target" data-tooltip="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" tabindex="0">${removeButtonMarkup}</span>`
		: '';

	return `<div class="participant-item">
		${renderParticipantIdentity(tester, true)}
		${removeButton}
	</div>`;
}

function renderTesters(testers: PullRequestParticipant[], options?: TestersSectionOptions): string {
	if (!testers.length) {
		return '<div class="empty">None</div>';
	}

	return `<div class="participant-list">${testers.map((tester) => renderTesterRow(tester, options)).join('')}</div>`;
}

// ---- Assignees ----

export interface AssigneesSectionOptions {
	canAddAssignee: boolean;
	assigneeMutationInProgress?: boolean;
	addAssigneeInProgress?: boolean;
	canRemoveAssignee?: boolean;
	removeAssigneeInProgress?: boolean;
	removingAssigneeLogins?: readonly string[];
}

function renderAddAssigneeButton(options?: AssigneesSectionOptions): string {
	if (!options) {
		return '';
	}

	const disabled = !options.canAddAssignee || options.assigneeMutationInProgress || options.addAssigneeInProgress || options.removeAssigneeInProgress ? 'disabled' : '';
	const title = options.canAddAssignee
		? 'Add approver'
		: 'You do not have permission to update approvers.';
	const loadingIndicator = options.addAssigneeInProgress
		? '<span class="spinner" aria-hidden="true"></span>'
		: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7.25 2.5h1.5v4.75h4.75v1.5H8.75v4.75h-1.5V8.75H2.5v-1.5h4.75V2.5Z"/></svg>';
	const titleAttr = options.canAddAssignee ? `title="${escapeAttr(title)}"` : '';
	const button = `<button class="icon-button add-assignee-btn" data-action="addAssignee" aria-label="${escapeAttr(title)}" ${titleAttr} ${disabled}>${loadingIndicator}</button>`;

	return options.canAddAssignee
		? button
		: `<span class="permission-tooltip-target" data-tooltip="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" tabindex="0">${button}</span>`;
}

function renderAssigneeRow(assignee: PullRequestParticipant, options?: AssigneesSectionOptions): string {
	const canRemoveAssignee = options?.canRemoveAssignee ?? false;
	const isRemoving = Boolean(options?.removeAssigneeInProgress && options.removingAssigneeLogins?.includes(assignee.login));
	const title = canRemoveAssignee
		? 'Remove approver'
		: 'You do not have permission to update approvers.';
	const titleAttr = canRemoveAssignee ? ` title="${escapeAttr(title)}"` : '';
	const disabled = !canRemoveAssignee || options?.assigneeMutationInProgress || options?.addAssigneeInProgress || options?.removeAssigneeInProgress ? 'disabled' : '';
	const removeButtonMarkup = `<button class="icon-button remove-assignee-btn" data-action="removeAssignee" data-login="${escapeAttr(assignee.login)}" aria-label="${escapeAttr(title)}"${titleAttr} ${disabled}>${isRemoving ? '<span class="spinner" aria-hidden="true"></span>' : '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 7.25h10v1.5H3v-1.5Z"/></svg>'}</button>`;
	const removeButton = options
		? canRemoveAssignee
			? removeButtonMarkup
			: `<span class="permission-tooltip-target" data-tooltip="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" tabindex="0">${removeButtonMarkup}</span>`
		: '';

	return `<div class="participant-item">
		${renderParticipantIdentity(assignee, true)}
		${removeButton}
	</div>`;
}

function renderAssignees(assignees: PullRequestParticipant[], options?: AssigneesSectionOptions): string {
	if (!assignees.length) {
		return '<div class="empty">None</div>';
	}

	return `<div class="participant-list">${assignees.map((assignee) => renderAssigneeRow(assignee, options)).join('')}</div>`;
}

function renderLabels(labels: PullRequestLabel[]): string {
	if (!labels.length) {
		return '<div class="empty">None</div>';
	}

	return `<div class="labels">${labels.map((label) => (
		`<span class="label-chip" style="--label-color:${escapeHtml(labelColor(label.color))}">${escapeHtml(label.name)}</span>`
	)).join('')}</div>`;
}

function renderStatusCheck(label: string, value: string, state: 'pass' | 'fail' | 'unknown'): string {
	return `<div class="status-check status-check-${state}">
		<span class="status-check-mark" aria-hidden="true">${state === 'pass' ? 'OK' : state === 'fail' ? '!' : '-'}</span>
		<span class="status-check-copy">
			<span class="status-check-label">${escapeHtml(label)}</span>
			<span class="status-check-value">${escapeHtml(value)}</span>
		</span>
	</div>`;
}

function renderStatus(detail: PullRequestDetail): string {
	const mergeability = detail.mergeability;
	const blocked = !mergeability.mergeable
		|| mergeability.canMergeCheck === false
		|| mergeability.hasConflicts === true
		|| mergeability.ciPassed === false
		|| mergeability.reviewPassed === false
		|| mergeability.reasons.length > 0;
	const statusTone = blocked ? 'blocked' : 'ready';
	const statusTitle = blocked ? 'Merge blocked' : 'Ready to merge';
	const statusDescription = blocked
		? 'Resolve blockers before merging.'
		: 'Available checks are clear.';
	const checks: string[] = [
		renderStatusCheck('Mergeability', mergeability.mergeable ? 'Mergeable' : 'Not mergeable', mergeability.mergeable ? 'pass' : 'fail'),
	];

	if (detail.mergeability.canMergeCheck !== undefined) {
		checks.push(renderStatusCheck('Merge check', mergeability.canMergeCheck ? 'Ready' : 'Blocked', mergeability.canMergeCheck ? 'pass' : 'fail'));
	}
	if (detail.mergeability.hasConflicts !== undefined) {
		checks.push(renderStatusCheck('Conflicts', mergeability.hasConflicts ? 'Detected' : 'None', mergeability.hasConflicts ? 'fail' : 'pass'));
	}
	if (detail.mergeability.ciPassed !== undefined) {
		checks.push(renderStatusCheck('CI', mergeability.ciPassed ? 'Passed' : 'Pending / failed', mergeability.ciPassed ? 'pass' : 'fail'));
	}
	if (detail.mergeability.reviewPassed !== undefined) {
		checks.push(renderStatusCheck('Review', mergeability.reviewPassed ? 'Passed' : 'Pending / blocked', mergeability.reviewPassed ? 'pass' : 'fail'));
	}

	const reasons = mergeability.reasons.length
		? `<div class="status-reasons" aria-label="Merge restriction reasons">
			<div class="status-reasons-title">Needs attention</div>
			<ul>${mergeability.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
		</div>`
		: '';

	return `<div class="status-card status-card-${statusTone}">
		<div class="status-hero">
			<div class="status-orb" aria-hidden="true">${blocked ? '!' : 'OK'}</div>
			<div class="status-hero-copy">
				<div class="status-title">${statusTitle}</div>
				<div class="status-description">${statusDescription}</div>
			</div>
		</div>
		<div class="status-check-grid">${checks.join('')}</div>
		${reasons}
	</div>`;
}

function stateLabel(detail: PullRequestDetail): string {
	switch (detail.state) {
		case 'merged':
			return 'Merged';
		case 'closed':
			return 'Closed';
		default:
			return 'Open';
	}
}

function renderInlineAuthors(authors: { login: string; name?: string }[]): string {
	return authors.map((a) => {
		if (a.name && a.name !== a.login) {
			return `${escapeHtml(a.name)} <span class="muted">@${escapeHtml(a.login)}</span>`;
		}
		return `@${escapeHtml(a.login)}`;
	}).join(', ');
}

function hasEditedMarker(comment: { createdAt: string; updatedAt: string }): boolean {
	return comment.createdAt !== comment.updatedAt;
}

function renderDiffCommentLocation(comment: PullRequestDiffComment): string {
	const parts: string[] = ['Code comment'];
	if (comment.location.path) {
		parts.push(`<button class="comment-file comment-file-link" data-action="openDiffComment" data-path="${escapeAttr(comment.location.path)}" data-line="${comment.location.startLine}" title="Open diff at line ${comment.location.startLine}">${escapeHtml(comment.location.path)}</button>`);
	}
	parts.push(`line ${comment.location.startLine}`);
	if (comment.location.endLine !== comment.location.startLine) {
		parts.push(`-${comment.location.endLine}`);
	}
	return parts.join(' · ');
}

function renderDiffCommentReviewStatus(comment: PullRequestDiffComment): string {
	const checked = comment.resolved ? 'checked' : '';
	const currentStatus = comment.resolved ? 'Resolved' : 'Unresolved';
	const targetStatus = comment.resolved ? 'Unresolved' : 'Resolved';
	const label = `Mark discussion as ${targetStatus.toLowerCase()}`;
	return `<div class="comment-review-status" aria-label="Review status: ${currentStatus}">
		<label class="comment-toggle" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
			<span class="comment-toggle-label">Review status</span>
			<input type="checkbox" class="comment-toggle-input" data-action="revisePullRequestCommentStatus" data-discussion-id="${escapeHtml(comment.discussionId)}" data-resolved="${!comment.resolved}" ${checked}>
			<span class="comment-toggle-slider"></span>
			<span class="comment-toggle-state">${currentStatus}</span>
		</label>
	</div>`;
}

function renderDiffCommentBadges(comment: PullRequestDiffComment): string {
	if (!comment.isOutdated) {
		return '';
	}

	return '<span class="badge badge-outdated">Outdated</span>';
}

function renderCommentAvatar(author: PullRequestComment['author']): string {
	if (author.avatarUrl) {
		try {
			const url = new URL(author.avatarUrl);
			if (url.protocol === 'https:') {
				return `<img class="comment-avatar" src="${escapeHtml(author.avatarUrl)}" alt="${escapeHtml(author.login)}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'avatar-initials\\'>${escapeHtml((author.name || author.login)[0]?.toUpperCase() || '?')}</span>'">`;
			}
		} catch {
			// Fall through to initials for malformed API data.
		}
	}
	const initial = (author.name || author.login)[0]?.toUpperCase() || '?';
	return `<span class="avatar-initials">${escapeHtml(initial)}</span>`;
}

function renderCommentBody(body: string): string {
	return renderMarkdown(body);
}

function renderConversationReplies(replies: PullRequestCommentReply[]): string {
	if (!replies.length) {
		return '';
	}

	return replies.map((reply) => `
		<div class="comment-reply">
			<div class="comment-header">
				${renderCommentAvatar(reply.author)}
				<span class="comment-author">${renderInlineAuthors([reply.author])}</span>
				<span class="comment-time">${escapeHtml(formatDate(reply.createdAt))}</span>
				${hasEditedMarker(reply) ? '<span class="edited-marker">edited</span>' : ''}
			</div>
			<div class="comment-body">${renderCommentBody(reply.body)}</div>
		</div>
	`).join('');
}

function renderReplyAction(discussionId: string): string {
	return `<button class="reply-action-btn" data-discussion-id="${escapeAttr(discussionId)}" title="Reply to this discussion" aria-label="Reply to this discussion">Reply</button>`;
}

function renderReplyComposer(discussionId: string): string {
	return `<div class="reply-composer" data-reply-composer="${escapeAttr(discussionId)}" style="display:none">
		<textarea class="reply-input" data-reply-input="${escapeAttr(discussionId)}" placeholder="Write a reply..." rows="3"></textarea>
		<div class="reply-actions">
			<button class="btn-primary btn-submit-reply" data-discussion-id="${escapeAttr(discussionId)}" disabled>Reply</button>
			<button class="btn-secondary btn-cancel-reply" data-discussion-id="${escapeAttr(discussionId)}">Cancel</button>
			<span class="reply-saving" data-reply-saving="${escapeAttr(discussionId)}" style="display:none">Submitting...</span>
		</div>
		<div class="reply-error" data-reply-error="${escapeAttr(discussionId)}" style="display:none"></div>
	</div>`;
}

function renderConversationComment(comment: PullRequestComment, diffContexts?: ReadonlyMap<string, DiffCommentContext>): string {
	if (comment.kind === 'pullRequest') {
		return renderGeneralCommentCard(comment);
	}
	return renderDiffCommentCard(comment, diffContexts?.get(comment.id));
}

function renderCommentEditIcon(commentId: string): string {
	return `<button class="edit-icon-btn edit-comment-btn" data-comment-id="${escapeAttr(commentId)}" title="Edit comment" aria-label="Edit comment">${PENCIL_ICON}</button>`;
}

function renderCommentEditArea(commentId: string, body: string): string {
	return `<div class="comment-edit-area" data-comment-edit="${escapeAttr(commentId)}" style="display:none">
		<textarea data-comment-input="${escapeAttr(commentId)}" class="comment-edit-input" rows="4">${escapeHtml(body)}</textarea>
		<div class="comment-edit-actions">
			<button class="btn-primary btn-save-comment-edit" data-comment-id="${escapeAttr(commentId)}">Save</button>
			<button class="btn-secondary btn-cancel-comment-edit" data-comment-id="${escapeAttr(commentId)}">Cancel</button>
			<span class="comment-edit-saving" style="display:none">Saving...</span>
		</div>
		<div class="comment-edit-error" style="display:none" data-comment-edit-error="${escapeAttr(commentId)}"></div>
	</div>`;
}

function renderGeneralCommentCard(comment: PullRequestGeneralComment): string {
	return `
		<div class="comment-card" data-comment-id="${escapeAttr(comment.id)}">
			<div class="comment-top-row">
				<div class="comment-header">
					${renderCommentAvatar(comment.author)}
					<span class="comment-author">${renderInlineAuthors([comment.author])}</span>
					<span class="comment-time">${escapeHtml(formatDate(comment.createdAt))}</span>
					${hasEditedMarker(comment) ? '<span class="edited-marker">edited</span>' : ''}
					${renderCommentEditIcon(comment.id)}
				</div>
				<div class="comment-top-actions">
					${renderReplyAction(comment.discussionId)}
				</div>
			</div>
			<div class="comment-body">${renderCommentBody(comment.body)}</div>
			${renderCommentEditArea(comment.id, comment.body)}
			${renderConversationReplies(comment.replies)}
			${renderReplyComposer(comment.discussionId)}
		</div>
	`;
}

function renderDiffContext(context: DiffCommentContext | undefined): string {
	if (!context?.lines.length) {
		return '';
	}

	return `<div class="comment-diff" aria-label="Diff context">
		${context.lines.map((line) => {
		const oldLine = line.oldLine === undefined ? '' : String(line.oldLine);
		const newLine = line.newLine === undefined ? '' : String(line.newLine);
		const marker = line.kind === 'add' ? '+' : line.kind === 'delete' ? '-' : ' ';
		const highlightClass = line.isCommentLine ? ' comment-diff-row-comment' : '';
		return `<div class="comment-diff-row comment-diff-row-${line.kind}${highlightClass}">
			<span class="comment-diff-line">${escapeHtml(oldLine)}</span>
			<span class="comment-diff-line">${escapeHtml(newLine)}</span>
			<span class="comment-diff-marker">${escapeHtml(marker)}</span>
			<code class="comment-diff-code">${escapeHtml(line.content)}</code>
		</div>`;
	}).join('')}
	</div>`;
}

function renderDiffCommentCard(comment: PullRequestDiffComment, diffContext?: DiffCommentContext): string {
	const badges = renderDiffCommentBadges(comment);
	return `
		<div class="comment-card comment-card-diff" data-comment-id="${escapeAttr(comment.id)}">
			<div class="comment-top-row">
				<div class="comment-header">
					${renderCommentAvatar(comment.author)}
					<span class="comment-author">${renderInlineAuthors([comment.author])}</span>
					<span class="comment-time">${escapeHtml(formatDate(comment.createdAt))}</span>
					${hasEditedMarker(comment) ? '<span class="edited-marker">edited</span>' : ''}
					${renderCommentEditIcon(comment.id)}
				</div>
				<div class="comment-top-actions">
					${renderDiffCommentReviewStatus(comment)}
					${renderReplyAction(comment.discussionId)}
				</div>
			</div>
			<div class="comment-meta">
				<span class="comment-location">${renderDiffCommentLocation(comment)}</span>
				${badges}
			</div>
			${renderDiffContext(diffContext)}
			<div class="comment-body">${renderCommentBody(comment.body)}</div>
			${renderCommentEditArea(comment.id, comment.body)}
			${renderConversationReplies(comment.replies)}
			${renderReplyComposer(comment.discussionId)}
		</div>
	`;
}

function renderStateActionButton(detail: PullRequestDetail): string {
	const stateAction = detail.state === 'open' ? 'closed' : 'open';
	const stateActionLabel = detail.state === 'open' ? 'Close pull request' : 'Reopen pull request';
	const stateActionDisabled = detail.state === 'merged' ? 'disabled' : '';
	return `<button id="state-action-button" type="button" class="secondary" data-state-action="${stateAction}" ${stateActionDisabled}>${stateActionLabel}</button>`;
}

function getMergeDisabledReason(detail: PullRequestDetail): string {
	return getPullRequestMergeBlockedReason(detail);
}

function isMergeAllowedByChecks(detail: PullRequestDetail): boolean {
	return isPullRequestMergeAllowed(detail);
}

function renderMergeButton(detail: PullRequestDetail): string {
	const checksAllowMerge = isMergeAllowedByChecks(detail);
	const openState = detail.state === 'open';
	const disabledReason = getMergeDisabledReason(detail);
	const disabled = !openState || !checksAllowMerge ? 'disabled' : '';
	const label = 'Merge pull request';
	return `<button id="merge-action-button" type="button" class="primary" data-action="mergePullRequest" ${disabled} data-merge-disabled-reason="${escapeAttr(disabledReason)}">${label}</button>`;
}

function renderConversationComposer(detail: PullRequestDetail): string {
	return `
		<div class="conversation-composer">
			<label class="composer-label" for="conversation-comment-input">Write a comment</label>
			<textarea id="conversation-comment-input" class="conversation-input" placeholder="Write a comment..."></textarea>
			<div class="conversation-action-row">
				<div class="main-state-actions">
					${renderStateActionButton(detail)}
					${renderMergeButton(detail)}
				</div>
				<div class="conversation-actions">
					<button id="conversation-comment-submit" type="button">Comment</button>
				</div>
			</div>
			<div class="conversation-action-feedback">
				<div id="state-action-error" class="action-error conversation-state-error"></div>
				<div id="conversation-comment-error" class="comment-error conversation-error" aria-live="polite"></div>
			</div>
		</div>
	`;
}

function renderConversationSection(
	detail: PullRequestDetail,
	snapshot: PullRequestCommentsSnapshot,
	diffContexts?: ReadonlyMap<string, DiffCommentContext>,
): string {
	const comments = [...snapshot.comments].sort((a, b) => {
		return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
	});

	if (!comments.length) {
		return `<section><h2>Conversation</h2><div class="empty">No comments yet.</div>${renderConversationComposer(detail)}</section>`;
	}

	const countText = `${comments.length}`;
	return `
		<section>
			<h2>Conversation (${countText})</h2>
			<div class="conversation-list">
				${comments.map((c) => renderConversationComment(c, diffContexts)).join('')}
			</div>
			${renderConversationComposer(detail)}
		</section>
	`;
}

function renderConversationLoading(detail: PullRequestDetail): string {
	return `<section><h2>Conversation</h2><div class="empty">Loading comments...</div>${renderConversationComposer(detail)}</section>`;
}

function renderConversationError(detail: PullRequestDetail, message: string): string {
	return `<section><h2>Conversation</h2><div class="comment-error">${escapeHtml(message)}</div>${renderConversationComposer(detail)}</section>`;
}

interface TimelineRenderOptions {
	diffContexts?: ReadonlyMap<string, DiffCommentContext>;
	activityError?: string;
}

type TimelineEntry =
	| { kind: 'comment'; createdAt: string; comment: PullRequestComment }
	| { kind: 'activity'; createdAt: string; log: PullRequestOperationLog };

function timelineTime(value: string): number {
	const time = new Date(value).getTime();
	return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function renderTimelineActivityItem(log: PullRequestOperationLog): string {
	return `<div class="timeline-entry timeline-entry-activity">${renderActivityItem(log)}</div>`;
}

function renderTimelineCommentItem(comment: PullRequestComment, diffContexts?: ReadonlyMap<string, DiffCommentContext>): string {
	return `<div class="timeline-entry timeline-entry-comment">${renderConversationComment(comment, diffContexts)}</div>`;
}

export function renderTimelineSection(
	detail: PullRequestDetail,
	commentsSnapshot: PullRequestCommentsSnapshot,
	activitySnapshot?: PullRequestOperationLogsSnapshot,
	options: TimelineRenderOptions = {},
): string {
	const entries: TimelineEntry[] = [
		...commentsSnapshot.comments.map((comment): TimelineEntry => ({
			kind: 'comment',
			createdAt: comment.createdAt,
			comment,
		})),
		...(activitySnapshot?.logs ?? []).map((log): TimelineEntry => ({
			kind: 'activity',
			createdAt: log.createdAt,
			log,
		})),
	].sort((a, b) => timelineTime(a.createdAt) - timelineTime(b.createdAt));

	const activityErrorHtml = options.activityError
		? `<div class="comment-error timeline-error">${escapeHtml(options.activityError)}</div>`
		: '';

	if (!entries.length) {
		return `<section><h2>Timeline</h2><div class="empty">No timeline activity yet.</div>${activityErrorHtml}${renderConversationComposer(detail)}</section>`;
	}

	return `
		<section>
			<h2>Timeline (${entries.length})</h2>
			<div class="timeline-list">
				${entries.map((entry) => entry.kind === 'comment'
		? renderTimelineCommentItem(entry.comment, options.diffContexts)
		: renderTimelineActivityItem(entry.log)).join('')}
			</div>
			${activityErrorHtml}
			${renderConversationComposer(detail)}
		</section>
	`;
}

export function renderTimelineLoading(detail: PullRequestDetail): string {
	return `<section><h2>Timeline</h2><div class="empty">Loading timeline...</div>${renderConversationComposer(detail)}</section>`;
}

export function renderTimelineError(detail: PullRequestDetail, message: string, activitySnapshot?: PullRequestOperationLogsSnapshot, activityError?: string): string {
	const activityEntries = activitySnapshot?.logs.length
		? `<div class="timeline-list">${[...activitySnapshot.logs]
			.sort((a, b) => timelineTime(a.createdAt) - timelineTime(b.createdAt))
			.map(renderTimelineActivityItem)
			.join('')}</div>`
		: '';
	const activityErrorHtml = activityError
		? `<div class="comment-error timeline-error">${escapeHtml(activityError)}</div>`
		: '';

	return `<section><h2>Timeline</h2><div class="comment-error">${escapeHtml(message)}</div>${activityEntries}${activityErrorHtml}${renderConversationComposer(detail)}</section>`;
}

// ---- Related Issues Rendering ----

function renderIssueLabels(labels: IssueLabel[]): string {
	if (!labels.length) {
		return '';
	}

	return `<div class="labels">${labels.map((label) => (
		`<span class="label-chip" style="--label-color:${escapeHtml(labelColor(label.color))}">${escapeHtml(label.name)}</span>`
	)).join('')}</div>`;
}

export interface RelatedIssuesSectionOptions {
	canAddRelatedIssue: boolean;
	addRelatedIssueInProgress?: boolean;
	canRemoveRelatedIssue?: boolean;
	removeRelatedIssueInProgress?: boolean;
	removingRelatedIssueNumbers?: readonly number[];
}

function renderRelatedIssueRow(issue: PullRequestRelatedIssue, options?: RelatedIssuesSectionOptions): string {
	const stateClass = issue.state === 'closed' ? 'closed' : 'open';
	const repositoryName = issue.repository?.fullName ?? '';

	const metaParts: string[] = [];
	metaParts.push(`<span class="issue-state issue-state-${stateClass}"><span class="issue-state-dot" aria-hidden="true"></span>${issue.state === 'closed' ? 'Closed' : 'Open'}</span>`);
	if (issue.author.login) {
		metaParts.push(`<span class="issue-meta-chip">@${escapeHtml(issue.author.login)}</span>`);
	}
	if (issue.issueType) {
		metaParts.push(`<span class="issue-meta-chip">${escapeHtml(issue.issueType)}</span>`);
	}
	if (issue.issueState) {
		metaParts.push(`<span class="issue-meta-chip">${escapeHtml(issue.issueState)}</span>`);
	}
	if (repositoryName) {
		metaParts.push(`<span class="issue-meta-chip">${escapeHtml(repositoryName)}</span>`);
	}
	metaParts.push(`<span class="issue-meta-time">Updated ${escapeHtml(formatDate(issue.updatedAt))}</span>`);

	const titleHtml = issue.url
		? `<button class="issue-title-btn" data-action="openIssue" data-repository="${escapeHtml(repositoryName)}" data-issue="${issue.number}" data-url="${escapeHtml(issue.url ?? '')}">#${issue.number} ${escapeHtml(issue.title)}</button>`
		: `<span class="issue-title">#${issue.number} ${escapeHtml(issue.title)}</span>`;

	const externalLink = issue.url
		? `<button class="external-link-btn" data-action="openUrl" data-url="${escapeHtml(issue.url)}" title="Open on GitCode">${EXTERNAL_LINK_ICON}</button>`
		: '';

	const isRemoving = options?.removeRelatedIssueInProgress && options.removingRelatedIssueNumbers?.includes(issue.number);
	const canRemoveRelatedIssue = options?.canRemoveRelatedIssue ?? false;
	const removeBtnDisabled = !canRemoveRelatedIssue || options?.removeRelatedIssueInProgress ? 'disabled' : '';
	const removeButtonTitle = canRemoveRelatedIssue
		? 'Unlink related issue'
		: 'You do not have permission to unlink related issues.';
	const removeButtonTitleAttr = canRemoveRelatedIssue ? ` title="${escapeAttr(removeButtonTitle)}"` : '';
	const removeButtonMarkup = `<button class="icon-button remove-related-issue-btn" data-action="removeRelatedIssue" data-issue="${issue.number}" aria-label="${escapeAttr(removeButtonTitle)}"${removeButtonTitleAttr} ${removeBtnDisabled}>${isRemoving ? '<span class="spinner" aria-hidden="true"></span>' : '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.85 2.15 13.85 13.15l-.7.7-2.44-2.44-.86.86a3 3 0 0 1-4.24-4.24l.89-.88.7.7-.88.89a2 2 0 0 0 2.82 2.82l.86-.85-2.12-2.12-.68.68-.7-.7.68-.69L2.15 2.85l.7-.7Zm7.54 5.8-.71-.7.68-.68a2 2 0 0 0-2.83-2.83l-.84.84-.7-.71.84-.84a3 3 0 0 1 4.24 4.24l-.68.68Zm2.2 1.13-.7-.7.88-.88.7.7-.88.88Z"/></svg>'}</button>`;
	const removeButton = options
		? canRemoveRelatedIssue
			? removeButtonMarkup
			: `<span class="permission-tooltip-target" data-tooltip="${escapeAttr(removeButtonTitle)}" aria-label="${escapeAttr(removeButtonTitle)}" tabindex="0">${removeButtonMarkup}</span>`
		: '';

	return `
		<div class="related-issue-row related-issue-${stateClass}">
			<div class="related-issue-rail" aria-hidden="true"></div>
			<div class="related-issue-main">
				<div class="related-issue-title-row">
					${titleHtml}
					${externalLink}
					${removeButton}
				</div>
				<div class="related-issue-meta">
					${metaParts.join('')}
				</div>
				${renderIssueLabels(issue.labels)}
			</div>
		</div>
	`;
}

export function renderRelatedIssuesSection(snapshot: PullRequestRelatedIssuesSnapshot, options?: RelatedIssuesSectionOptions): string {
	const issues = snapshot.issues;
	const addButtonHtml = renderAddRelatedIssueButton(options);

	if (!issues.length) {
		return `<section><div class="section-heading-row"><h2>Related Issues</h2>${addButtonHtml}</div><div class="empty">No related issues.</div></section>`;
	}

	const countText = `${issues.length}`;
	return `
		<section>
			<div class="section-heading-row">
				<h2>Related Issues (${countText})</h2>
				${addButtonHtml}
			</div>
			<div class="related-issues-list">
				${issues.map((issue) => renderRelatedIssueRow(issue, options)).join('')}
			</div>
		</section>
	`;
}

function renderAddRelatedIssueButton(options?: RelatedIssuesSectionOptions): string {
	if (!options) {
		return '';
	}

	const disabled = !options.canAddRelatedIssue || options.addRelatedIssueInProgress ? 'disabled' : '';
	const title = options.canAddRelatedIssue
		? 'Add related issue'
		: 'You do not have permission to add related issues.';
	const loadingIndicator = options.addRelatedIssueInProgress
		? '<span class="spinner" aria-hidden="true"></span>'
		: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 0 0-3.882 9.394l-.707.707A6.5 6.5 0 1 1 8 14.5v-1a5.5 5.5 0 0 0 0-11ZM8 5.5v5h1v-5H8Z"/></svg>';

	const titleAttr = options.canAddRelatedIssue ? `title="${escapeAttr(title)}"` : '';
	const button = `<button
		class="icon-button add-related-issue-btn"
		data-action="addRelatedIssue"
		aria-label="${escapeAttr(title)}"
		${titleAttr}
		${disabled}
	>${loadingIndicator}</button>`;

	return options.canAddRelatedIssue
		? button
		: `<span class="permission-tooltip-target" data-tooltip="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" tabindex="0">${button}</span>`;
}

export function renderRelatedIssuesLoading(options?: RelatedIssuesSectionOptions): string {
	const addButtonHtml = renderAddRelatedIssueButton(options);
	return `<section><div class="section-heading-row"><h2>Related Issues</h2>${addButtonHtml}</div><div class="empty">Loading related issues...</div></section>`;
}

export function renderRelatedIssuesError(message: string, options?: RelatedIssuesSectionOptions): string {
	const addButtonHtml = renderAddRelatedIssueButton(options);
	return `<section><div class="section-heading-row"><h2>Related Issues</h2>${addButtonHtml}</div><div class="comment-error">${escapeHtml(message)}</div></section>`;
}

// ---- Activity / Operation Logs Rendering ----

function renderActivityActor(actor: PullRequestOperationLog['actor']): string {
	const displayName = actor.name && actor.name !== actor.login
		? `${escapeHtml(actor.name)} <span class="muted">@${escapeHtml(actor.login)}</span>`
		: `@${escapeHtml(actor.login)}`;

	if (actor.htmlUrl) {
		return `<button class="activity-actor-btn" data-action="openUrl" data-url="${escapeHtml(actor.htmlUrl)}" title="${escapeHtml(actor.login)}">
			${renderSvgAvatar(actor.login, actor.name)}
			<span class="activity-actor-name">${displayName}</span>
		</button>`;
	}

	return `<span class="activity-actor-row">
		${renderSvgAvatar(actor.login, actor.name)}
		<span class="activity-actor-name">${displayName}</span>
	</span>`;
}

function renderActivityBadge(actionType: string): string {
	const label = escapeHtml(actionType);
	return `<span class="activity-badge activity-badge-${escapeHtml(actionType.toLowerCase())}">${label}</span>`;
}

function renderActivityTime(createdAt: string): string {
	if (!createdAt) {
		return '<span class="activity-time">Unknown time</span>';
	}

	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) {
		return `<span class="activity-time">${escapeHtml(createdAt)}</span>`;
	}

	return `<span class="activity-time">${escapeHtml(formatDate(createdAt))}</span>`;
}

function renderActivityItem(log: PullRequestOperationLog): string {
	return `
		<div class="activity-item">
			<div class="activity-meta">
				${renderActivityActor(log.actor)}
				${renderActivityTime(log.createdAt)}
			</div>
			<div class="activity-content">
				${renderActivityBadge(log.actionType)}
				<span class="activity-text">${escapeHtml(log.content)}</span>
			</div>
		</div>
	`;
}

export function renderActivitySection(snapshot: PullRequestOperationLogsSnapshot): string {
	const logs = snapshot.logs;

	if (!logs.length) {
		return '<section><h2>Activity</h2><div class="empty">No activity yet.</div></section>';
	}

	const countText = `${logs.length}`;
	return `
		<section>
			<h2>Activity (${countText})</h2>
			<div class="activity-list">
				${logs.map((log) => renderActivityItem(log)).join('')}
			</div>
		</section>
	`;
}

export function renderActivityLoading(): string {
	return '<section><h2>Activity</h2><div class="empty">Loading activity...</div></section>';
}

export function renderActivityError(message: string): string {
	return `<section><h2>Activity</h2><div class="comment-error">${escapeHtml(message)}</div></section>`;
}

export function getOverviewHtml(
	detail: PullRequestDetail,
	nonce: string,
	conversationHtml?: string,
	relatedIssuesHtml?: string,
	editOptions?: EditPullRequestOptions,
	includeScripts: boolean = true,
	activityHtml?: string,
	permissions?: PullRequestOverviewPermissions,
	reviewerOptions?: ReviewersSectionOptions,
	testerOptions?: TestersSectionOptions,
	assigneeOptions?: AssigneesSectionOptions,
): string {
	const descriptionHtml = renderMarkdown(detail.body);
	const draftBadge = detail.isDraft ? '<span class="badge badge-draft">Draft</span>' : '';
	const openOnWebDisabled = detail.htmlUrl ? '' : 'disabled';
	const conversationSection = conversationHtml ?? '';
	const relatedIssuesSection = relatedIssuesHtml ?? '';
	const activitySection = activityHtml ?? '';

	const editOptionsJson = editOptions
		? serializeForInlineScript({
			labels: editOptions.labels.map((label) => ({
				id: label.id,
				name: label.name,
				color: label.color,
			})),
			milestones: editOptions.milestones.map((milestone) => ({
				number: milestone.number,
				title: milestone.title,
				state: milestone.state,
				dueOn: milestone.dueOn,
				url: milestone.url,
			})),
		})
		: 'null';
	const permissionsJson = permissions
		? serializeForInlineScript(permissions)
		: 'null';
	const detailSnapshotJson = serializeForInlineScript({
		title: detail.title,
		body: detail.body,
		state: detail.state === 'closed' ? 'closed' : 'open',
		draft: detail.isDraft,
		pruneBranch: Boolean(detail.pruneBranch),
		squashMerge: Boolean(detail.squashMerge),
		closeRelatedIssue: Boolean(detail.closeRelatedIssue),
		labels: detail.labels,
		milestone: detail.milestone ?? null,
	});
	const currentTitleJson = serializeForInlineScript(detail.title);

	const milestoneText = detail.milestone
		? escapeHtml(detail.milestone.title)
		: '<span class="muted">None</span>';

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Pull Request #${detail.number}</title>
	<style>
		:root {
			color-scheme: light dark;
			--border: var(--vscode-panel-border, #30363d);
			--muted: var(--vscode-descriptionForeground, #8b949e);
			--badge-open: #1f883d;
			--badge-closed: #cf222e;
			--badge-merged: #8250df;
			--badge-draft: #6e7781;
			--card: var(--vscode-sideBar-background, rgba(127,127,127,0.08));
			--success: var(--vscode-testing-iconPassed, #1f883d);
			--danger: var(--vscode-testing-iconFailed, #cf222e);
			--warning: var(--vscode-editorWarning-foreground, #9a6700);
		}
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			margin: 0;
			padding: 24px;
			background: var(--vscode-editor-background);
		}
		a { color: var(--vscode-textLink-foreground); }
		.layout { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(260px, 1fr); gap: 24px; }
		.header { margin-bottom: 24px; }
		.title-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 8px; }
		.title-row h1 { font-size: 24px; margin: 0; }
		.meta-row { color: var(--muted); display: flex; flex-wrap: wrap; gap: 12px; }
		.badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: white; }
		.badge-open { background: var(--badge-open); }
		.badge-closed { background: var(--badge-closed); }
		.badge-merged { background: var(--badge-merged); }
		.badge-draft { background: var(--badge-draft); }
		.actions { margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
		.main-state-actions {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 8px;
			flex: 0 0 auto;
		}
		.action-error { margin-top: 8px; color: var(--vscode-errorForeground); font-size: 13px; min-height: 18px; }
		button {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			border: 1px solid var(--border);
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			padding: 8px 14px;
			border-radius: 6px;
			cursor: pointer;
		}
		.btn-icon {
			flex-shrink: 0;
		}
		button.secondary {
			background: transparent;
			color: var(--vscode-foreground);
		}
		button.danger {
			border-color: color-mix(in srgb, var(--danger) 65%, var(--border));
			background: color-mix(in srgb, var(--danger) 18%, var(--vscode-button-background));
			color: var(--vscode-button-foreground);
		}
		button.danger:hover:not(:disabled),
		button.danger:focus-visible:not(:disabled) {
			background: color-mix(in srgb, var(--danger) 30%, var(--vscode-button-background));
		}
		button:disabled { opacity: 0.5; cursor: not-allowed; }
		section, aside .card {
			border: 1px solid var(--border);
			border-radius: 10px;
			padding: 16px;
			background: var(--card);
		}
		section + section, aside .card + .card { margin-top: 16px; }
		h2 { margin-top: 0; font-size: 16px; }
		.description { overflow-wrap: anywhere; }
		.description pre {
			overflow-x: auto;
			padding: 12px;
			border-radius: 8px;
			background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.12));
		}
		.description table {
			width: 100%;
			border-collapse: collapse;
			display: block;
			overflow-x: auto;
		}
		.description th,
		.description td {
			border: 1px solid var(--border);
			padding: 8px 10px;
			text-align: left;
			vertical-align: top;
		}
		.description th {
			background: color-mix(in srgb, var(--card) 75%, transparent);
		}
		.description img {
			max-width: 100%;
			height: auto;
			border-radius: 8px;
			display: block;
			margin: 12px 0;
		}
		.description code {
			font-family: var(--vscode-editor-font-family);
			font-size: 0.95em;
		}
		.meta-group + .meta-group { margin-top: 16px; }
		.meta-group h3 { margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
		.preference-list {
			display: flex;
			flex-direction: column;
			gap: 14px;
		}
		.preference-row {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			gap: 8px;
			align-items: start;
			cursor: pointer;
		}
		.preference-row input {
			margin: 3px 0 0;
		}
		.preference-copy {
			display: flex;
			flex-direction: column;
			gap: 2px;
			min-width: 0;
		}
		.preference-title {
			font-weight: 600;
			font-size: 13px;
		}
		.preference-description {
			color: var(--muted);
			font-size: 12px;
			line-height: 1.4;
		}
		.preference-status {
			min-height: 18px;
			margin-left: 22px;
		}
		.meta-list { margin: 0; padding-left: 18px; }
		.meta-list li { margin: 4px 0; }
		.branch-flow {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.branch-row,
		.timestamp-row {
			display: grid;
			grid-template-columns: 58px minmax(0, 1fr);
			gap: 10px;
			align-items: start;
		}
		.branch-label,
		.timestamp-label {
			color: var(--muted);
			font-size: 11px;
			font-weight: 700;
			letter-spacing: 0.04em;
			text-transform: uppercase;
			padding-top: 2px;
		}
		.branch-chip {
			display: flex;
			flex-direction: column;
			gap: 2px;
			min-width: 0;
			padding: 7px 9px;
			border: 1px solid var(--border);
			border-radius: 8px;
			background: color-mix(in srgb, var(--card) 88%, var(--vscode-editor-background, transparent));
		}
		.branch-ref {
			font-family: var(--vscode-editor-font-family);
			font-size: 12px;
			font-weight: 650;
			overflow-wrap: anywhere;
		}
		.branch-repo {
			color: var(--muted);
			font-size: 11px;
			overflow-wrap: anywhere;
		}
		.branch-arrow {
			width: 1px;
			height: 10px;
			margin-left: 28px;
			background: var(--border);
		}
		.timestamp-list {
			display: flex;
			flex-direction: column;
			gap: 7px;
		}
		.timestamp-value {
			font-size: 12px;
			overflow-wrap: anywhere;
		}
		.timestamp-value.missing {
			color: var(--muted);
		}
		.labels { display: flex; flex-wrap: wrap; gap: 8px; }
		.label-chip {
			display: inline-flex;
			align-items: center;
			padding: 4px 10px;
			border-radius: 999px;
			background: color-mix(in srgb, var(--label-color) 18%, transparent);
			border: 1px solid color-mix(in srgb, var(--label-color) 45%, transparent);
		}
		/* ---- Participants ---- */
		.participant-list {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}
		.participant-item {
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 0;
		}
		.participant-btn,
		.participant-row {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 2px 0;
			min-width: 0;
		}
		.participant-btn {
			border: none;
			background: none;
			color: inherit;
			font: inherit;
			cursor: pointer;
			text-align: left;
			width: 100%;
			flex: 1;
			border-radius: 6px;
			padding: 4px 6px;
			margin: -2px -6px;
		}
		.participant-row {
			flex: 1;
		}
		.participant-btn:hover {
			background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 12%, transparent);
		}
		.avatar-svg {
			flex-shrink: 0;
			border-radius: 50%;
		}
		.participant-name {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.status-card {
			position: relative;
			overflow: hidden;
			border: 1px solid var(--border);
			border-radius: 10px;
			background: color-mix(in srgb, var(--card) 94%, var(--vscode-editor-background, transparent));
		}
		.status-card-ready { --status-color: var(--success); }
		.status-card-blocked { --status-color: var(--danger); }
		.status-hero {
			display: flex;
			align-items: flex-start;
			gap: 10px;
			padding: 12px;
		}
		.status-orb {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 28px;
			height: 28px;
			border-radius: 999px;
			background: color-mix(in srgb, var(--status-color) 8%, transparent);
			border: 1px solid color-mix(in srgb, var(--status-color) 24%, var(--border));
			color: var(--status-color);
			font-size: 10px;
			font-weight: 800;
			letter-spacing: 0.02em;
			flex: 0 0 auto;
		}
		.status-hero-copy {
			min-width: 0;
		}
		.status-title {
			font-size: 14px;
			font-weight: 700;
			line-height: 1.3;
		}
		.status-description {
			color: var(--muted);
			margin-top: 2px;
			font-size: 12px;
		}
		.status-check-grid {
			display: grid;
			grid-template-columns: 1fr;
			gap: 6px;
			padding: 0 12px 12px;
		}
		.status-check {
			display: flex;
			align-items: flex-start;
			gap: 8px;
			min-width: 0;
			padding: 7px 8px;
			border: 1px solid color-mix(in srgb, var(--check-color) 12%, var(--border));
			border-radius: 8px;
			background: transparent;
		}
		.status-check-pass { --check-color: var(--success); }
		.status-check-fail { --check-color: var(--danger); }
		.status-check-unknown { --check-color: var(--warning); }
		.status-check-mark {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 18px;
			height: 18px;
			border-radius: 999px;
			background: color-mix(in srgb, var(--check-color) 7%, transparent);
			color: var(--check-color);
			font-size: 9px;
			font-weight: 800;
			line-height: 1;
		}
		.status-check-copy {
			display: flex;
			flex-direction: column;
			gap: 1px;
			min-width: 0;
		}
		.status-check-label {
			color: var(--muted);
			font-size: 11px;
		}
		.status-check-value {
			font-weight: 650;
			font-size: 12px;
			overflow-wrap: anywhere;
		}
		.status-reasons {
			margin: 0 12px 12px;
			padding: 9px 10px;
			border: 1px solid color-mix(in srgb, var(--danger) 14%, var(--border));
			border-radius: 8px;
			background: transparent;
		}
		.status-reasons-title {
			margin-bottom: 4px;
			color: var(--danger);
			font-weight: 700;
			font-size: 12px;
		}
		.status-reasons ul {
			margin: 0;
			padding-left: 18px;
		}
		.status-reasons li {
			margin: 3px 0;
			font-size: 12px;
		}
		.muted, .empty { color: var(--muted); }
		/* ---- Activity / Operation Logs ---- */
		.activity-list {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}
		.activity-item {
			display: flex;
			flex-direction: column;
			gap: 2px;
			padding: 8px 0;
			border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
		}
		.activity-item:last-child {
			border-bottom: none;
		}
		.activity-meta {
			display: flex;
			align-items: center;
			gap: 8px;
			flex-wrap: wrap;
		}
		.activity-actor-btn,
		.activity-actor-row {
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.activity-actor-btn {
			border: none;
			background: none;
			color: inherit;
			font: inherit;
			cursor: pointer;
			text-align: left;
			border-radius: 4px;
			padding: 2px 4px;
			margin: -2px -4px;
		}
		.activity-actor-btn:hover {
			background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 12%, transparent);
		}
		.activity-actor-name {
			font-weight: 600;
			font-size: 13px;
		}
		.activity-time {
			color: var(--muted);
			font-size: 12px;
		}
		.activity-content {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-left: 32px;
		}
		.activity-badge {
			display: inline-flex;
			align-items: center;
			border-radius: 999px;
			padding: 2px 8px;
			font-size: 11px;
			font-weight: 600;
			text-transform: lowercase;
			background: color-mix(in srgb, var(--vscode-descriptionForeground, #8b949e) 14%, transparent);
			color: var(--vscode-descriptionForeground, #8b949e);
			flex-shrink: 0;
		}
		.activity-badge-opened,
		.activity-badge-reopened {
			background: color-mix(in srgb, var(--badge-open) 14%, transparent);
			color: var(--badge-open);
		}
		.activity-badge-closed,
		.activity-badge-merged {
			background: color-mix(in srgb, var(--badge-closed) 14%, transparent);
			color: var(--badge-closed);
		}
		.activity-text {
			font-size: 13px;
			overflow-wrap: anywhere;
		}
		.timeline-list {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}
		.timeline-entry-activity {
			padding-left: 8px;
			border-left: 2px solid color-mix(in srgb, var(--border) 65%, transparent);
		}
		.timeline-entry-activity .activity-item {
			border-bottom: none;
			padding: 6px 0;
		}
		.timeline-error {
			margin-top: 12px;
		}
		/* ---- Conversation / Comments ---- */
		.conversation-composer {
			display: flex;
			flex-direction: column;
			gap: 10px;
			margin-top: 16px;
		}
		.composer-label {
			font-size: 12px;
			font-weight: 600;
			color: var(--muted);
		}
		.conversation-input {
			min-height: 88px;
			resize: vertical;
			font: inherit;
			color: inherit;
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border, var(--border));
			border-radius: 8px;
			padding: 10px 12px;
		}
		.conversation-input:focus {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: 1px;
		}
		.conversation-action-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			flex-wrap: wrap;
		}
		.conversation-actions {
			display: flex;
			justify-content: flex-end;
			margin-left: auto;
		}
		.conversation-action-feedback {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 12px;
			flex-wrap: wrap;
		}
		.conversation-state-error {
			flex: 1 1 260px;
			margin: 0;
		}
		.conversation-error {
			flex: 1 1 260px;
			min-height: 18px;
			margin: 0;
			text-align: right;
		}
		.conversation-list { display: flex; flex-direction: column; gap: 16px; }
		.comment-card {
			border: 1px solid var(--border);
			border-radius: 10px;
			padding: 16px;
			background: var(--card);
		}
		.comment-card-diff {
			border-left: 4px solid var(--vscode-textLink-foreground, #58a6ff);
		}
		.comment-top-row {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 12px;
			margin-bottom: 10px;
		}
		.comment-header {
			display: flex;
			align-items: center;
			gap: 10px;
			flex-wrap: wrap;
			min-width: 0;
		}
		.comment-avatar {
			width: 28px;
			height: 28px;
			border-radius: 50%;
			object-fit: cover;
		}
		.avatar-initials {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 28px;
			border-radius: 50%;
			background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 30%, transparent);
			font-size: 13px;
			font-weight: 600;
		}
		.comment-author { font-weight: 600; }
		.comment-time { color: var(--muted); font-size: 13px; }
		.edited-marker { color: var(--muted); font-size: 12px; font-style: italic; }
		.comment-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			align-items: center;
			font-size: 13px;
			color: var(--muted);
			margin-bottom: 10px;
		}
		.comment-file {
			font-family: var(--vscode-editor-font-family);
			font-size: 13px;
		}
		.comment-file-link {
			display: inline;
			border: 0;
			border-radius: 3px;
			padding: 0 2px;
			background: transparent;
			color: var(--vscode-textLink-foreground);
			cursor: pointer;
		}
		.comment-file-link:hover {
			text-decoration: underline;
		}
		.comment-location { color: var(--muted); }
		.comment-diff {
			margin: 8px 0 12px;
			border: 1px solid var(--border);
			border-radius: 6px;
			overflow: auto;
			background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.10));
			font-family: var(--vscode-editor-font-family);
			font-size: 12px;
		}
		.comment-diff-row {
			display: grid;
			grid-template-columns: 48px 48px 18px minmax(0, 1fr);
			min-width: max-content;
		}
		.comment-diff-row-add {
			background: color-mix(in srgb, var(--success) 10%, transparent);
		}
		.comment-diff-row-delete {
			background: color-mix(in srgb, var(--danger) 9%, transparent);
		}
		.comment-diff-row-comment {
			box-shadow: inset 3px 0 var(--vscode-editorInfo-foreground, #3794ff);
			background: color-mix(in srgb, var(--vscode-editorInfo-foreground, #3794ff) 14%, transparent);
		}
		.comment-diff-line,
		.comment-diff-marker {
			color: var(--muted);
			user-select: none;
			text-align: right;
			padding: 2px 6px;
			border-right: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		}
		.comment-diff-marker {
			text-align: center;
		}
		.comment-diff-code {
			padding: 2px 8px;
			white-space: pre;
			color: var(--vscode-editor-foreground, var(--vscode-foreground));
			background: transparent;
		}
		/* ---- Inline Comment Editing ---- */
		.edit-comment-btn {
			opacity: 0;
			transition: opacity 0.15s, background 0.15s;
			margin-left: auto;
		}
		.comment-card:hover .edit-comment-btn,
		.comment-card:focus-within .edit-comment-btn,
		.edit-comment-btn:focus-visible {
			opacity: 1;
		}
		.comment-edit-area {
			margin-top: 12px;
			padding-top: 12px;
			border-top: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		}
		.comment-edit-input {
			width: 100%;
			box-sizing: border-box;
			min-height: 88px;
			resize: vertical;
			font: inherit;
			color: inherit;
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border, var(--border));
			border-radius: 8px;
			padding: 10px 12px;
		}
		.comment-edit-input:focus {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: 1px;
		}
		.comment-edit-actions {
			display: flex;
			gap: 8px;
			margin-top: 10px;
			align-items: center;
		}
		.comment-edit-saving {
			color: var(--muted);
			font-size: 13px;
			font-style: italic;
		}
		.comment-edit-error {
			color: var(--vscode-errorForeground);
			font-size: 13px;
			margin-top: 8px;
		}
		.comment-review-status {
			display: inline-flex;
			align-items: center;
			flex: 0 0 auto;
			padding-top: 5px;
			font-size: 13px;
			white-space: nowrap;
		}
		.comment-toggle {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			cursor: pointer;
			user-select: none;
		}
		.comment-toggle-label {
			color: var(--muted);
			font-size: 12px;
		}
		.comment-toggle-input {
			position: absolute;
			opacity: 0;
			width: 0;
			height: 0;
			pointer-events: none;
		}
		.comment-toggle-slider {
			position: relative;
			width: 32px;
			height: 18px;
			flex-shrink: 0;
			border-radius: 999px;
			background: var(--vscode-input-border, #30363d);
			transition: background .18s ease;
		}
		.comment-toggle-slider::after {
			content: '';
			position: absolute;
			top: 2px;
			left: 2px;
			width: 14px;
			height: 14px;
			border-radius: 999px;
			background: var(--vscode-editor-background);
			transition: transform .18s ease;
		}
		.comment-toggle-input:checked + .comment-toggle-slider {
			background: var(--vscode-textLink-foreground, #58a6ff);
		}
		.comment-toggle-input:checked + .comment-toggle-slider::after {
			transform: translateX(14px);
		}
		.comment-toggle-input:disabled + .comment-toggle-slider {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.comment-toggle-state {
			font-weight: 600;
			font-size: 12px;
			min-width: 72px;
			color: var(--vscode-foreground);
		}
		.comment-toggle-error {
			color: var(--vscode-errorForeground);
			font-size: 11px;
			margin-left: 4px;
		}
		@media (max-width: 720px) {
			.comment-top-row {
				flex-direction: column;
				gap: 4px;
			}
			.comment-review-status {
				padding-top: 0;
				white-space: normal;
			}
			.comment-toggle-label {
				display: none;
			}
		}
		.badge-outdated {
			background: var(--badge-draft);
			color: white;
		}
		.comment-body {
			overflow-wrap: anywhere;
		}
		.comment-body pre {
			overflow-x: auto;
			padding: 10px;
			border-radius: 8px;
			background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.12));
		}
		.comment-body code {
			font-family: var(--vscode-editor-font-family);
			font-size: 0.95em;
		}
		.comment-body table {
			width: 100%;
			border-collapse: collapse;
			display: block;
			overflow-x: auto;
		}
		.comment-body th,
		.comment-body td {
			border: 1px solid var(--border);
			padding: 6px 8px;
			text-align: left;
			vertical-align: top;
		}
		.comment-body img {
			max-width: 100%;
			height: auto;
			border-radius: 8px;
		}
		.comment-reply {
			border-top: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
			margin-top: 12px;
			padding-top: 12px;
		}
		/* ---- Reply Composer ---- */
		.comment-top-actions {
			display: flex;
			align-items: center;
			gap: 12px;
			flex-shrink: 0;
		}
		.reply-action-btn {
			border: 1px solid var(--border);
			border-radius: 6px;
			padding: 2px 10px;
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			cursor: pointer;
			font-size: 12px;
			line-height: 1.5;
		}
		.reply-action-btn:hover:not(:disabled) {
			background: var(--vscode-button-secondaryHoverBackground);
		}
		.reply-action-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.reply-composer {
			margin-top: 12px;
			padding-top: 12px;
			border-top: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		}
		.reply-input {
			width: 100%;
			box-sizing: border-box;
			min-height: 72px;
			resize: vertical;
			font: inherit;
			color: inherit;
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border, var(--border));
			border-radius: 8px;
			padding: 10px 12px;
		}
		.reply-input:focus {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: 1px;
		}
		.reply-actions {
			display: flex;
			gap: 8px;
			margin-top: 10px;
			align-items: center;
		}
		.reply-saving {
			color: var(--muted);
			font-size: 13px;
			font-style: italic;
		}
		.reply-error {
			color: var(--vscode-errorForeground);
			font-size: 13px;
			margin-top: 8px;
		}
		.comment-error { color: var(--vscode-errorForeground); padding: 8px 0; }
		/* ---- Related Issues ---- */
		.section-heading-row {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.section-heading-row h2 {
			flex: 1;
		}
		.section-heading-row h3 {
			flex: 1;
			margin: 0;
		}
		.icon-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border: 1px solid var(--border);
			background: transparent;
			color: var(--muted);
			padding: 4px;
			border-radius: 6px;
			cursor: pointer;
			flex-shrink: 0;
		}
		.icon-button:hover:not(:disabled) {
			color: var(--vscode-foreground);
			background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 10%, transparent);
		}
		.icon-button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.permission-tooltip-target {
			display: inline-flex;
			position: relative;
			cursor: not-allowed;
		}
		.permission-tooltip-target::after {
			content: attr(data-tooltip);
			position: absolute;
			z-index: 20;
			right: 0;
			bottom: calc(100% + 6px);
			display: none;
			width: max-content;
			max-width: 240px;
			padding: 6px 8px;
			border: 1px solid var(--border);
			border-radius: 6px;
			background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
			color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
			font-size: 12px;
			line-height: 1.35;
			white-space: normal;
			pointer-events: none;
		}
		.permission-tooltip-target:hover::after,
		.permission-tooltip-target:focus-visible::after {
			display: block;
		}
		.permission-tooltip-target :disabled {
			pointer-events: none;
		}
		.spinner {
			display: inline-block;
			width: 14px;
			height: 14px;
			border: 2px solid color-mix(in srgb, var(--muted) 30%, transparent);
			border-top-color: var(--muted);
			border-radius: 50%;
			animation: spin 0.6s linear infinite;
		}
		@keyframes spin {
			to { transform: rotate(360deg); }
		}
		.related-issues-list {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.related-issue-row {
			--issue-color: var(--success);
			display: grid;
			grid-template-columns: 3px minmax(0, 1fr);
			gap: 12px;
			border: 1px solid var(--border);
			border-radius: 9px;
			padding: 11px 12px 11px 0;
			background: color-mix(in srgb, var(--card) 90%, var(--vscode-editor-background, transparent));
		}
		.related-issue-closed {
			--issue-color: var(--badge-merged);
		}
		.related-issue-rail {
			border-radius: 999px;
			background: color-mix(in srgb, var(--issue-color) 62%, var(--border));
		}
		.related-issue-main {
			display: flex;
			flex-direction: column;
			gap: 7px;
			min-width: 0;
		}
		.related-issue-title-row {
			display: flex;
			align-items: flex-start;
			gap: 8px;
		}
		.issue-title-btn {
			border: none;
			background: none;
			color: var(--vscode-textLink-foreground);
			font: inherit;
			font-size: 14px;
			font-weight: 600;
			cursor: pointer;
			text-align: left;
			padding: 0;
			line-height: 1.4;
			flex: 1;
		}
		.issue-title-btn:hover {
			text-decoration: underline;
		}
		.issue-title {
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-foreground);
			flex: 1;
		}
		.external-link-btn {
			border: none;
			background: none;
			color: var(--muted);
			cursor: pointer;
			padding: 2px;
			flex-shrink: 0;
			opacity: 0.6;
		}
		.external-link-btn:hover {
			opacity: 1;
			color: var(--vscode-foreground);
		}
		.related-issue-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 5px;
			align-items: center;
			font-size: 11px;
			color: var(--muted);
		}
		.issue-state,
		.issue-meta-chip,
		.issue-meta-time {
			display: inline-flex;
			align-items: center;
			min-width: 0;
			border-radius: 999px;
			padding: 2px 7px;
			border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
			background: color-mix(in srgb, var(--card) 76%, transparent);
		}
		.issue-state {
			color: var(--issue-color);
			border-color: color-mix(in srgb, var(--issue-color) 18%, var(--border));
			background: transparent;
			font-weight: 650;
		}
		.issue-state-dot {
			width: 6px;
			height: 6px;
			margin-right: 5px;
			border-radius: 999px;
			background: currentColor;
		}
		.issue-meta-time {
			border-color: transparent;
			background: transparent;
			padding-left: 0;
			padding-right: 0;
		}
		@media (max-width: 900px) {
			.layout { grid-template-columns: 1fr; }
		}
		/* ---- Inline Section Editing ---- */
		.edit-icon-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 28px;
			background: transparent;
			color: var(--muted);
			cursor: pointer;
			opacity: 0.75;
			transition: opacity 0.15s, background 0.15s;
			flex-shrink: 0;
			padding: 0;
		}
		.edit-section-wrapper:hover .edit-icon-btn,
		.edit-section-wrapper:focus-within .edit-icon-btn,
		.edit-icon-btn:focus-visible {
			opacity: 1;
			color: var(--vscode-foreground);
		}
		.edit-icon-btn:hover,
		.edit-icon-btn:focus-visible {
			background: color-mix(in srgb, var(--vscode-foreground) 12%, transparent);
			color: var(--vscode-foreground);
		}
		.edit-section-wrapper {
			position: relative;
		}
		.edit-section-header {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.edit-section-header h2 {
			flex: 1;
			margin: 0;
		}
		.section-edit-area {
			margin-top: 12px;
		}
		.section-edit-area input[type="text"],
		.section-edit-area textarea,
		.section-edit-area select {
			width: 100%;
			box-sizing: border-box;
			padding: 6px 10px;
			border: 1px solid var(--border);
			border-radius: 6px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font-family: var(--vscode-font-family);
			font-size: 14px;
		}
		.section-edit-area textarea {
			min-height: 120px;
			resize: vertical;
			font-family: var(--vscode-editor-font-family, monospace);
		}
		.section-edit-area input:focus,
		.section-edit-area textarea:focus,
		.section-edit-area select:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}
		.section-edit-actions {
			display: flex;
			gap: 8px;
			margin-top: 10px;
		}
		.section-edit-error {
			color: var(--vscode-errorForeground);
			font-size: 13px;
			margin-bottom: 8px;
		}
		.section-edit-saving {
			color: var(--muted);
			font-size: 13px;
			font-style: italic;
		}
		.picker {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}
		.picker-options {
			max-height: 140px;
			overflow: auto;
			border: 1px solid var(--border);
			border-radius: 6px;
			background: var(--card);
		}
		.picker-options.hidden {
			display: none;
		}
		.picker-option {
			width: 100%;
			padding: 6px 8px;
			text-align: left;
			background: transparent;
			color: var(--vscode-foreground);
			border: none;
			border-radius: 0;
		}
		.picker-option:hover,
		.picker-option:focus-visible {
			background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.14));
			outline: none;
		}
		.picker-empty {
			padding: 8px;
			color: var(--muted);
			font-size: 13px;
		}
		.picker-selected {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			min-height: 32px;
			max-height: 112px;
			overflow-y: auto;
			padding: 4px;
			border: 1px solid var(--border);
			border-radius: 6px;
			background: var(--card);
		}
		.picker-chip {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			max-width: 100%;
			padding: 2px 6px;
			border: 1px solid var(--border);
			border-radius: 999px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
		}
		.picker-chip button {
			padding: 0 2px;
			background: transparent;
			color: var(--muted);
			border: none;
			font-size: 14px;
			line-height: 1;
		}
		.picker-chip button:hover,
		.picker-chip button:focus-visible {
			color: var(--vscode-foreground);
			outline: none;
		}
		.picker-hint {
			font-size: 12px;
			color: var(--muted);
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="title-row edit-section-wrapper">
			<span class="badge badge-${detail.state}">${stateLabel(detail)}</span>
			${draftBadge}
			<h1 class="section-view-title">${escapeHtml(detail.title)} <span class="muted">#${detail.number}</span></h1>
			<button class="edit-icon-btn" data-section="title" title="Edit title" aria-label="Edit title">${PENCIL_ICON}</button>
		</div>
		<div class="section-edit-area" data-section-edit="title" style="display:none">
			<input type="text" data-section-input="title" value="${escapeAttr(detail.title)}" maxlength="255">
			<div class="section-edit-actions">
				<button class="btn-primary btn-save-section" data-section="title">Save</button>
				<button class="btn-secondary btn-cancel-section" data-section="title">Cancel</button>
				<span class="section-edit-saving" style="display:none">Saving...</span>
			</div>
			<div class="section-edit-error" style="display:none"></div>
		</div>
		<div class="meta-row">
			<span>@${escapeHtml(detail.author.login)}</span>
			<span>${escapeHtml(detail.source.ref)} -> ${escapeHtml(detail.target.ref)}</span>
			<span>Updated ${escapeHtml(formatDate(detail.updatedAt))}</span>
		</div>
		<div class="actions">
			<button id="refresh-button" class="secondary" title="Refresh" aria-label="Refresh pull request">Refresh</button>
			<button id="open-web-button" class="secondary" ${openOnWebDisabled}>${EXTERNAL_LINK_ICON} Open on GitCode</button>
		</div>
	</div>
	<div class="layout">
		<main>
			<section class="edit-section-wrapper">
				<div class="edit-section-header">
					<h2>Description</h2>
					<button class="edit-icon-btn" data-section="body" title="Edit description" aria-label="Edit description">${PENCIL_ICON}</button>
				</div>
				<div class="description section-view-body">${descriptionHtml}</div>
				<div class="section-edit-area" data-section-edit="body" style="display:none">
					<textarea data-section-input="body" rows="8">${escapeHtml(detail.body)}</textarea>
					<div class="section-edit-actions">
						<button class="btn-primary btn-save-section" data-section="body">Save</button>
						<button class="btn-secondary btn-cancel-section" data-section="body">Cancel</button>
						<span class="section-edit-saving" style="display:none">Saving...</span>
					</div>
					<div class="section-edit-error" style="display:none"></div>
				</div>
			</section>
			${relatedIssuesSection}
			${conversationSection}
			${activitySection}
		</main>
		<aside>
			<div class="card status-summary-card">
				<h3>Status Summary</h3>
				${renderStatus(detail)}
			</div>
			<div class="card">
				<div class="meta-group">
					<div class="section-heading-row">
						<h3>Reviewers</h3>
						${renderAddReviewerButton(reviewerOptions)}
					</div>
					${renderReviewers(detail.reviewers, reviewerOptions)}
				</div>
				<div class="meta-group">
					<div class="section-heading-row">
						<h3>Approvers</h3>
						${renderAddAssigneeButton(assigneeOptions)}
					</div>
					${renderAssignees(detail.assignees, assigneeOptions)}
				</div>
				<div class="meta-group">
					<div class="section-heading-row">
						<h3>Testers</h3>
						${renderAddTesterButton(testerOptions)}
					</div>
					${renderTesters(detail.testers, testerOptions)}
				</div>
			</div>
			<div class="card edit-section-wrapper">
				<div class="edit-section-header">
					<h3>Labels</h3>
					<button class="edit-icon-btn" data-section="labels" title="Edit labels" aria-label="Edit labels">${PENCIL_ICON}</button>
				</div>
				<div class="section-view-labels">${renderLabels(detail.labels)}</div>
				<div class="section-edit-area" data-section-edit="labels" style="display:none">
					<div class="picker">
						<input type="text" data-section-input="labels" placeholder="Search labels..." autocomplete="off">
						<div class="picker-options hidden" data-picker-options="labels"></div>
						<div class="picker-selected" data-picker-selected="labels"></div>
						<div class="picker-hint">Select labels from the repository label list.</div>
					</div>
					<div class="section-edit-actions">
						<button class="btn-primary btn-save-section" data-section="labels">Save</button>
						<button class="btn-secondary btn-cancel-section" data-section="labels">Cancel</button>
						<span class="section-edit-saving" style="display:none">Saving...</span>
					</div>
					<div class="section-edit-error" style="display:none"></div>
				</div>
			</div>
			<div class="card edit-section-wrapper">
				<div class="edit-section-header">
					<h3>Milestone</h3>
					<button class="edit-icon-btn" data-section="milestone" title="Edit milestone" aria-label="Edit milestone">${PENCIL_ICON}</button>
				</div>
				<div class="section-view-milestone">${milestoneText}</div>
				<div class="section-edit-area" data-section-edit="milestone" style="display:none">
					<select data-section-input="milestone">
						<option value="">No milestone</option>
					</select>
					<div class="section-edit-actions">
						<button class="btn-primary btn-save-section" data-section="milestone">Save</button>
						<button class="btn-secondary btn-cancel-section" data-section="milestone">Cancel</button>
						<span class="section-edit-saving" style="display:none">Saving...</span>
					</div>
					<div class="section-edit-error" style="display:none"></div>
				</div>
			</div>
			<div class="card preference-card">
				<div class="meta-group">
					<h3>Pull Request Options</h3>
					<div class="preference-list">
						<div class="preference-item" data-section-edit="draft">
							<label class="preference-row">
								<input type="checkbox" data-section-input="draft" ${detail.isDraft ? 'checked' : ''}>
								<span class="preference-copy">
									<span class="preference-title">Mark as draft</span>
									<span class="preference-description">Draft pull requests stay visible but are not ready for review.</span>
								</span>
							</label>
							<div class="preference-status">
								<span class="section-edit-saving" style="display:none">Saving...</span>
								<div class="section-edit-error" style="display:none"></div>
							</div>
						</div>
						<div class="preference-item" data-section-edit="pruneBranch">
							<label class="preference-row">
								<input type="checkbox" data-section-input="pruneBranch" ${detail.pruneBranch ? 'checked' : ''}>
								<span class="preference-copy">
									<span class="preference-title">Delete source branch after merge</span>
									<span class="preference-description">When enabled, GitCode deletes the source branch automatically after this pull request is merged.</span>
								</span>
							</label>
							<div class="preference-status">
								<span class="section-edit-saving" style="display:none">Saving...</span>
								<div class="section-edit-error" style="display:none"></div>
							</div>
						</div>
						<div class="preference-item" data-section-edit="squashMerge">
							<label class="preference-row">
								<input type="checkbox" data-section-input="squashMerge" ${detail.squashMerge ? 'checked' : ''}>
								<span class="preference-copy">
									<span class="preference-title">Squash commits on merge</span>
									<span class="preference-description">When enabled, GitCode merges this pull request as a single squashed commit.</span>
								</span>
							</label>
							<div class="preference-status">
								<span class="section-edit-saving" style="display:none">Saving...</span>
								<div class="section-edit-error" style="display:none"></div>
							</div>
						</div>
						<div class="preference-item" data-section-edit="closeRelatedIssue">
							<label class="preference-row">
								<input type="checkbox" data-section-input="closeRelatedIssue" ${detail.closeRelatedIssue ? 'checked' : ''}>
								<span class="preference-copy">
									<span class="preference-title">Close related issues after merge</span>
									<span class="preference-description">When enabled, linked issues are closed after this pull request is merged.</span>
								</span>
							</label>
							<div class="preference-status">
								<span class="section-edit-saving" style="display:none">Saving...</span>
								<div class="section-edit-error" style="display:none"></div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="card">
				<div class="meta-group">
					<h3>Branches</h3>
					<div class="branch-flow">
						<div class="branch-row">
							<div class="branch-label">From</div>
							<div class="branch-chip">
								<div class="branch-ref">${escapeHtml(detail.source.ref)}</div>
								<div class="branch-repo">${escapeHtml(detail.source.repositoryFullName ?? detail.source.label)}</div>
							</div>
						</div>
						<div class="branch-arrow" aria-hidden="true"></div>
						<div class="branch-row">
							<div class="branch-label">Into</div>
							<div class="branch-chip">
								<div class="branch-ref">${escapeHtml(detail.target.ref)}</div>
								<div class="branch-repo">${escapeHtml(detail.target.repositoryFullName ?? detail.target.label)}</div>
							</div>
						</div>
					</div>
				</div>
				<div class="meta-group">
					<h3>Timestamps</h3>
					<div class="timestamp-list">
						<div class="timestamp-row">
							<div class="timestamp-label">Created</div>
							<div class="timestamp-value">${escapeHtml(formatDate(detail.createdAt))}</div>
						</div>
						<div class="timestamp-row">
							<div class="timestamp-label">Updated</div>
							<div class="timestamp-value">${escapeHtml(formatDate(detail.updatedAt))}</div>
						</div>
						<div class="timestamp-row">
							<div class="timestamp-label">Closed</div>
							<div class="timestamp-value ${detail.closedAt ? '' : 'missing'}">${escapeHtml(formatDate(detail.closedAt))}</div>
						</div>
						<div class="timestamp-row">
							<div class="timestamp-label">Merged</div>
							<div class="timestamp-value ${detail.mergedAt ? '' : 'missing'}">${escapeHtml(formatDate(detail.mergedAt))}</div>
						</div>
					</div>
				</div>
			</div>
		</aside>
	</div>
	${includeScripts ? `<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const editOptions = ${editOptionsJson};
		const overviewPermissions = ${permissionsJson};
		const detailSnapshot = ${detailSnapshotJson};

		// Current pull request title (always sent with section saves per API contract)
		var currentTitle = ${currentTitleJson};
		var editingSection = null;
		var selectedLabels = [];
		var selectedMilestone = null;
		var pendingStateAction = null;
		var pendingConversationComment = false;

		function labelKey(label) {
			if (!label || typeof label !== 'object') {
				return '';
			}
			return String(label.id ?? label.name ?? '');
		}

		function milestoneKey(milestone) {
			if (!milestone || typeof milestone !== 'object') {
				return '';
			}
			return String(milestone.number ?? '');
		}

		function availableLabels() {
			return editOptions && Array.isArray(editOptions.labels) ? editOptions.labels : [];
		}

		function availableMilestones() {
			return editOptions && Array.isArray(editOptions.milestones) ? editOptions.milestones : [];
		}

		function escapeHtmlText(value) {
			return String(value ?? '')
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;')
				.replaceAll("'", '&#39;');
		}

		function escapeAttrText(value) {
			return String(value ?? '')
				.replaceAll('&', '&amp;')
				.replaceAll('"', '&quot;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;');
		}

		function normalizeLabelColor(color) {
			if (!color) {
				return '#d0d7de';
			}
			return String(color).startsWith('#') ? String(color) : '#' + String(color);
		}

		function initializeSelectionState() {
			selectedLabels = detailSnapshot.labels.map(function(currentLabel) {
				return availableLabels().find(function(option) {
					return option.id === currentLabel.id || option.name === currentLabel.name;
				}) || currentLabel;
			});

			selectedMilestone = detailSnapshot.milestone
				? availableMilestones().find(function(option) {
					return option.number === detailSnapshot.milestone.number;
				}) || detailSnapshot.milestone
				: null;
		}

		function resetSectionState(section) {
			if (section === 'title') {
				const titleInput = document.querySelector('[data-section-input="title"]');
				if (titleInput) {
					titleInput.value = detailSnapshot.title || '';
				}
				return;
			}

			if (section === 'body') {
				const bodyInput = document.querySelector('[data-section-input="body"]');
				if (bodyInput) {
					bodyInput.value = detailSnapshot.body || '';
				}
				return;
			}

			if (section === 'draft') {
				const draftInput = document.querySelector('[data-section-input="draft"]');
				if (draftInput) {
					draftInput.checked = Boolean(detailSnapshot.draft);
				}
				return;
			}

			if (section === 'pruneBranch') {
				const pruneBranchInput = document.querySelector('[data-section-input="pruneBranch"]');
				if (pruneBranchInput) {
					pruneBranchInput.checked = Boolean(detailSnapshot.pruneBranch);
				}
				return;
			}

			if (section === 'squashMerge') {
				const squashMergeInput = document.querySelector('[data-section-input="squashMerge"]');
				if (squashMergeInput) {
					squashMergeInput.checked = Boolean(detailSnapshot.squashMerge);
				}
				return;
			}

			if (section === 'labels') {
				initializeSelectionState();
				const input = document.querySelector('[data-section-input="labels"]');
				if (input) {
					input.value = '';
				}
				renderSelectedLabels();
				renderLabelOptions();
				return;
			}

			if (section === 'milestone') {
				initializeSelectionState();
				syncMilestoneSelect();
				return;
			}

			if (section === 'closeRelatedIssue') {
				const closeRelatedIssueInput = document.querySelector('[data-section-input="closeRelatedIssue"]');
				if (closeRelatedIssueInput) {
					closeRelatedIssueInput.checked = Boolean(detailSnapshot.closeRelatedIssue);
				}
			}
		}

		function renderSelectedLabels() {
			const selectedContainer = document.querySelector('[data-picker-selected="labels"]');
			if (!selectedContainer) {
				return;
			}

			if (!selectedLabels.length) {
				selectedContainer.innerHTML = '<div class="picker-empty">No labels selected</div>';
				return;
			}

			selectedContainer.innerHTML = selectedLabels.map(function(label) {
				return '<span class="picker-chip" data-label-key="' + escapeAttrText(labelKey(label)) + '">' +
					'<span class="label-chip" style="--label-color:' + escapeAttrText(normalizeLabelColor(label.color)) + '">' + escapeHtmlText(label.name) + '</span>' +
					'<button type="button" aria-label="Remove ' + escapeAttrText(label.name) + '" title="Remove">&times;</button>' +
				'</span>';
			}).join('');
		}

		function renderLabelOptions() {
			const optionsContainer = document.querySelector('[data-picker-options="labels"]');
			const input = document.querySelector('[data-section-input="labels"]');
			if (!optionsContainer || !input) {
				return;
			}

			const query = String(input.value || '').trim().toLowerCase();
			const selectedKeys = new Set(selectedLabels.map(labelKey));
			const options = availableLabels().filter(function(option) {
				return !selectedKeys.has(labelKey(option)) && (!query || option.name.toLowerCase().includes(query));
			});

			if (!options.length) {
				optionsContainer.innerHTML = '<div class="picker-empty">No labels available</div>';
				return;
			}

			optionsContainer.innerHTML = options.map(function(option) {
				return '<button type="button" class="picker-option" data-label-key="' + escapeAttrText(labelKey(option)) + '">' + escapeHtmlText(option.name) + '</button>';
			}).join('');
		}

		function openLabelOptions() {
			const optionsContainer = document.querySelector('[data-picker-options="labels"]');
			if (!optionsContainer) {
				return;
			}
			renderLabelOptions();
			optionsContainer.classList.remove('hidden');
		}

		function closeLabelOptions() {
			const optionsContainer = document.querySelector('[data-picker-options="labels"]');
			if (!optionsContainer) {
				return;
			}
			optionsContainer.classList.add('hidden');
		}

		function syncMilestoneSelect() {
			const select = document.querySelector('[data-section-input="milestone"]');
			if (!select) {
				return;
			}

			select.innerHTML = '<option value="">No milestone</option>';
			availableMilestones().forEach(function(milestone) {
				const option = document.createElement('option');
				option.value = String(milestone.number);
				option.textContent = milestone.title;
				option.selected = Boolean(selectedMilestone && milestone.number === selectedMilestone.number);
				select.appendChild(option);
			});

			if (!selectedMilestone) {
				select.value = '';
			}
		}

		function selectFirstFilteredLabel() {
			const firstOption = document.querySelector('[data-picker-options="labels"] .picker-option');
			if (firstOption instanceof HTMLElement) {
				firstOption.click();
				return true;
			}
			return false;
		}

		function getSectionInput(section) {
			const el = document.querySelector('[data-section-input="' + section + '"]');
			if (!el) return null;
			if (el.type === 'checkbox') return el.checked;
			return el.value;
		}

		function getSectionView(section) {
			return document.querySelector('.section-view-' + section);
		}

		function getSectionEdit(section) {
			return document.querySelector('[data-section-edit="' + section + '"]');
		}

		function getSectionSaving(section) {
			const edit = getSectionEdit(section);
			return edit ? edit.querySelector('.section-edit-saving') : null;
		}

		function getSectionError(section) {
			const edit = getSectionEdit(section);
			return edit ? edit.querySelector('.section-edit-error') : null;
		}

		function getSectionSaveBtn(section) {
			const edit = getSectionEdit(section);
			return edit ? edit.querySelector('.btn-save-section') : null;
		}

		function getSectionCancelBtn(section) {
			const edit = getSectionEdit(section);
			return edit ? edit.querySelector('.btn-cancel-section') : null;
		}

		function isPermissionTooltipWrapper(element) {
			return Boolean(
				element
				&& element.classList
				&& element.classList.contains('permission-tooltip-target')
			);
		}

		function unwrapPermissionTooltip(element) {
			if (!element || !element.parentElement || !isPermissionTooltipWrapper(element.parentElement)) {
				return;
			}

			var wrapper = element.parentElement;
			var parent = wrapper.parentElement;
			if (!parent) {
				return;
			}

			parent.insertBefore(element, wrapper);
			wrapper.remove();
		}

		function wrapPermissionTooltip(element, message) {
			if (!element || !element.parentElement) {
				return;
			}

			var wrapper = isPermissionTooltipWrapper(element.parentElement)
				? element.parentElement
				: document.createElement('span');

			wrapper.className = 'permission-tooltip-target';
			wrapper.setAttribute('data-tooltip', message);
			wrapper.removeAttribute('title');
			wrapper.setAttribute('aria-label', message);
			wrapper.setAttribute('tabindex', '0');

			if (wrapper !== element.parentElement) {
				element.parentElement.insertBefore(wrapper, element);
				wrapper.appendChild(element);
			}
		}

		function setDisabledWithTooltip(element, disabled, message) {
			if (!element) {
				return;
			}
			element.disabled = Boolean(disabled);
			if (disabled && message) {
				element.setAttribute('aria-label', message);
				if (element instanceof HTMLButtonElement) {
					if (element.hasAttribute('title') && !element.hasAttribute('data-original-title')) {
						element.setAttribute('data-original-title', element.getAttribute('title') || '');
					}
					element.removeAttribute('title');
					wrapPermissionTooltip(element, message);
				} else {
					element.setAttribute('title', message);
				}
			} else {
				unwrapPermissionTooltip(element);
				if (element.hasAttribute('data-original-title')) {
					var originalTitle = element.getAttribute('data-original-title');
					element.removeAttribute('data-original-title');
					if (originalTitle) {
						element.setAttribute('title', originalTitle);
					} else {
						element.removeAttribute('title');
					}
				}
			}
		}

		function hasOverviewPermission(key) {
			return !overviewPermissions || overviewPermissions[key] !== false;
		}

		function getOverviewEditPermission(section) {
			switch (section) {
				case 'title':
				case 'body':
					return 'canEditPullRequestTitleAndBody';
				case 'draft':
					return 'canEditPullRequestDraft';
				case 'pruneBranch':
				case 'squashMerge':
				case 'closeRelatedIssue':
					return 'canEditPullRequestOptions';
				default:
					return 'canEditPullRequest';
			}
		}

		function getOverviewEditDeniedMessage(section) {
			switch (section) {
				case 'title':
				case 'body':
					return 'You do not have permission to edit this pull request title or description.';
				case 'draft':
					return 'You do not have permission to change this pull request draft status.';
				case 'pruneBranch':
				case 'squashMerge':
				case 'closeRelatedIssue':
					return 'You do not have permission to change these pull request options.';
				default:
					return 'You do not have permission to update pull requests in this repository.';
			}
		}

		function isAlwaysVisibleSection(section) {
			const edit = getSectionEdit(section);
			return Boolean(edit && edit.classList.contains('preference-item'));
		}

		function applyPermissionControls() {
			if (!overviewPermissions) {
				return;
			}

			document.querySelectorAll('.edit-icon-btn[data-section]').forEach(function(el) {
				var section = el.getAttribute('data-section');
				if (!section) {
					return;
				}
				var permissionKey = getOverviewEditPermission(section);
				setDisabledWithTooltip(el, !hasOverviewPermission(permissionKey), getOverviewEditDeniedMessage(section));
			});

			document.querySelectorAll('.preference-card [data-section-input]').forEach(function(el) {
				var section = el.getAttribute('data-section-input');
				if (!section) {
					return;
				}
				var permissionKey = getOverviewEditPermission(section);
				setDisabledWithTooltip(el, !hasOverviewPermission(permissionKey), getOverviewEditDeniedMessage(section));
			});

			var stateButton = document.getElementById('state-action-button');
			if (stateButton) {
				var requestedState = stateButton.getAttribute('data-state-action');
				if (requestedState === 'closed' && !overviewPermissions.canClosePullRequest) {
					setDisabledWithTooltip(stateButton, true, 'You do not have permission to close pull requests in this repository.');
				}
				if (requestedState === 'open' && !overviewPermissions.canReopenPullRequest) {
					setDisabledWithTooltip(stateButton, true, 'You do not have permission to reopen pull requests in this repository.');
				}
			}

			var mergeButton = document.getElementById('merge-action-button');
			if (mergeButton) {
				if (!overviewPermissions.canMergePullRequest) {
					setDisabledWithTooltip(mergeButton, true, 'You do not have permission to merge pull requests in this repository.');
				} else {
					var mergeReason = mergeButton.getAttribute('data-merge-disabled-reason');
					if (mergeReason) {
						setDisabledWithTooltip(mergeButton, true, mergeReason);
					}
				}
			}

			if (!overviewPermissions.canCreateComment) {
				setDisabledWithTooltip(document.getElementById('conversation-comment-input'), true, 'You do not have permission to comment in this repository.');
				setDisabledWithTooltip(document.getElementById('conversation-comment-submit'), true, 'You do not have permission to comment in this repository.');
				document.querySelectorAll('.reply-action-btn, .reply-input, .btn-submit-reply').forEach(function(el) {
					setDisabledWithTooltip(el, true, 'You do not have permission to comment in this repository.');
				});
			}

			if (!overviewPermissions.canEditComment) {
				document.querySelectorAll('.edit-comment-btn').forEach(function(el) {
					setDisabledWithTooltip(el, true, 'You do not have permission to edit comments in this repository.');
				});
			}

			if (!overviewPermissions.canResolveComment) {
				document.querySelectorAll('.comment-toggle-input').forEach(function(el) {
					setDisabledWithTooltip(el, true, 'You do not have permission to resolve comments in this repository.');
					var label = el.closest('.comment-toggle');
					if (label) {
						label.setAttribute('title', 'You do not have permission to resolve comments in this repository.');
						label.setAttribute('aria-label', 'You do not have permission to resolve comments in this repository.');
					}
				});
			}
		}

		function startEdit(section) {
			if (!section || !hasOverviewPermission(getOverviewEditPermission(section))) {
				return;
			}
			// Only one section editable at a time
			if (editingSection && editingSection !== section) {
				cancelEdit(editingSection);
			}

			const view = getSectionView(section);
			const edit = getSectionEdit(section);
			const titleView = document.querySelector('.section-view-title');
			const titleEdit = document.querySelector('[data-section-edit="title"]');
			const alwaysVisible = isAlwaysVisibleSection(section);

			if (view) view.style.display = 'none';
			if (edit && !alwaysVisible) edit.style.display = 'block';

			// For title section, also toggle the title view
			if (section === 'title' && titleView && titleEdit) {
				titleView.style.display = 'none';
				titleEdit.style.display = 'block';
			}

			if (section === 'labels') {
				renderSelectedLabels();
				openLabelOptions();
			}

			if (section === 'milestone') {
				syncMilestoneSelect();
			}

			// Clear previous error
			var err = getSectionError(section);
			if (err) { err.style.display = 'none'; err.textContent = ''; }

			editingSection = section;
		}

		function cancelEdit(section) {
			resetSectionState(section);

			const view = getSectionView(section);
			const edit = getSectionEdit(section);
			const titleView = document.querySelector('.section-view-title');
			const titleEdit = document.querySelector('[data-section-edit="title"]');
			const alwaysVisible = isAlwaysVisibleSection(section);

			if (view) view.style.display = '';
			if (edit && !alwaysVisible) edit.style.display = 'none';

			if (section === 'title' && titleView && titleEdit) {
				titleView.style.display = '';
				titleEdit.style.display = 'none';
			}

			if (editingSection === section) {
				editingSection = null;
			}

			if (section === 'labels') {
				closeLabelOptions();
			}
		}

		function setSaving(section, saving) {
			const saveBtn = getSectionSaveBtn(section);
			const cancelBtn = getSectionCancelBtn(section);
			const savingEl = getSectionSaving(section);
			const edit = getSectionEdit(section);
			const preferenceInput = edit && edit.closest('.preference-card') ? edit.querySelector('[data-section-input]') : null;
			if (saveBtn) saveBtn.disabled = saving;
			if (cancelBtn) cancelBtn.disabled = saving;
			if (preferenceInput) preferenceInput.disabled = saving;
			if (savingEl) savingEl.style.display = saving ? '' : 'none';
		}

		function showSectionError(section, message) {
			const err = getSectionError(section);
			if (err) {
				err.textContent = message;
				err.style.display = '';
			}
		}

		function setConversationCommentSubmitting(submitting) {
			pendingConversationComment = submitting;
			var button = document.getElementById('conversation-comment-submit');
			var input = document.getElementById('conversation-comment-input');
			var canCreateComment = hasOverviewPermission('canCreateComment');
			if (button) {
				button.disabled = submitting || !canCreateComment;
				button.textContent = submitting ? 'Commenting...' : 'Comment';
			}
			if (input) {
				input.disabled = submitting || !canCreateComment;
			}
		}

		function showConversationCommentError(message) {
			var errorEl = document.getElementById('conversation-comment-error');
			if (errorEl) {
				errorEl.textContent = message || '';
			}
		}

		function submitConversationComment() {
			if (!hasOverviewPermission('canCreateComment')) {
				return;
			}
			if (pendingConversationComment) {
				return;
			}

			var input = document.getElementById('conversation-comment-input');
			if (!input) {
				return;
			}

			showConversationCommentError('');
			setConversationCommentSubmitting(true);
			vscode.postMessage({
				command: 'submitPullRequestComment',
				body: input.value,
			});
		}

		function updateCommentToggleStatus(input, resolved) {
			var statusContainer = input.closest('.comment-review-status');
			var label = input.closest('.comment-toggle');
			var statusText = statusContainer ? statusContainer.querySelector('.comment-toggle-state') : null;
			var currentStatus = resolved ? 'Resolved' : 'Unresolved';
			var targetStatus = resolved ? 'Unresolved' : 'Resolved';
			var actionLabel = 'Mark discussion as ' + targetStatus.toLowerCase();

			input.dataset.resolved = String(!resolved);
			if (statusText) {
				statusText.textContent = currentStatus;
			}
			if (statusContainer) {
				statusContainer.setAttribute('aria-label', 'Review status: ' + currentStatus);
				var errorEl = statusContainer.querySelector('.comment-toggle-error');
				if (errorEl) {
					errorEl.remove();
				}
			}
			if (label) {
				label.setAttribute('title', actionLabel);
				label.setAttribute('aria-label', actionLabel);
			}
		}

		function showCommentToggleError(input, message) {
			var statusContainer = input.closest('.comment-review-status');
			if (!statusContainer) {
				return;
			}

			var errorEl = statusContainer.querySelector('.comment-toggle-error');
			if (!errorEl) {
				errorEl = document.createElement('span');
				errorEl.className = 'comment-toggle-error';
				statusContainer.appendChild(errorEl);
			}
			errorEl.textContent = message || 'Failed to revise comment status.';
		}

		// ---- Comment Inline Editing ----

		var editingCommentId = null;

		function startCommentEdit(commentId) {
			if (!hasOverviewPermission('canEditComment')) {
				return;
			}
			if (editingCommentId && editingCommentId !== commentId) {
				cancelCommentEdit(editingCommentId);
			}

			var editArea = document.querySelector('[data-comment-edit="' + CSS.escape(commentId) + '"]');
			var bodyEl = editArea ? editArea.previousElementSibling : null;
			var errorEl = document.querySelector('[data-comment-edit-error="' + CSS.escape(commentId) + '"]');

			if (bodyEl && bodyEl.classList.contains('comment-body')) {
				bodyEl.style.display = 'none';
			}
			if (editArea) {
				editArea.style.display = 'block';
			}
			if (errorEl) {
				errorEl.style.display = 'none';
				errorEl.textContent = '';
			}

			editingCommentId = commentId;

			// Focus the textarea
			var input = document.querySelector('[data-comment-input="' + CSS.escape(commentId) + '"]');
			if (input) {
				input.focus();
			}
		}

		function cancelCommentEdit(commentId) {
			var editArea = document.querySelector('[data-comment-edit="' + CSS.escape(commentId) + '"]');
			var bodyEl = editArea ? editArea.previousElementSibling : null;
			var input = document.querySelector('[data-comment-input="' + CSS.escape(commentId) + '"]');

			if (input) {
				input.value = input.defaultValue;
			}

			if (bodyEl && bodyEl.classList.contains('comment-body')) {
				bodyEl.style.display = '';
			}
			if (editArea) {
				editArea.style.display = 'none';
			}

			if (editingCommentId === commentId) {
				editingCommentId = null;
			}

			var errorEl = document.querySelector('[data-comment-edit-error="' + CSS.escape(commentId) + '"]');
			if (errorEl) {
				errorEl.style.display = 'none';
				errorEl.textContent = '';
			}
		}

		function setCommentEditSaving(commentId, saving) {
			var editArea = document.querySelector('[data-comment-edit="' + CSS.escape(commentId) + '"]');
			if (!editArea) {
				return;
			}
			var saveBtn = editArea.querySelector('.btn-save-comment-edit');
			var cancelBtn = editArea.querySelector('.btn-cancel-comment-edit');
			var savingEl = editArea.querySelector('.comment-edit-saving');
			var input = editArea.querySelector('.comment-edit-input');
			if (saveBtn) {
				saveBtn.disabled = saving;
			}
			if (cancelBtn) {
				cancelBtn.disabled = saving;
			}
			if (savingEl) {
				savingEl.style.display = saving ? '' : 'none';
			}
			if (input) {
				input.disabled = saving;
			}
		}

		function showCommentEditError(commentId, message) {
			var errorEl = document.querySelector('[data-comment-edit-error="' + CSS.escape(commentId) + '"]');
			if (errorEl) {
				errorEl.textContent = message || '';
				errorEl.style.display = '';
			}
		}

		function saveCommentEdit(commentId) {
			var input = document.querySelector('[data-comment-input="' + CSS.escape(commentId) + '"]');
			if (!input) {
				return;
			}

			var body = input.value;
			if (!body.trim()) {
				showCommentEditError(commentId, 'Comment body is required.');
				return;
			}

			setCommentEditSaving(commentId, true);
			showCommentEditError(commentId, '');
			vscode.postMessage({
				command: 'editPullRequestComment',
				commentId: commentId,
				body: body,
			});
		}

		// ---- Reply Composer ----

		function openReplyComposer(discussionId) {
			if (!hasOverviewPermission('canCreateComment')) {
				return;
			}
			if (!discussionId) return;
			// Close any other open reply composers
			document.querySelectorAll('.reply-composer').forEach(function(el) {
				if (el.getAttribute('data-reply-composer') !== discussionId) {
					el.style.display = 'none';
					var input = el.querySelector('[data-reply-input]');
					if (input) input.value = '';
					updateReplySubmitState(el.getAttribute('data-reply-composer'));
				}
			});
			var composer = document.querySelector('.reply-composer[data-reply-composer="' + CSS.escape(discussionId) + '"]');
			if (composer) {
				composer.style.display = 'block';
				var input = composer.querySelector('[data-reply-input]');
				if (input) {
					input.focus();
					updateReplySubmitState(discussionId);
				}
			}
		}

		function closeReplyComposer(discussionId) {
			if (!discussionId) return;
			var composer = document.querySelector('.reply-composer[data-reply-composer="' + CSS.escape(discussionId) + '"]');
			if (composer) {
				composer.style.display = 'none';
				var input = composer.querySelector('[data-reply-input]');
				if (input) input.value = '';
				hideReplyError(discussionId);
			}
		}

		function submitReply(discussionId) {
			if (!hasOverviewPermission('canCreateComment')) {
				return;
			}
			if (!discussionId) return;
			var input = document.querySelector('[data-reply-input="' + CSS.escape(discussionId) + '"]');
			if (!input || input.disabled) return;
			var body = input.value;
			if (!body.trim()) return;

			setReplySubmitting(discussionId, true);
			hideReplyError(discussionId);
			vscode.postMessage({
				command: 'replyPullRequestComment',
				discussionId: discussionId,
				body: body,
			});
		}

		function setReplySubmitting(discussionId, submitting) {
			var submitBtn = document.querySelector('.btn-submit-reply[data-discussion-id="' + CSS.escape(discussionId) + '"]');
			var cancelBtn = document.querySelector('.btn-cancel-reply[data-discussion-id="' + CSS.escape(discussionId) + '"]');
			var replyAction = document.querySelector('.reply-action-btn[data-discussion-id="' + CSS.escape(discussionId) + '"]');
			var savingEl = document.querySelector('[data-reply-saving="' + CSS.escape(discussionId) + '"]');
			var input = document.querySelector('[data-reply-input="' + CSS.escape(discussionId) + '"]');
			var canCreateComment = hasOverviewPermission('canCreateComment');

			if (submitBtn) submitBtn.disabled = submitting || !canCreateComment;
			if (cancelBtn) cancelBtn.disabled = submitting;
			if (replyAction) replyAction.disabled = submitting || !canCreateComment;
			if (input) input.disabled = submitting || !canCreateComment;
			if (savingEl) savingEl.style.display = submitting ? 'inline' : 'none';
		}

		function updateReplySubmitState(discussionId) {
			if (!discussionId) return;
			var input = document.querySelector('[data-reply-input="' + CSS.escape(discussionId) + '"]');
			var submitBtn = document.querySelector('.btn-submit-reply[data-discussion-id="' + CSS.escape(discussionId) + '"]');
			if (submitBtn) {
				submitBtn.disabled = !hasOverviewPermission('canCreateComment') || !input || input.disabled || !input.value.trim();
			}
		}

		function showReplyError(discussionId, message) {
			var errorEl = document.querySelector('[data-reply-error="' + CSS.escape(discussionId) + '"]');
			if (errorEl) {
				errorEl.textContent = message;
				errorEl.style.display = 'block';
			}
		}

		function hideReplyError(discussionId) {
			var errorEl = document.querySelector('[data-reply-error="' + CSS.escape(discussionId) + '"]');
			if (errorEl) {
				errorEl.textContent = '';
				errorEl.style.display = 'none';
			}
		}

		function buildInput(section) {
			switch (section) {
				case 'title':
					var title = document.querySelector('[data-section-input="title"]');
					return { title: title ? title.value.trim() : currentTitle };
				case 'body':
					return { body: getSectionInput('body') || '' };
				case 'labels':
					return {
						labels: selectedLabels.map(function(label) {
							return label.name;
						}).join(','),
					};
				case 'milestone':
					return { milestoneNumber: selectedMilestone ? Number(selectedMilestone.number) : undefined };
				case 'draft':
					return { draft: getSectionInput('draft') };
				case 'pruneBranch':
					return { pruneBranch: getSectionInput('pruneBranch') };
				case 'squashMerge':
					return { squashMerge: getSectionInput('squashMerge') };
				case 'closeRelatedIssue':
					return { closeRelatedIssue: getSectionInput('closeRelatedIssue') };
				default:
					return {};
			}
		}

		function saveSection(section) {
			var input = buildInput(section);
			if (section === 'title' && !input.title) {
				showSectionError(section, 'Title is required.');
				return;
			}

			if (section === 'labels') {
				if (!editOptions || !Array.isArray(editOptions.labels)) {
					showSectionError(section, 'Repository labels are not loaded.');
					return;
				}

				var labelKeys = new Set(availableLabels().map(labelKey));
				if (selectedLabels.some(function(label) { return !labelKeys.has(labelKey(label)); })) {
					showSectionError(section, 'Selected labels must come from the repository label list.');
					return;
				}
			}

			if (section === 'milestone') {
				if (!editOptions || !Array.isArray(editOptions.milestones)) {
					showSectionError(section, 'Repository milestones are not loaded.');
					return;
				}

				var milestoneKeys = new Set(availableMilestones().map(milestoneKey));
				if (selectedMilestone && !milestoneKeys.has(milestoneKey(selectedMilestone))) {
					showSectionError(section, 'Selected milestone must come from the repository milestone list.');
					return;
				}
			}

			setSaving(section, true);
			vscode.postMessage({
				command: 'savePullRequestSection',
				section: section,
				input: input,
			});
		}

		initializeSelectionState();
		renderSelectedLabels();
		syncMilestoneSelect();
		applyPermissionControls();

		const labelInput = document.querySelector('[data-section-input="labels"]');
		const labelOptions = document.querySelector('[data-picker-options="labels"]');
		const selectedLabelContainer = document.querySelector('[data-picker-selected="labels"]');
		const milestoneSelect = document.querySelector('[data-section-input="milestone"]');

		if (labelInput) {
			labelInput.addEventListener('focus', function() {
				openLabelOptions();
			});

			labelInput.addEventListener('input', function() {
				renderLabelOptions();
				openLabelOptions();
			});

			labelInput.addEventListener('blur', function() {
				window.setTimeout(closeLabelOptions, 0);
			});
		}

		if (labelOptions) {
			labelOptions.addEventListener('mousedown', function(event) {
				event.preventDefault();
			});

			labelOptions.addEventListener('click', function(event) {
				const target = event.target;
				const option = target instanceof Element ? target.closest('.picker-option') : null;
				if (!option) {
					return;
				}

				const optionKey = option.getAttribute('data-label-key');
				const label = availableLabels().find(function(candidate) {
					return labelKey(candidate) === optionKey;
				});
				if (!label) {
					return;
				}

				selectedLabels = selectedLabels.concat([label]);
				if (labelInput) {
					labelInput.value = '';
					labelInput.focus();
				}
				renderSelectedLabels();
				renderLabelOptions();
			});
		}

		if (selectedLabelContainer) {
			selectedLabelContainer.addEventListener('click', function(event) {
				const target = event.target;
				const removeBtn = target instanceof Element ? target.closest('button') : null;
				if (!removeBtn) {
					return;
				}

				const chip = removeBtn.closest('.picker-chip');
				const optionKey = chip ? chip.getAttribute('data-label-key') : '';
				selectedLabels = selectedLabels.filter(function(label) {
					return labelKey(label) !== optionKey;
				});
				renderSelectedLabels();
				renderLabelOptions();
			});
		}

		if (milestoneSelect) {
			milestoneSelect.addEventListener('change', function() {
				selectedMilestone = availableMilestones().find(function(milestone) {
					return String(milestone.number) === milestoneSelect.value;
				}) || null;
			});
		}

		// Edit icon click handlers
		document.querySelectorAll('.edit-icon-btn').forEach(function(btn) {
			btn.addEventListener('click', function() {
				startEdit(btn.dataset.section);
			});
		});

		// Save button handlers
		document.querySelectorAll('.btn-save-section').forEach(function(btn) {
			btn.addEventListener('click', function() {
				saveSection(btn.dataset.section);
			});
		});

		// Cancel button handlers
		document.querySelectorAll('.btn-cancel-section').forEach(function(btn) {
			btn.addEventListener('click', function() {
				cancelEdit(btn.dataset.section);
			});
		});

		document.querySelectorAll('.preference-card [data-section-input]').forEach(function(input) {
			input.addEventListener('change', function() {
				var section = input.getAttribute('data-section-input');
				if (section) {
					saveSection(section);
				}
			});
		});

		// Comment edit button handlers
		document.querySelectorAll('.edit-comment-btn').forEach(function(btn) {
			btn.addEventListener('click', function() {
				startCommentEdit(btn.dataset.commentId);
			});
		});

		// Comment save button handlers
		document.querySelectorAll('.btn-save-comment-edit').forEach(function(btn) {
			btn.addEventListener('click', function() {
				saveCommentEdit(btn.dataset.commentId);
			});
		});

		// Comment cancel button handlers
		document.querySelectorAll('.btn-cancel-comment-edit').forEach(function(btn) {
			btn.addEventListener('click', function() {
				cancelCommentEdit(btn.dataset.commentId);
			});
		});

		// Handle Ctrl+Enter in comment edit textareas
		document.querySelectorAll('[data-comment-input]').forEach(function(el) {
			el.addEventListener('keydown', function(e) {
				if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
					e.preventDefault();
					var commentId = el.getAttribute('data-comment-input');
					if (commentId) {
						saveCommentEdit(commentId);
					}
				}
				if (e.key === 'Escape') {
					var commentId = el.getAttribute('data-comment-input');
					if (commentId) {
						cancelCommentEdit(commentId);
					}
				}
			});
		});

		// Handle Enter key in text inputs and Ctrl+Enter in textareas
		document.querySelectorAll('[data-section-input]').forEach(function(el) {
			el.addEventListener('keydown', function(e) {
				if (el.getAttribute('data-section-input') === 'labels' && e.key === 'Enter') {
					e.preventDefault();
					if (!selectFirstFilteredLabel()) {
						saveSection('labels');
					}
					return;
				}

				if (e.key === 'Enter' && (el.tagName === 'INPUT' || (el.tagName === 'TEXTAREA' && (e.ctrlKey || e.metaKey)))) {
					e.preventDefault();
					var section = el.getAttribute('data-section-input');
					if (section) saveSection(section);
				}
				if (e.key === 'Escape') {
					var section = el.getAttribute('data-section-input');
					if (section) cancelEdit(section);
				}
			});
		});

		// Handle section save errors from the extension
		window.addEventListener('message', function(event) {
			var msg = event.data;
			if (msg.command === 'sectionSaveError') {
				setSaving(msg.section, false);
				showSectionError(msg.section, msg.message);
			}
			if (msg.command === 'pullRequestStateChangeError') {
				var button = document.getElementById('state-action-button');
				if (button) {
					button.disabled = false;
					button.classList.remove('danger');
					button.classList.add('secondary');
					button.textContent = pendingStateAction === 'closed' ? 'Close pull request' : 'Reopen pull request';
				}
				var errorEl = document.getElementById('state-action-error');
				if (errorEl) {
					errorEl.textContent = msg.message || 'Unable to update pull request state.';
				}
				pendingStateAction = null;
			}
			if (msg.command === 'mergePullRequestError') {
				var mergeButton = document.getElementById('merge-action-button');
				if (mergeButton) {
					mergeButton.disabled = false;
					mergeButton.classList.remove('danger');
					mergeButton.classList.add('primary');
					mergeButton.textContent = 'Merge pull request';
					mergeButton.removeAttribute('data-confirming-merge');
				}
				var errorEl = document.getElementById('state-action-error');
				if (errorEl) {
					errorEl.textContent = msg.message || 'Unable to merge pull request.';
				}
			}
			if (msg.command === 'pullRequestCommentSubmitError') {
				setConversationCommentSubmitting(false);
				showConversationCommentError(msg.message || 'Unable to submit comment.');
			}
			if (msg.command === 'reviseCommentStatusError' && msg.discussionId) {
				var toggle = document.querySelector('.comment-toggle-input[data-discussion-id="' + CSS.escape(msg.discussionId) + '"]');
				if (toggle) {
					toggle.checked = !toggle.checked;
					toggle.disabled = false;
					updateCommentToggleStatus(toggle, toggle.checked);
					showCommentToggleError(toggle, msg.error || 'Failed to revise comment status.');
				}
			}
			if (msg.command === 'editPullRequestCommentError' && msg.commentId) {
				setCommentEditSaving(msg.commentId, false);
				showCommentEditError(msg.commentId, msg.message || 'Failed to edit comment.');
			}
			if (msg.command === 'replyPullRequestCommentError' && msg.discussionId) {
				setReplySubmitting(msg.discussionId, false);
				showReplyError(msg.discussionId, msg.message || 'Failed to submit reply.');
			}
		});

		document.getElementById('refresh-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'refresh' });
		});
		document.getElementById('open-web-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'openOnWeb' });
		});
		document.getElementById('conversation-comment-submit')?.addEventListener('click', () => {
			submitConversationComment();
		});
		document.getElementById('conversation-comment-input')?.addEventListener('keydown', (event) => {
			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
				event.preventDefault();
				submitConversationComment();
			}
		});
		document.querySelectorAll('.comment-toggle-input').forEach((toggle) => {
			toggle.addEventListener('change', (event) => {
				var input = event.currentTarget;
				if (!input || input.disabled || !hasOverviewPermission('canResolveComment')) {
					return;
				}

				var discussionId = input.dataset.discussionId;
				if (!discussionId) {
					return;
				}

				var resolved = input.checked;
				input.disabled = true;
				updateCommentToggleStatus(input, resolved);
				vscode.postMessage({
					command: 'revisePullRequestCommentStatus',
					discussionId: discussionId,
					resolved: resolved,
				});
			});
		});
		document.getElementById('state-action-button')?.addEventListener('click', () => {
			var button = document.getElementById('state-action-button');
			if (!button || button.disabled) {
				return;
			}
			var errorEl = document.getElementById('state-action-error');
			if (errorEl) {
				errorEl.textContent = '';
			}
			var requestedState = button.getAttribute('data-state-action');
			if (requestedState === 'closed' && button.getAttribute('data-confirming-close') !== 'true') {
				button.setAttribute('data-confirming-close', 'true');
				button.textContent = 'Confirm close pull request';
				if (errorEl) {
					errorEl.textContent = 'Click again to confirm closing this pull request.';
				}
				return;
			}
			button.removeAttribute('data-confirming-close');
			pendingStateAction = requestedState;
			button.disabled = true;
			button.textContent = pendingStateAction === 'closed' ? 'Closing pull request...' : 'Reopening pull request...';
			vscode.postMessage({
				command: 'changePullRequestState',
				state: pendingStateAction,
			});
		});
		document.getElementById('merge-action-button')?.addEventListener('click', () => {
			var button = document.getElementById('merge-action-button');
			if (!button || button.disabled) {
				return;
			}
			var errorEl = document.getElementById('state-action-error');
			if (errorEl) {
				errorEl.textContent = '';
			}
			if (button.getAttribute('data-confirming-merge') !== 'true') {
				button.setAttribute('data-confirming-merge', 'true');
				button.textContent = 'Confirm merge';
				button.classList.add('danger');
				if (errorEl) {
					errorEl.textContent = 'Click again to confirm merging this pull request.';
				}
				return;
			}
			button.removeAttribute('data-confirming-merge');
			button.disabled = true;
			button.classList.remove('danger');
			button.classList.add('secondary');
			button.textContent = 'Merging pull request...';
			vscode.postMessage({
				command: 'mergePullRequest',
			});
		});
		document.querySelectorAll('[data-action="openUrl"]').forEach((el) => {
			el.addEventListener('click', () => {
				vscode.postMessage({ command: 'openUrl', url: el.dataset.url });
			});
		});
		document.querySelectorAll('[data-action="openIssue"]').forEach((el) => {
			el.addEventListener('click', () => {
				vscode.postMessage({
					command: 'openIssue',
					issue: Number(el.dataset.issue),
					repository: el.dataset.repository,
					url: el.dataset.url,
				});
			});
		});
		document.querySelectorAll('[data-action="addReviewer"]').forEach((el) => {
			el.addEventListener('click', () => {
				if (el.disabled || !hasOverviewPermission('canUpdateReviewers')) {
					return;
				}
				vscode.postMessage({ command: 'addReviewer' });
			});
		});
		document.querySelectorAll('[data-action="removeReviewer"]').forEach((el) => {
			el.addEventListener('click', () => {
				if (el.disabled || !hasOverviewPermission('canUpdateReviewers')) {
					return;
				}
				vscode.postMessage({
					command: 'removeReviewer',
					login: el.dataset.login,
				});
			});
		});
		document.querySelectorAll('[data-action="addTester"]').forEach((el) => {
			el.addEventListener('click', () => {
				if (el.disabled || !hasOverviewPermission('canUpdateTesters')) {
					return;
				}
				vscode.postMessage({ command: 'addTester' });
			});
		});
		document.querySelectorAll('[data-action="removeTester"]').forEach((el) => {
			el.addEventListener('click', () => {
				if (el.disabled || !hasOverviewPermission('canUpdateTesters')) {
					return;
				}
				vscode.postMessage({
					command: 'removeTester',
					login: el.dataset.login,
				});
			});
		});
		document.querySelectorAll('[data-action="addAssignee"]').forEach((el) => {
			el.addEventListener('click', () => {
				if (el.disabled || !hasOverviewPermission('canUpdateAssignees')) {
					return;
				}
				vscode.postMessage({ command: 'addAssignee' });
			});
		});
		document.querySelectorAll('[data-action="removeAssignee"]').forEach((el) => {
			el.addEventListener('click', () => {
				if (el.disabled || !hasOverviewPermission('canUpdateAssignees')) {
					return;
				}
				vscode.postMessage({
					command: 'removeAssignee',
					login: el.dataset.login,
				});
			});
		});
		document.querySelectorAll('[data-action="addRelatedIssue"]').forEach((el) => {
			el.addEventListener('click', () => {
				if (el.disabled || !hasOverviewPermission('canUpdateRelatedIssues')) {
					return;
				}
				vscode.postMessage({ command: 'addRelatedIssue' });
			});
		});
		document.querySelectorAll('[data-action="removeRelatedIssue"]').forEach((el) => {
			el.addEventListener('click', () => {
				if (el.disabled || !hasOverviewPermission('canUpdateRelatedIssues')) {
					return;
				}
				vscode.postMessage({
					command: 'removeRelatedIssue',
					issue: Number(el.dataset.issue),
				});
			});
		});
		document.querySelectorAll('[data-action="openDiffComment"]').forEach((el) => {
			el.addEventListener('click', () => {
				vscode.postMessage({
					command: 'openDiffComment',
					path: el.dataset.path,
					line: Number(el.dataset.line),
				});
			});
		});

		// Reply action button handlers
		document.querySelectorAll('.reply-action-btn').forEach(function(btn) {
			btn.addEventListener('click', function() {
				if (btn.disabled || !hasOverviewPermission('canCreateComment')) {
					return;
				}
				openReplyComposer(btn.dataset.discussionId);
			});
		});

		// Reply submit button handlers
		document.querySelectorAll('.btn-submit-reply').forEach(function(btn) {
			btn.addEventListener('click', function() {
				if (btn.disabled || !hasOverviewPermission('canCreateComment')) {
					return;
				}
				submitReply(btn.dataset.discussionId);
			});
		});

		// Reply cancel button handlers
		document.querySelectorAll('.btn-cancel-reply').forEach(function(btn) {
			btn.addEventListener('click', function() {
				closeReplyComposer(btn.dataset.discussionId);
			});
		});

		// Reply input handlers
		document.querySelectorAll('[data-reply-input]').forEach(function(el) {
			el.addEventListener('input', function() {
				updateReplySubmitState(el.getAttribute('data-reply-input'));
			});
			el.addEventListener('keydown', function(e) {
				if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
					e.preventDefault();
					submitReply(el.getAttribute('data-reply-input'));
				}
				if (e.key === 'Escape') {
					closeReplyComposer(el.getAttribute('data-reply-input'));
				}
			});
		});
	</script>` : ''}
</body>
</html>`;
}

export function getOverviewWithCommentsHtml(
	detail: PullRequestDetail,
	snapshot: PullRequestCommentsSnapshot,
	nonce: string,
	relatedIssuesHtml?: string,
	editOptions?: EditPullRequestOptions,
	diffContexts?: ReadonlyMap<string, DiffCommentContext>,
	activityHtml?: string,
	permissions?: PullRequestOverviewPermissions,
	reviewerOptions?: ReviewersSectionOptions,
	testerOptions?: TestersSectionOptions,
	assigneeOptions?: AssigneesSectionOptions,
): string {
	return getOverviewHtml(detail, nonce, renderConversationSection(detail, snapshot, diffContexts), relatedIssuesHtml, editOptions, true, activityHtml, permissions, reviewerOptions, testerOptions, assigneeOptions);
}

export function getOverviewWithTimelineHtml(
	detail: PullRequestDetail,
	commentsSnapshot: PullRequestCommentsSnapshot,
	nonce: string,
	relatedIssuesHtml?: string,
	editOptions?: EditPullRequestOptions,
	diffContexts?: ReadonlyMap<string, DiffCommentContext>,
	activitySnapshot?: PullRequestOperationLogsSnapshot,
	activityError?: string,
	permissions?: PullRequestOverviewPermissions,
	reviewerOptions?: ReviewersSectionOptions,
	testerOptions?: TestersSectionOptions,
	assigneeOptions?: AssigneesSectionOptions,
): string {
	return getOverviewHtml(
		detail,
		nonce,
		renderTimelineSection(detail, commentsSnapshot, activitySnapshot, { diffContexts, activityError }),
		relatedIssuesHtml,
		editOptions,
		true,
		undefined,
		permissions,
		reviewerOptions,
		testerOptions,
		assigneeOptions,
	);
}

export function getOverviewWithCommentsLoadingHtml(detail: PullRequestDetail, nonce: string, relatedIssuesHtml?: string, editOptions?: EditPullRequestOptions, activityHtml?: string, permissions?: PullRequestOverviewPermissions, reviewerOptions?: ReviewersSectionOptions, testerOptions?: TestersSectionOptions, assigneeOptions?: AssigneesSectionOptions): string {
	return getOverviewHtml(detail, nonce, renderTimelineLoading(detail), relatedIssuesHtml, editOptions, false, activityHtml, permissions, reviewerOptions, testerOptions, assigneeOptions);
}

export function getOverviewWithCommentsErrorHtml(detail: PullRequestDetail, errorMessage: string, nonce: string, relatedIssuesHtml?: string, editOptions?: EditPullRequestOptions, activityHtml?: string, permissions?: PullRequestOverviewPermissions, reviewerOptions?: ReviewersSectionOptions, testerOptions?: TestersSectionOptions, assigneeOptions?: AssigneesSectionOptions): string {
	return getOverviewHtml(detail, nonce, renderTimelineError(detail, errorMessage), relatedIssuesHtml, editOptions, true, activityHtml, permissions, reviewerOptions, testerOptions, assigneeOptions);
}

export function getOverviewLoadingHtml(title: string, description: string, nonce: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(title)}</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			margin: 0;
			padding: 32px;
		}
		.card {
			max-width: 720px;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 10px;
			padding: 20px;
			background: var(--vscode-sideBar-background, rgba(127,127,127,0.08));
		}
		.spinner {
			width: 20px;
			height: 20px;
			border: 2px solid var(--vscode-panel-border);
			border-top-color: var(--vscode-button-background);
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
			margin-bottom: 16px;
		}
		@keyframes spin { to { transform: rotate(360deg); } }
		p { color: var(--vscode-descriptionForeground); }
	</style>
</head>
<body>
	<div class="card">
		<div class="spinner"></div>
		<h1>${escapeHtml(title)}</h1>
		<p>${escapeHtml(description)}</p>
	</div>
</body>
</html>`;
}

export function getOverviewErrorHtml(title: string, description: string, nonce: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(title)}</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			margin: 0;
			padding: 32px;
		}
		.card {
			max-width: 720px;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 10px;
			padding: 20px;
			background: var(--vscode-sideBar-background, rgba(127,127,127,0.08));
		}
		button {
			margin-top: 16px;
			border: 1px solid var(--vscode-panel-border);
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			padding: 8px 14px;
			border-radius: 6px;
			cursor: pointer;
		}
		p { color: var(--vscode-descriptionForeground); }
	</style>
</head>
<body>
	<div class="card">
		<h1>${escapeHtml(title)}</h1>
		<p>${escapeHtml(description)}</p>
		<button id="refresh-button">Retry</button>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		document.getElementById('refresh-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'refresh' });
		});
	</script>
</body>
</html>`;
}
