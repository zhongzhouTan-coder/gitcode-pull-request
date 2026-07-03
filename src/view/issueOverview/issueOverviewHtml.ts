import {
	EditIssueOptions,
	IssueComment,
	IssueCommentsSnapshot,
	IssueDetail,
	IssueLabel,
	IssueOperationLog,
	IssueOperationLogsSnapshot,
	IssueOverviewPermissions,
	IssueRelatedPullRequest,
	IssueRelatedPullRequestsSnapshot,
	IssueUser,
} from '../../common/models';
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
	return escapeHtml(value);
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

function formatActivityDate(value: string | undefined): string {
	if (!value) {
		return 'Unknown time';
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
}

function isSafeHttpUrl(value: string | undefined): boolean {
	if (!value) {
		return false;
	}

	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function labelColor(color: string | undefined): string {
	if (!color) {
		return '#d0d7de';
	}

	return color.startsWith('#') ? color : `#${color}`;
}

/** External-link icon (16×16). */
const EXTERNAL_LINK_ICON = `<svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
	<path d="M3 2v11h11V8.5h1V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h4.5v1H3Zm5.5 0V1H15v6.5h-1V2.7L7.9 8.9l-.8-.8L13.3 2H8.5Z" fill="currentColor"/>
</svg>`;

/** Git branch icon (16×16). */
const BRANCH_ICON = `<svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
	<path d="M4 1.5a2 2 0 0 1 1 3.73v5.54A3.5 3.5 0 0 0 8 7.31l.01-.4A2 2 0 1 1 9.5 6.95v.36A5 5 0 0 1 5 12.25v.52a2 2 0 1 1-1.5 0V5.23A2 2 0 0 1 4 1.5Zm0 1.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Zm6 1.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Zm-6 9a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Z" fill="currentColor"/>
</svg>`;

/** Compact pencil/edit icon for section editing. */
const PENCIL_ICON = `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
	<path d="M11.01 1.427a1.75 1.75 0 0 1 2.475 0l1.088 1.088a1.75 1.75 0 0 1 0 2.475l-8.5 8.5a1.75 1.75 0 0 1-.78.448l-3.08.88a.75.75 0 0 1-.927-.927l.88-3.08a1.75 1.75 0 0 1 .448-.78l8.5-8.5Zm1.414 1.06a.25.25 0 0 0-.353 0l-1.057 1.056 1.44 1.44 1.056-1.057a.25.25 0 0 0 0-.353l-1.086-1.086Zm-2.47 2.117L3.675 10.88a.25.25 0 0 0-.064.112l-.533 1.866 1.866-.533a.25.25 0 0 0 .112-.064l6.278-6.278-1.44-1.44Z"/>
</svg>`;

function stateBadgeClass(state: 'open' | 'closed'): string {
	return state === 'closed' ? 'badge-closed' : 'badge-open';
}

function stateLabel(state: 'open' | 'closed'): string {
	return state === 'closed' ? 'Closed' : 'Open';
}

function renderLabels(labels: IssueLabel[]): string {
	if (!labels.length) {
		return '<div class="empty">None</div>';
	}

	return `<div class="labels">${labels.map((label) => (
		`<span class="label-chip" style="--label-color:${escapeHtml(labelColor(label.color))}">${escapeHtml(label.name)}</span>`
	)).join('')}</div>`;
}

function renderUserAvatar(user: IssueUser): string {
	const initial = (user.name || user.login)[0]?.toUpperCase() || '?';
	if (user.avatarUrl) {
		try {
			const url = new URL(user.avatarUrl);
			if (url.protocol === 'https:') {
				return `<img class="user-avatar" src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.login)}" loading="lazy" onerror="this.outerHTML='<span class=\\'user-avatar user-avatar-initials\\'>${escapeHtml(initial)}</span>'">`;
			}
		} catch {
			// Fall through to initials for malformed API data.
		}
	}
	return `<span class="user-avatar user-avatar-initials">${escapeHtml(initial)}</span>`;
}

function renderUsers(users: IssueUser[]): string {
	if (!users.length) {
		return '<div class="empty">None</div>';
	}

	return `<div class="assignee-list">${users.map((u) => {
		const display = u.name && u.name !== u.login
			? `<span>${escapeHtml(u.name)}</span><span class="muted">@${escapeHtml(u.login)}</span>`
			: `@${escapeHtml(u.login)}`;
		const content = `${renderUserAvatar(u)}<span class="assignee-name">${display}</span>`;
		if (u.htmlUrl) {
			return `<button class="participant-btn assignee-row" data-action="openUrl" data-url="${escapeHtml(u.htmlUrl)}" title="${escapeHtml(u.login)}">${content}</button>`;
		}
		return `<span class="assignee-row">${content}</span>`;
	}).join('')}</div>`;
}

function renderMilestone(detail: IssueDetail): string {
	if (!detail.milestone) {
		return '<div class="empty">None</div>';
	}

	return `<div class="sidebar-value">${escapeHtml(detail.milestone.title)}</div>`;
}

function renderDateRows(detail: IssueDetail): string {
	const rows = [
		['Created', detail.createdAt],
		['Updated', detail.updatedAt],
		...(detail.finishedAt ? [['Finished', detail.finishedAt]] as [string, string][] : []),
	] as [string, string | undefined][];

	return `<div class="date-list">${rows.map(([label, value]) => `<div class="date-row">
		<span class="date-label">${escapeHtml(label)}</span>
		<span class="date-value">${escapeHtml(formatDate(value))}</span>
	</div>`).join('')}</div>`;
}

function renderRepository(detail: IssueDetail): string {
	const repo = detail.repository;
	const repoName = repo.name ?? repo.fullName.split('/').at(-1) ?? repo.fullName;
	const owner = repo.fullName.includes('/') ? repo.fullName.split('/').slice(0, -1).join('/') : '';
	const rows = [
		owner ? ['Owner', owner] : undefined,
		['Name', repoName],
		['Full name', repo.fullName],
		repo.path && repo.path !== repoName ? ['Path', repo.path] : undefined,
		detail.visibilityReason ? ['Visibility', detail.visibilityReason] : undefined,
	].filter((row): row is [string, string] => Boolean(row));
	const description = repo.description
		? `<div class="repository-description">${escapeHtml(repo.description)}</div>`
		: '';

	return `<div class="repository-block">
		<div class="repository-title">${escapeHtml(owner ? `${owner}/${repoName}` : repoName)}</div>
		${description}
		<div class="repository-rows">
			${rows.map(([label, value]) => `<div class="repository-row">
				<span class="repository-label">${escapeHtml(label)}</span>
				<span class="repository-value">${escapeHtml(value)}</span>
			</div>`).join('')}
		</div>
	</div>`;
}

function renderEditButton(section: string, label: string, disabled: boolean = false): string {
	return `<div class="edit-icon-slot"><button class="edit-icon-btn" data-section="${escapeAttr(section)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}" ${disabled ? 'disabled' : ''}>${PENCIL_ICON}</button></div>`;
}

function renderSidebarSection(
	title: string,
	section: string,
	readHtml: string,
	editHtml: string,
	options: { editLabel: string; editable: boolean },
): string {
	return `<div class="meta-group editable-section" data-section-container="${escapeAttr(section)}">
		<div class="section-header-row">
			<h3>${escapeHtml(title)}</h3>
			${renderEditButton(section, options.editLabel, !options.editable)}
		</div>
		<div class="section-read-area" data-section-read="${escapeAttr(section)}">${readHtml}</div>
		<div class="section-edit-area" data-section-edit="${escapeAttr(section)}" style="display:none">${editHtml}</div>
		<div class="section-error" data-section-error="${escapeAttr(section)}"></div>
	</div>`;
}

function renderAssigneeOptions(detail: IssueDetail, editOptions?: EditIssueOptions): string {
	if (!editOptions) {
		return '<div class="section-unavailable">Repository member options are unavailable.</div>';
	}

	if (editOptions.assignees.length === 0) {
		return '<div class="empty">No repository members available.</div>';
	}

	const selected = new Set(detail.assignees.map((user) => user.login));
	return `<div class="option-list">${editOptions.assignees.map((user) => `<label class="option-row">
		<input type="checkbox" data-assignee-option="${escapeAttr(user.login)}" ${selected.has(user.login) ? 'checked' : ''}>
		<span>${user.name && user.name !== user.login ? `${escapeHtml(user.name)} <span class="muted">@${escapeHtml(user.login)}</span>` : `@${escapeHtml(user.login)}`}</span>
	</label>`).join('')}</div>`;
}

function renderLabelOptions(detail: IssueDetail, editOptions?: EditIssueOptions): string {
	if (!editOptions) {
		return '<div class="section-unavailable">Repository label options are unavailable.</div>';
	}

	if (editOptions.labels.length === 0) {
		return '<div class="empty">No repository labels available.</div>';
	}

	const selected = new Set(detail.labels.map((label) => label.name));
	return `<div class="option-list">${editOptions.labels.map((label) => `<label class="option-row option-row-label">
		<input type="checkbox" data-label-option="${escapeAttr(label.name)}" ${selected.has(label.name) ? 'checked' : ''}>
		<span class="label-chip" style="--label-color:${escapeHtml(labelColor(label.color))}">${escapeHtml(label.name)}</span>
	</label>`).join('')}</div><div class="edit-help">Select labels from the repository label list.</div>`;
}

function renderMilestoneOptions(detail: IssueDetail, editOptions?: EditIssueOptions): string {
	if (!editOptions) {
		return '<div class="section-unavailable">Repository milestone options are unavailable.</div>';
	}

	const currentMilestone = detail.milestone?.number;
	return `<div class="option-list">${[
		`<label class="option-row"><input type="radio" name="issue-milestone" data-section-input="milestone" value="" ${currentMilestone === undefined ? 'checked' : ''}><span>No milestone</span></label>`,
		...editOptions.milestones.map((milestone) => `<label class="option-row"><input type="radio" name="issue-milestone" data-section-input="milestone" value="${milestone.number}" ${milestone.number === currentMilestone ? 'checked' : ''}><span>${escapeHtml(milestone.title)}</span></label>`),
	].join('')}</div>`;
}

function renderSidebar(detail: IssueDetail, editOptions?: EditIssueOptions): string {
	return `
		<div class="card sidebar-card">
			${renderSidebarSection(
				'Assignees',
				'assignees',
				renderUsers(detail.assignees),
				`${renderAssigneeOptions(detail, editOptions)}<div class="section-actions-inline"><button class="btn-primary btn-save-section" data-section="assignees">Save</button><button class="btn-secondary btn-cancel-section" data-section="assignees">Cancel</button></div>`,
				{ editLabel: 'Edit assignees', editable: Boolean(editOptions) },
			)}
			${renderSidebarSection(
				'Labels',
				'labels',
				renderLabels(detail.labels),
				`${renderLabelOptions(detail, editOptions)}<div class="section-actions-inline"><button class="btn-primary btn-save-section" data-section="labels">Save</button><button class="btn-secondary btn-cancel-section" data-section="labels">Cancel</button></div>`,
				{ editLabel: 'Edit labels', editable: Boolean(editOptions) },
			)}
			${renderSidebarSection(
				'Milestone',
				'milestone',
				renderMilestone(detail),
				`${renderMilestoneOptions(detail, editOptions)}<div class="section-actions-inline"><button class="btn-primary btn-save-section" data-section="milestone">Save</button><button class="btn-secondary btn-cancel-section" data-section="milestone">Cancel</button></div>`,
				{ editLabel: 'Edit milestone', editable: Boolean(editOptions) },
			)}
			${detail.securityHole === undefined ? '' : renderSidebarSection(
				'Security issue',
				'securityHole',
				`<div class="sidebar-value">${detail.securityHole ? 'Yes' : 'No'}</div>`,
				`<label class="checkbox-row"><input type="checkbox" data-section-input="securityHole" ${detail.securityHole ? 'checked' : ''}><span>Private/security issue</span></label><div class="section-actions-inline"><button class="btn-primary btn-save-section" data-section="securityHole">Save</button><button class="btn-secondary btn-cancel-section" data-section="securityHole">Cancel</button></div>`,
				{ editLabel: 'Edit security issue', editable: true },
			)}
		</div>
		<div class="card sidebar-card">
			<div class="sidebar-field-grid">
				<div class="sidebar-field">
					<span class="sidebar-field-label">Type</span>
					<span class="sidebar-value">${escapeHtml(detail.issueTypeDetail?.title ?? detail.issueType ?? 'None')}</span>
				</div>
				<div class="sidebar-field">
					<span class="sidebar-field-label">Priority</span>
					<span class="sidebar-value">${escapeHtml(detail.priorityDetail?.title ?? 'None')}</span>
				</div>
				<div class="sidebar-field">
					<span class="sidebar-field-label">Workflow</span>
					<span class="sidebar-value">${escapeHtml(detail.issueStateDetail?.title ?? detail.issueState ?? 'None')}</span>
				</div>
				<div class="sidebar-field">
					<span class="sidebar-field-label">Comments</span>
					<span class="sidebar-value">${detail.comments}</span>
				</div>
			</div>
		</div>
		<div class="card sidebar-card">
			<div class="meta-group">
				<h3>Dates</h3>
				${renderDateRows(detail)}
			</div>
			<div class="meta-group">
				<h3>Repository</h3>
				${renderRepository(detail)}
			</div>
		</div>`;
}

export interface IssueOverviewHtmlOptions {
	detail: IssueDetail;
	comments?: IssueCommentsSnapshot;
	commentsError?: Error;
	operationLogs?: IssueOperationLogsSnapshot;
	operationLogsError?: Error;
	relatedPullRequests?: IssueRelatedPullRequestsSnapshot;
	relatedPullRequestsError?: Error;
	editOptions?: EditIssueOptions;
	permissions?: IssueOverviewPermissions;
	nonce: string;
	includeScripts?: boolean;
}

function renderCommentAvatar(author: IssueComment['author']): string {
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

function renderCommentAuthor(author: IssueComment['author']): string {
	const display = author.name && author.name !== author.login
		? `${escapeHtml(author.name)} (@${escapeHtml(author.login)})`
		: `@${escapeHtml(author.login)}`;
	if (isSafeHttpUrl(author.htmlUrl)) {
		return `<button class="participant-btn" data-action="openUrl" data-url="${escapeHtml(author.htmlUrl ?? '')}" title="${escapeHtml(author.login)}">${display}</button>`;
	}
	return `<span>${display}</span>`;
}

function renderActorDisplay(actor: IssueOperationLog['actor']): string {
	if (actor.name && actor.name !== actor.login) {
		return `${escapeHtml(actor.name)} <span class="muted">@${escapeHtml(actor.login)}</span>`;
	}

	return `@${escapeHtml(actor.login)}`;
}

function renderTimelineActor(actor: IssueOperationLog['actor']): string {
	const display = renderActorDisplay(actor);
	if (isSafeHttpUrl(actor.htmlUrl)) {
		return `<button class="participant-btn timeline-actor" data-action="openUrl" data-url="${escapeHtml(actor.htmlUrl ?? '')}" title="${escapeHtml(actor.login)}">${display}</button>`;
	}

	return `<span class="timeline-actor">${display}</span>`;
}

function renderIssueCommentTimelineItem(comment: IssueComment): string {
	const bodyHtml = comment.body
		? renderMarkdown(comment.body)
		: '<div class="empty">No comment body provided.</div>';

	const updated = comment.updatedAt && comment.updatedAt !== comment.createdAt
		? `<span class="comment-edited" title="Edited ${escapeHtml(formatActivityDate(comment.updatedAt))}">· Edited</span>`
		: '';

	return `<div class="comment-card timeline-item timeline-comment">
	<div class="comment-header">
		${renderCommentAvatar(comment.author)}
		${renderCommentAuthor(comment.author)}
		<span class="comment-time">${escapeHtml(formatActivityDate(comment.createdAt))}</span>
		${updated}
	</div>
	<div class="comment-body description">${bodyHtml}</div>
</div>`;
}

function renderIssueOperationLogAvatar(actor: IssueOperationLog['actor']): string {
	const initial = (actor.name || actor.login)[0]?.toUpperCase() || '?';
	return `<span class="avatar-initials timeline-avatar">${escapeHtml(initial)}</span>`;
}

function renderIssueOperationLogTimelineItem(log: IssueOperationLog): string {
	return `<div class="timeline-item timeline-activity">
		<div class="timeline-header">
			${renderIssueOperationLogAvatar(log.actor)}
			${renderTimelineActor(log.actor)}
			<span class="comment-time">${escapeHtml(formatActivityDate(log.createdAt))}</span>
		</div>
		<div class="timeline-activity-body">
			<span class="timeline-activity-content">${escapeHtml(log.content)}</span>
			<span class="timeline-activity-badge">${escapeHtml(log.actionType || 'activity')}</span>
		</div>
	</div>`;
}

type IssueTimelineEntry =
	| { kind: 'comment'; id: string; createdAt: string; comment: IssueComment }
	| { kind: 'log'; id: string; createdAt: string; log: IssueOperationLog };

function compareEntryIds(a: string, b: string): number {
	const numberA = Number(a);
	const numberB = Number(b);

	if (!Number.isNaN(numberA) && !Number.isNaN(numberB) && numberA !== numberB) {
		return numberA - numberB;
	}

	return 0;
}

function mergeIssueTimelineEntries(
	comments: readonly IssueComment[] | undefined,
	logs: readonly IssueOperationLog[] | undefined,
): readonly IssueTimelineEntry[] {
	const entries: IssueTimelineEntry[] = [
		...(comments ?? []).map((comment) => ({
			kind: 'comment' as const,
			id: comment.id,
			createdAt: comment.createdAt,
			comment,
		})),
		...(logs ?? []).map((log) => ({
			kind: 'log' as const,
			id: log.id,
			createdAt: log.createdAt,
			log,
		})),
	];

	return entries.sort((a, b) => {
		const dateA = new Date(a.createdAt).getTime();
		const dateB = new Date(b.createdAt).getTime();
		const hasValidDates = !Number.isNaN(dateA) && !Number.isNaN(dateB);

		if (hasValidDates && dateA !== dateB) {
			return dateA - dateB;
		}

		if (a.kind !== b.kind) {
			return a.kind === 'comment' ? -1 : 1;
		}

		return compareEntryIds(a.id, b.id);
	});
}

function prStateLabel(state: 'open' | 'closed' | 'merged'): string {
	switch (state) {
		case 'merged': return 'Merged';
		case 'closed': return 'Closed';
		default: return 'Open';
	}
}

function prStateBadgeClass(state: 'open' | 'closed' | 'merged'): string {
	switch (state) {
		case 'merged': return 'badge-merged';
		case 'closed': return 'badge-closed';
		default: return 'badge-open';
	}
}

function renderRelatedPullRequest(pr: IssueRelatedPullRequest): string {
	const branchInfo = `${escapeHtml(pr.source.ref)} → ${escapeHtml(pr.target.ref)}`;
	const labelsHtml = pr.labels.length
		? `<div class="labels">${pr.labels.map((l) => (
			`<span class="label-chip" style="--label-color:${escapeHtml(labelColor(l.color))}">${escapeHtml(l.name)}</span>`
		)).join('')}</div>`
		: '';

	const externalLink = pr.url
		? `<button class="pr-external-btn" data-action="openUrl" data-url="${escapeHtml(pr.url)}" title="Open on GitCode">${EXTERNAL_LINK_ICON}</button>`
		: '';

	return `<div class="related-pr-item">
		<div class="related-pr-main">
			<button class="related-pr-title-btn" data-action="openRelatedPullRequest" data-pr-number="${pr.number}" data-pr-url="${escapeHtml(pr.url ?? '')}" data-pr-target-repository="${escapeHtml(pr.target.repositoryFullName ?? '')}">
				<span class="badge ${prStateBadgeClass(pr.state)}">${prStateLabel(pr.state)}</span>
				<span class="related-pr-title">${escapeHtml(pr.title)}</span>
				<span class="muted">#${pr.number}</span>
			</button>
			${externalLink}
		</div>
		<div class="related-pr-meta">
			<span>@${escapeHtml(pr.author.login)}</span>
			<span class="muted">·</span>
			<span>${branchInfo}</span>
			<span class="muted">·</span>
			<span>${escapeHtml(formatDate(pr.updatedAt))}</span>
			${pr.canMergeCheck !== undefined ? `<span class="muted">·</span><span class="merge-hint ${pr.canMergeCheck ? 'merge-ok' : 'merge-blocked'}">${pr.canMergeCheck ? 'Can merge' : 'Merge blocked'}</span>` : ''}
		</div>
		${labelsHtml}
	</div>`;
}

function renderRelatedPullRequests(
	pullRequests: readonly IssueRelatedPullRequest[] | undefined,
	error: Error | undefined,
): string {
	if (error) {
		return `<section>
	<h2>Related Pull Requests</h2>
	<div class="error">Unable to load related pull requests</div>
</section>`;
	}

	if (!pullRequests) {
		return '';
	}

	if (pullRequests.length === 0) {
		return `<section>
	<h2>Related Pull Requests</h2>
	<div class="empty">No related pull requests</div>
</section>`;
	}

	return `<section>
	<h2>Related Pull Requests (${pullRequests.length})</h2>
	<div class="related-pr-list">${pullRequests.map(renderRelatedPullRequest).join('')}</div>
</section>`;
}

function renderStateActionButton(detail: IssueDetail): string {
	const stateAction = detail.state === 'open' ? 'close' : 'reopen';
	const stateActionLabel = detail.state === 'open' ? 'Close issue' : 'Reopen issue';
	return `<button id="state-action-button" type="button" class="secondary" data-state-action="${stateAction}">${stateActionLabel}</button>`;
}

function renderCommentComposer(detail: IssueDetail): string {
	return `<form class="comment-composer" data-action="submitIssueComment">
	<textarea class="comment-input" name="body" placeholder="Write a comment..." rows="3"></textarea>
	<div class="comment-composer-actions">
		<div class="main-state-actions">
			${renderStateActionButton(detail)}
		</div>
		<button type="submit" class="btn-primary">Comment</button>
	</div>
	<div class="comment-composer-feedback">
		<div class="action-error comment-action-error" id="state-action-error"></div>
		<span class="comment-submit-error" style="color:var(--danger);font-size:12px" hidden></span>
	</div>
</form>`;
}

function renderTimeline(
	detail: IssueDetail,
	comments: readonly IssueComment[] | undefined,
	operationLogs: readonly IssueOperationLog[] | undefined,
	commentsError: Error | undefined,
	operationLogsError: Error | undefined,
): string {
	const composerHtml = renderCommentComposer(detail);
	const entries = mergeIssueTimelineEntries(comments, operationLogs);
	const showCount = comments !== undefined && operationLogs !== undefined;
	const heading = showCount ? `Timeline (${entries.length})` : 'Timeline';
	const body: string[] = [];

	if (entries.length > 0) {
		body.push(entries.map((entry) => entry.kind === 'comment'
			? renderIssueCommentTimelineItem(entry.comment)
			: renderIssueOperationLogTimelineItem(entry.log)).join(''));
	}

	if (commentsError) {
		body.push(`<div class="error">Unable to load comments${commentsError.message ? `: ${escapeHtml(commentsError.message)}` : ''}</div>`);
	}

	if (operationLogsError) {
		body.push(`<div class="error">Unable to load activity${operationLogsError.message ? `: ${escapeHtml(operationLogsError.message)}` : ''}</div>`);
	}

	if (!commentsError && !operationLogsError && entries.length === 0) {
		if (comments === undefined || operationLogs === undefined) {
			body.push('<div class="timeline-status muted">Loading activity...</div>');
		} else {
			body.push('<div class="empty">No activity yet.</div>');
		}
	} else if (!operationLogsError && operationLogs === undefined) {
		body.push('<div class="timeline-status muted">Loading activity...</div>');
	}

	return `<section>
	<h2>${heading}</h2>
	${body.join('')}
	${composerHtml}
</section>`;
}

export function getIssueOverviewHtml(options: IssueOverviewHtmlOptions): string {
	const {
		detail,
		comments,
		commentsError,
		operationLogs,
		operationLogsError,
		relatedPullRequests,
		relatedPullRequestsError,
		editOptions,
		nonce,
		includeScripts = true,
	} = options;

	const descriptionHtml = detail.body
		? renderMarkdown(detail.body)
		: '<div class="empty">No description provided.</div>';

	const openOnWebDisabled = detail.url ? '' : 'disabled';
	const editOptionsJson = editOptions
		? serializeForInlineScript({
			assignees: editOptions.assignees.map((user) => ({ login: user.login, name: user.name })),
			labels: editOptions.labels.map((label) => ({ id: label.id, name: label.name, color: label.color })),
			milestones: editOptions.milestones.map((milestone) => ({ number: milestone.number, title: milestone.title, state: milestone.state })),
		})
		: 'null';
	const permissions = options.permissions;
	const permissionsJson = permissions
		? serializeForInlineScript(permissions)
		: 'null';
	const detailSnapshotJson = serializeForInlineScript({
		title: detail.title,
		body: detail.body,
		state: detail.state,
		assigneeLogins: detail.assignees.map((user) => user.login),
		labelNames: detail.labels.map((label) => label.name),
		milestoneNumber: detail.milestone?.number ?? null,
		securityHole: detail.securityHole ?? null,
	});

	// Extra badges
	const extraBadges: string[] = [];
	if (detail.issueState) {
		extraBadges.push(`<span class="badge badge-state">${escapeHtml(detail.issueState)}</span>`);
	}
	if (detail.issueType) {
		extraBadges.push(`<span class="badge badge-type">${escapeHtml(detail.issueType)}</span>`);
	}

	const timelineHtml = renderTimeline(
		detail,
		comments?.comments,
		operationLogs?.logs,
		commentsError,
		operationLogsError,
	);

	const relatedPrsHtml = renderRelatedPullRequests(
		relatedPullRequests?.pullRequests,
		relatedPullRequestsError,
	);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Issue #${detail.number}</title>
	<style>
		:root {
			color-scheme: light dark;
			--border: var(--vscode-panel-border, #30363d);
			--muted: var(--vscode-descriptionForeground, #8b949e);
			--badge-open: #1f883d;
			--badge-closed: #cf222e;
			--badge-state: #8250df;
			--badge-type: #0969da;
			--card: var(--vscode-sideBar-background, rgba(127,127,127,0.08));
			--danger: var(--vscode-errorForeground, #f85149);
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
		.title-edit-section {
			flex: 1 1 320px;
			min-width: 0;
		}
		.title-heading-row {
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 0;
		}
		.title-heading-row [data-section-read="title"] {
			min-width: 0;
		}
		.meta-row { color: var(--muted); display: flex; flex-wrap: wrap; gap: 12px; }
		.badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: white; }
		.badge-open { background: var(--badge-open); }
		.badge-closed { background: var(--badge-closed); }
		.badge-state { background: var(--badge-state); }
		.badge-type { background: var(--badge-type); }
		.actions { margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap; }
		.main-state-actions {
			display: flex;
			align-items: center;
			justify-content: flex-start;
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
		.section-header-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			margin-bottom: 8px;
		}
		.section-header-row h2,
		.section-header-row h3 {
			margin-bottom: 0;
		}
		.edit-icon-slot {
			width: 32px;
			display: flex;
			justify-content: flex-end;
			flex-shrink: 0;
		}
		.edit-icon-btn {
			width: 28px;
			height: 28px;
			justify-content: center;
			padding: 0;
			background: transparent;
			color: var(--muted);
			opacity: 0.75;
		}
		.editable-section:hover .edit-icon-btn:not(:disabled),
		.edit-icon-btn:focus-visible {
			opacity: 1;
			color: var(--vscode-foreground);
		}
		.section-read-area,
		.section-edit-area {
			min-width: 0;
		}
		.section-edit-area input[type="text"],
		.section-edit-area textarea {
			width: 100%;
			box-sizing: border-box;
			padding: 8px 10px;
			border-radius: 6px;
			border: 1px solid var(--border);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font: inherit;
		}
		.section-edit-area textarea {
			resize: vertical;
			min-height: 140px;
		}
		.section-actions-inline {
			display: flex;
			gap: 8px;
			margin-top: 10px;
			flex-wrap: wrap;
		}
		.btn-primary {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		.btn-secondary {
			background: transparent;
			color: var(--vscode-foreground);
		}
		.section-error,
		.action-error {
			color: var(--danger);
			font-size: 12px;
			min-height: 18px;
			margin-top: 8px;
		}
		.section-unavailable,
		.edit-help {
			color: var(--muted);
			font-size: 12px;
		}
		.option-list {
			display: flex;
			flex-direction: column;
			gap: 8px;
			max-height: 220px;
			overflow-y: auto;
			padding: 6px;
			border: 1px solid var(--border);
			border-radius: 8px;
			background: color-mix(in srgb, var(--card) 82%, var(--vscode-editor-background, transparent));
		}
		.option-row,
		.checkbox-row {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.option-row-label {
			align-items: center;
		}
		.checkbox-row input,
		.option-row input {
			margin: 0;
		}
		.title-value {
			font-size: 18px;
			font-weight: 700;
			line-height: 1.4;
		}
		.meta-list { margin: 0; padding-left: 18px; }
		.meta-list li { margin: 4px 0; }
		.sidebar-card {
			background: color-mix(in srgb, var(--card) 94%, var(--vscode-editor-background, transparent));
		}
		.sidebar-value {
			font-size: 13px;
			font-weight: 550;
			overflow-wrap: anywhere;
		}
		.sidebar-field-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
		}
		.sidebar-field {
			min-width: 0;
			padding: 9px 10px;
			border: 1px solid var(--border);
			border-radius: 8px;
			background: color-mix(in srgb, var(--card) 82%, var(--vscode-editor-background, transparent));
		}
		.sidebar-field-label {
			display: block;
			margin-bottom: 3px;
			color: var(--muted);
			font-size: 11px;
			font-weight: 700;
			letter-spacing: 0.04em;
			text-transform: uppercase;
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
		.assignee-list {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}
		.assignee-row {
			display: flex;
			align-items: center;
			gap: 8px;
			width: 100%;
			min-width: 0;
			padding: 4px 6px;
			margin: 0;
			border-radius: 7px;
		}
		.user-avatar {
			width: 24px;
			height: 24px;
			border-radius: 999px;
			flex: 0 0 auto;
			object-fit: cover;
		}
		.user-avatar-initials {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 18%, transparent);
			color: var(--vscode-textLink-foreground, #58a6ff);
			font-size: 11px;
			font-weight: 700;
		}
		.assignee-name {
			display: flex;
			flex-direction: column;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			line-height: 1.25;
		}
		.participant-btn {
			border: none;
			background: none;
			color: var(--vscode-textLink-foreground);
			font: inherit;
			cursor: pointer;
			padding: 2px 4px;
			border-radius: 4px;
		}
		.participant-btn:hover {
			background: color-mix(in srgb, var(--vscode-textLink-foreground, #58a6ff) 12%, transparent);
		}
		.participant-btn.assignee-row {
			color: inherit;
			padding: 4px 6px;
		}
		.date-list {
			display: flex;
			flex-direction: column;
			gap: 7px;
		}
		.date-row {
			display: grid;
			grid-template-columns: 62px minmax(0, 1fr);
			gap: 10px;
			align-items: baseline;
		}
		.date-label {
			font-size: 11px;
			font-weight: 700;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}
		.date-value {
			font-size: 12px;
			overflow-wrap: anywhere;
		}
		.repository-block {
			min-width: 0;
		}
		.repository-title {
			margin-bottom: 7px;
			font-weight: 700;
			overflow-wrap: anywhere;
		}
		.repository-description {
			margin-bottom: 8px;
			color: var(--muted);
			font-size: 12px;
			overflow-wrap: anywhere;
		}
		.repository-rows {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}
		.repository-row {
			display: grid;
			grid-template-columns: 72px minmax(0, 1fr);
			gap: 8px;
			align-items: baseline;
		}
		.repository-label {
			color: var(--muted);
			font-size: 11px;
			font-weight: 700;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}
		.repository-value {
			font-family: var(--vscode-editor-font-family);
			font-size: 12px;
			overflow-wrap: anywhere;
		}
		.muted, .empty { color: var(--muted); }
		.error { color: var(--vscode-errorForeground, #f85149); padding: 8px 0; }
		.related-pr-list { display: flex; flex-direction: column; gap: 12px; }
		.related-pr-item {
			padding: 12px;
			border: 1px solid var(--border);
			border-radius: 8px;
			background: var(--vscode-editor-background, rgba(127,127,127,0.04));
		}
		.related-pr-main {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 8px;
			margin-bottom: 6px;
		}
		.related-pr-title-btn {
			border: none;
			background: none;
			color: var(--vscode-foreground);
			font: inherit;
			cursor: pointer;
			text-align: left;
			padding: 0;
			display: inline-flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 6px;
		}
		.related-pr-title-btn:hover .related-pr-title {
			color: var(--vscode-textLink-foreground);
		}
		.related-pr-title {
			font-weight: 600;
		}
		.pr-external-btn {
			border: none;
			background: none;
			color: var(--muted);
			cursor: pointer;
			padding: 2px;
			flex-shrink: 0;
		}
		.pr-external-btn:hover { color: var(--vscode-textLink-foreground); }
		.related-pr-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			font-size: 13px;
			color: var(--muted);
			margin-bottom: 6px;
		}
		.merge-hint { font-weight: 600; }
		.merge-ok { color: var(--badge-open); }
		.merge-blocked { color: var(--badge-closed); }
		.badge-merged { background: #8250df; }
		.timeline-item {
			border-top: 1px solid var(--border);
			padding: 12px 0;
		}
		.timeline-item:first-of-type {
			border-top: none;
		}
		.timeline-header {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 6px;
			margin-bottom: 8px;
			color: var(--muted);
			font-size: 13px;
		}
		.timeline-avatar {
			flex: 0 0 auto;
		}
		.timeline-actor {
			padding: 0;
		}
		.timeline-activity-body {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding-left: 34px;
		}
		.timeline-activity-content {
			flex: 1;
			overflow-wrap: anywhere;
		}
		.timeline-activity-badge {
			display: inline-flex;
			align-items: center;
			padding: 2px 8px;
			border-radius: 999px;
			border: 1px solid var(--border);
			font-size: 11px;
			text-transform: lowercase;
			color: var(--muted);
			white-space: nowrap;
		}
		.timeline-status {
			padding: 8px 0;
		}
		.comment-card {
			border: 1px solid var(--border);
			border-radius: 10px;
			padding: 16px;
			background: var(--card);
		}
		.timeline-comment {
			border-top: 1px solid var(--border);
		}
		.timeline-comment:first-of-type {
			border-top: 1px solid var(--border);
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
		.comment-header {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 6px;
			margin-bottom: 8px;
			color: var(--muted);
			font-size: 13px;
		}
		.comment-time {
			color: var(--muted);
		}
		.comment-edited {
			color: var(--muted);
			font-style: italic;
		}
		.comment-body {
			padding: 0;
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
		.comment-composer {
			margin-top: 16px;
			padding-top: 16px;
			border-top: 1px solid var(--border);
		}
		.comment-input {
			width: 100%;
			box-sizing: border-box;
			padding: 8px 10px;
			border-radius: 6px;
			border: 1px solid var(--border);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font: inherit;
			resize: vertical;
			min-height: 60px;
		}
		.comment-input:disabled {
			opacity: 0.6;
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
		.comment-composer-actions {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			margin-top: 8px;
			flex-wrap: wrap;
		}
		.comment-composer-feedback {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 12px;
			margin-top: 8px;
			flex-wrap: wrap;
		}
		.comment-action-error {
			flex: 1 1 260px;
			margin: 0;
		}
		.comment-submit-error {
			flex: 1 1 260px;
			min-width: 0;
			text-align: right;
		}
		@media (max-width: 900px) {
			.layout { grid-template-columns: 1fr; }
		}
	</style>
</head>
<body>
		<div class="header">
			<div class="title-row">
				<span class="badge ${stateBadgeClass(detail.state)}">${stateLabel(detail.state)}</span>
				${extraBadges.join('')}
				<div class="editable-section title-edit-section" data-section-container="title">
					<div class="title-heading-row">
						<div class="section-read-area" data-section-read="title">
							<h1>${escapeHtml(detail.title)} <span class="muted">#${detail.number}</span></h1>
						</div>
						${renderEditButton('title', 'Edit title')}
					</div>
					<div class="section-edit-area" data-section-edit="title" style="display:none">
						<input type="text" data-section-input="title" value="${escapeAttr(detail.title)}" maxlength="255">
						<div class="section-actions-inline"><button class="btn-primary btn-save-section" data-section="title">Save</button><button class="btn-secondary btn-cancel-section" data-section="title">Cancel</button></div>
					</div>
					<div class="section-error" data-section-error="title"></div>
				</div>
			</div>
		<div class="meta-row">
			<span>@${escapeHtml(detail.author.login)} opened this issue</span>
			<span>· ${escapeHtml(formatDate(detail.createdAt))}</span>
			${detail.updatedAt && detail.updatedAt !== detail.createdAt ? `<span>· Updated ${escapeHtml(formatDate(detail.updatedAt))}</span>` : ''}
		</div>
			<div class="actions">
				<button id="refresh-button" class="secondary" title="Refresh" aria-label="Refresh issue">Refresh</button>
				<button id="create-branch-button" class="secondary">${BRANCH_ICON} Create Branch</button>
				<button id="open-web-button" class="secondary" ${openOnWebDisabled}>${EXTERNAL_LINK_ICON} Open on GitCode</button>
			</div>
		</div>
		<div class="layout">
			<main>
				<section class="editable-section" data-section-container="body">
					<div class="section-header-row">
						<h2>Description</h2>
						${renderEditButton('body', 'Edit description')}
					</div>
					<div class="section-read-area description" data-section-read="body">${descriptionHtml}</div>
					<div class="section-edit-area" data-section-edit="body" style="display:none">
						<textarea data-section-input="body" rows="10">${escapeHtml(detail.body)}</textarea>
						<div class="section-actions-inline"><button class="btn-primary btn-save-section" data-section="body">Save</button><button class="btn-secondary btn-cancel-section" data-section="body">Cancel</button></div>
					</div>
					<div class="section-error" data-section-error="body"></div>
				</section>
				${relatedPrsHtml}
				${timelineHtml}
			</main>
			<aside>
				${renderSidebar(detail, editOptions)}
			</aside>
		</div>
		${includeScripts ? `<script nonce="${nonce}">
			const vscode = acquireVsCodeApi();
			const editOptions = ${editOptionsJson};
			const issuePermissions = ${permissionsJson};
			const detailSnapshot = ${detailSnapshotJson};
			let activeSection = null;
			let pendingStateAction = null;

			function getSectionEdit(section) {
				return document.querySelector('[data-section-edit="' + section + '"]');
			}

			function getSectionRead(section) {
				return document.querySelector('[data-section-read="' + section + '"]');
			}

			function getSectionError(section) {
				return document.querySelector('[data-section-error="' + section + '"]');
			}

			function setActionError(message) {
				var errorEl = document.getElementById('state-action-error');
				if (errorEl) {
					errorEl.textContent = message || '';
				}
			}

			function clearSectionError(section) {
				var errorEl = getSectionError(section);
				if (errorEl) {
					errorEl.textContent = '';
				}
			}

			function setSectionSaving(section, saving) {
				var editEl = getSectionEdit(section);
				if (!editEl) {
					return;
				}

				editEl.querySelectorAll('input, textarea, button').forEach(function(el) {
					el.disabled = saving;
				});
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

			function hasIssuePermission(key) {
				return !issuePermissions || issuePermissions[key] !== false;
			}

			function applyPermissionControls() {
				if (!issuePermissions) {
					return;
				}

				if (!issuePermissions.canEditIssue) {
					document.querySelectorAll('.edit-icon-btn[data-section]').forEach(function(el) {
						setDisabledWithTooltip(el, true, 'You do not have permission to update issues in this repository.');
					});
				}

				var stateButton = document.getElementById('state-action-button');
				if (stateButton) {
					var requestedState = stateButton.getAttribute('data-state-action');
					if (requestedState === 'close' && !issuePermissions.canCloseIssue) {
						setDisabledWithTooltip(stateButton, true, 'You do not have permission to close issues in this repository.');
					}
					if (requestedState === 'reopen' && !issuePermissions.canReopenIssue) {
						setDisabledWithTooltip(stateButton, true, 'You do not have permission to reopen issues in this repository.');
					}
				}

				if (!issuePermissions.canCreateComment) {
					document.querySelectorAll('.comment-composer .comment-input, .comment-composer button[type="submit"]').forEach(function(el) {
						setDisabledWithTooltip(el, true, 'You do not have permission to comment in this repository.');
					});
				}
			}

			function resetSectionState(section) {
				if (section === 'title') {
					var titleInput = document.querySelector('[data-section-input="title"]');
					if (titleInput) {
						titleInput.value = detailSnapshot.title || '';
					}
				}
				if (section === 'body') {
					var bodyInput = document.querySelector('[data-section-input="body"]');
					if (bodyInput) {
						bodyInput.value = detailSnapshot.body || '';
					}
				}
				if (section === 'assignees') {
					document.querySelectorAll('[data-assignee-option]').forEach(function(el) {
						el.checked = detailSnapshot.assigneeLogins.indexOf(el.getAttribute('data-assignee-option')) >= 0;
					});
				}
				if (section === 'labels') {
					document.querySelectorAll('[data-label-option]').forEach(function(el) {
						el.checked = detailSnapshot.labelNames.indexOf(el.getAttribute('data-label-option')) >= 0;
					});
				}
				if (section === 'milestone') {
					document.querySelectorAll('[data-section-input="milestone"]').forEach(function(el) {
						var value = el.value === '' ? null : Number(el.value);
						el.checked = value === detailSnapshot.milestoneNumber;
					});
				}
				if (section === 'securityHole') {
					var securityInput = document.querySelector('[data-section-input="securityHole"]');
					if (securityInput) {
						securityInput.checked = Boolean(detailSnapshot.securityHole);
					}
				}
			}

			function showSection(section) {
				if (!hasIssuePermission('canEditIssue')) {
					return;
				}
				if (activeSection && activeSection !== section) {
					hideSection(activeSection, true);
				}

				clearSectionError(section);
				var readEl = getSectionRead(section);
				var editEl = getSectionEdit(section);
				if (!readEl || !editEl) {
					return;
				}

				readEl.style.display = 'none';
				editEl.style.display = 'block';
				activeSection = section;
				var focusEl = editEl.querySelector('input, textarea');
				if (focusEl) {
					focusEl.focus();
				}
				var checkedEl = editEl.querySelector('input:checked');
				if (checkedEl) {
					checkedEl.scrollIntoView({ block: 'nearest' });
				}
			}

			function hideSection(section, reset) {
				var readEl = getSectionRead(section);
				var editEl = getSectionEdit(section);
				if (!readEl || !editEl) {
					return;
				}

				if (reset) {
					resetSectionState(section);
				}
				clearSectionError(section);
				readEl.style.display = '';
				editEl.style.display = 'none';
				if (activeSection === section) {
					activeSection = null;
				}
			}

			function collectCheckedValues(selector, attributeName) {
				var values = [];
				document.querySelectorAll(selector).forEach(function(el) {
					if (el.checked) {
						values.push(el.getAttribute(attributeName) || '');
					}
				});
				return values;
			}

			function buildSectionInput(section) {
				if (section === 'title') {
					var titleInput = document.querySelector('[data-section-input="title"]');
					return { title: (titleInput ? titleInput.value : '').trim() };
				}

				if (section === 'body') {
					var bodyInput = document.querySelector('[data-section-input="body"]');
					return { title: detailSnapshot.title || '', body: bodyInput ? bodyInput.value : '' };
				}

				if (section === 'assignees') {
					return { title: detailSnapshot.title || '', assignees: collectCheckedValues('[data-assignee-option]', 'data-assignee-option').join(',') };
				}

				if (section === 'labels') {
					return { title: detailSnapshot.title || '', labels: collectCheckedValues('[data-label-option]', 'data-label-option').join(',') };
				}

				if (section === 'milestone') {
					var selectedMilestone = document.querySelector('[data-section-input="milestone"]:checked');
					var input = { title: detailSnapshot.title || '', milestoneNumber: null };
					if (selectedMilestone && selectedMilestone.value !== '') {
						input.milestoneNumber = Number(selectedMilestone.value);
					}
					return input;
				}

				if (section === 'securityHole') {
					var securityInput = document.querySelector('[data-section-input="securityHole"]');
					return { title: detailSnapshot.title || '', securityHole: Boolean(securityInput && securityInput.checked) };
				}

				return { title: detailSnapshot.title || '' };
			}

			document.getElementById('refresh-button')?.addEventListener('click', () => {
				vscode.postMessage({ command: 'refresh' });
			});
		document.getElementById('create-branch-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'createBranch' });
		});
		document.getElementById('open-web-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'openOnWeb' });
		});
		document.getElementById('state-action-button')?.addEventListener('click', () => {
			var button = document.getElementById('state-action-button');
			if (!button || button.disabled) {
				return;
			}
			setActionError('');
			var requestedState = button.getAttribute('data-state-action');
			if (requestedState === 'close' && button.getAttribute('data-confirming-close') !== 'true') {
				button.setAttribute('data-confirming-close', 'true');
				button.textContent = 'Confirm close issue';
				setActionError('Click again to confirm closing this issue.');
				return;
			}
			button.removeAttribute('data-confirming-close');
			pendingStateAction = requestedState;
			button.disabled = true;
			button.textContent = pendingStateAction === 'close' ? 'Closing issue...' : 'Reopening issue...';
			vscode.postMessage({
				command: 'changeIssueState',
				state: pendingStateAction,
			});
		});
		document.querySelectorAll('.edit-icon-btn[data-section]').forEach((el) => {
			el.addEventListener('click', () => {
				if (el.disabled) {
					return;
				}
				showSection(el.getAttribute('data-section'));
			});
		});
		document.querySelectorAll('.btn-cancel-section').forEach((el) => {
			el.addEventListener('click', () => {
				hideSection(el.getAttribute('data-section'), true);
			});
		});
		document.querySelectorAll('.btn-save-section').forEach((el) => {
			el.addEventListener('click', () => {
				var section = el.getAttribute('data-section');
				clearSectionError(section);
				setSectionSaving(section, true);
				var input = buildSectionInput(section);
				if (section === 'title' && !input.title) {
					setSectionSaving(section, false);
					var errorEl = getSectionError(section);
					if (errorEl) {
						errorEl.textContent = 'Title is required.';
					}
					return;
				}
				vscode.postMessage({
					command: 'saveIssueSection',
					section: section,
					input: input,
				});
			});
		});
		document.querySelectorAll('[data-action="openUrl"]').forEach((el) => {
			el.addEventListener('click', () => {
				vscode.postMessage({ command: 'openUrl', url: el.dataset.url });
			});
		});
		document.querySelectorAll('[data-action="openRelatedPullRequest"]').forEach((el) => {
			el.addEventListener('click', () => {
				vscode.postMessage({
					command: 'openRelatedPullRequest',
					prNumber: Number(el.dataset.prNumber),
					prUrl: el.dataset.prUrl,
					prTargetRepository: el.dataset.prTargetRepository,
				});
			});
		});

		// Comment composer submit handling
		document.querySelectorAll('.comment-composer').forEach(function(form) {
			form.addEventListener('submit', function(event) {
				event.preventDefault();
				if (!hasIssuePermission('canCreateComment')) {
					return;
				}
				var textarea = form.querySelector('.comment-input');
				var errorEl = form.querySelector('.comment-submit-error');
				var submitBtn = form.querySelector('button[type="submit"]');
				if (!textarea || !submitBtn) {
					return;
				}
				var body = textarea.value;
				if (!body.trim()) {
					if (errorEl) {
						errorEl.textContent = 'Comment body is required.';
						errorEl.hidden = false;
					}
					return;
				}
				if (errorEl) {
					errorEl.textContent = '';
					errorEl.hidden = true;
				}
				textarea.disabled = true;
				submitBtn.disabled = true;
				vscode.postMessage({
					command: 'submitIssueComment',
					body: body,
				});
			});
		});
		applyPermissionControls();

		window.addEventListener('message', (event) => {
			var msg = event.data || {};
			if (msg.command === 'issueCommentSubmitting') {
				// Already disabled via submit handler
			}
			if (msg.command === 'issueCommentSubmitted') {
				document.querySelectorAll('.comment-composer').forEach(function(form) {
					var textarea = form.querySelector('.comment-input');
					var submitBtn = form.querySelector('button[type="submit"]');
					var errorEl = form.querySelector('.comment-submit-error');
					if (textarea) {
						textarea.value = '';
						textarea.disabled = false;
					}
					if (submitBtn) {
						submitBtn.disabled = false;
					}
					if (errorEl) {
						errorEl.textContent = '';
						errorEl.hidden = true;
					}
				});
			}
			if (msg.command === 'issueCommentSubmitError') {
				document.querySelectorAll('.comment-composer').forEach(function(form) {
					var textarea = form.querySelector('.comment-input');
					var submitBtn = form.querySelector('button[type="submit"]');
					var errorEl = form.querySelector('.comment-submit-error');
					if (textarea) {
						textarea.disabled = false;
					}
					if (submitBtn) {
						submitBtn.disabled = false;
					}
					if (errorEl) {
						errorEl.textContent = msg.message || 'Failed to create comment.';
						errorEl.hidden = false;
					}
				});
			}
			if (msg.command === 'sectionSaveError') {
				setSectionSaving(msg.section, false);
				var errorEl = getSectionError(msg.section);
				if (errorEl) {
					errorEl.textContent = msg.message || 'Unable to update issue section.';
				}
				showSection(msg.section);
			}
			if (msg.command === 'issueStateChangeError') {
				var button = document.getElementById('state-action-button');
				if (button) {
					button.disabled = false;
					button.classList.remove('danger');
					button.classList.add('secondary');
					button.textContent = pendingStateAction === 'close' ? 'Close issue' : 'Reopen issue';
				}
				setActionError(msg.message || 'Unable to update issue state.');
				pendingStateAction = null;
			}
		});
	</script>` : ''}
</body>
</html>`;
}

export function getIssueLoadingHtml(title: string, description: string, nonce: string): string {
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

export function getIssueErrorHtml(title: string, description: string, nonce: string): string {
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
