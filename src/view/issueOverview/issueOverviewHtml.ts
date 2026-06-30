import {
	IssueComment,
	IssueCommentsSnapshot,
	IssueDetail,
	IssueLabel,
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

/** Refresh circular-arrow icon (16×16). */
const REFRESH_ICON = `<svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
	<path d="M2 8a6 6 0 0 1 10.9-3.5L14 6V2.1h1.6v5.8H9.8V6.4h2.5A4.4 4.4 0 1 0 13.3 11l1.2 1A6 6 0 1 1 2 8Z" fill="currentColor"/>
</svg>`;

/** External-link icon (16×16). */
const EXTERNAL_LINK_ICON = `<svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
	<path d="M3 2v11h11V8.5h1V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h4.5v1H3Zm5.5 0V1H15v6.5h-1V2.7L7.9 8.9l-.8-.8L13.3 2H8.5Z" fill="currentColor"/>
</svg>`;

/** Git branch icon (16×16). */
const BRANCH_ICON = `<svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
	<path d="M4 1.5a2 2 0 0 1 1 3.73v5.54A3.5 3.5 0 0 0 8 7.31l.01-.4A2 2 0 1 1 9.5 6.95v.36A5 5 0 0 1 5 12.25v.52a2 2 0 1 1-1.5 0V5.23A2 2 0 0 1 4 1.5Zm0 1.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Zm6 1.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Zm-6 9a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Z" fill="currentColor"/>
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

function renderSidebar(detail: IssueDetail): string {
	return `
		<div class="card sidebar-card">
			<div class="meta-group">
				<h3>Assignees</h3>
				${renderUsers(detail.assignees)}
			</div>
			<div class="meta-group">
				<h3>Labels</h3>
				${renderLabels(detail.labels)}
			</div>
			<div class="meta-group">
				<h3>Milestone</h3>
				${renderMilestone(detail)}
			</div>
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
	relatedPullRequests?: IssueRelatedPullRequestsSnapshot;
	relatedPullRequestsError?: Error;
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
	if (author.htmlUrl) {
		return `<button class="participant-btn" data-action="openUrl" data-url="${escapeHtml(author.htmlUrl)}" title="${escapeHtml(author.login)}">${display}</button>`;
	}
	return `<span>${display}</span>`;
}

function renderIssueComment(comment: IssueComment): string {
	const bodyHtml = comment.body
		? renderMarkdown(comment.body)
		: '<div class="empty">No comment body provided.</div>';

	const updated = comment.updatedAt && comment.updatedAt !== comment.createdAt
		? `<span class="comment-edited" title="Edited ${escapeHtml(formatDate(comment.updatedAt))}">· Edited</span>`
		: '';

	return `<div class="comment">
	<div class="comment-header">
		${renderCommentAvatar(comment.author)}
		${renderCommentAuthor(comment.author)}
		<span class="comment-time">${escapeHtml(formatDate(comment.createdAt))}</span>
		${updated}
	</div>
	<div class="comment-body description">${bodyHtml}</div>
</div>`;
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

function renderConversation(
	comments: readonly IssueComment[] | undefined,
	commentsError: Error | undefined,
): string {
	if (commentsError) {
		return `<section>
	<h2>Conversation</h2>
	<div class="error">Unable to load comments</div>
</section>`;
	}

	if (!comments) {
		return '';
	}

	if (comments.length === 0) {
		return `<section>
	<h2>Conversation</h2>
	<div class="empty">No comments yet</div>
</section>`;
	}

	// Sort by createdAt ascending, oldest first
	const sorted = [...comments].sort((a, b) => {
		if (a.createdAt < b.createdAt) { return -1; }
		if (a.createdAt > b.createdAt) { return 1; }
		return 0;
	});

	return `<section>
	<h2>Conversation (${sorted.length})</h2>
	${sorted.map(renderIssueComment).join('')}
</section>`;
}

export function getIssueOverviewHtml(options: IssueOverviewHtmlOptions): string {
	const { detail, comments, commentsError, relatedPullRequests, relatedPullRequestsError, nonce, includeScripts = true } = options;

	const descriptionHtml = detail.body
		? renderMarkdown(detail.body)
		: '<div class="empty">No description provided.</div>';

	const openOnWebDisabled = detail.url ? '' : 'disabled';

	// Extra badges
	const extraBadges: string[] = [];
	if (detail.issueState) {
		extraBadges.push(`<span class="badge badge-state">${escapeHtml(detail.issueState)}</span>`);
	}
	if (detail.issueType) {
		extraBadges.push(`<span class="badge badge-type">${escapeHtml(detail.issueType)}</span>`);
	}

	const conversationHtml = renderConversation(
		comments?.comments,
		commentsError,
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
		.badge-state { background: var(--badge-state); }
		.badge-type { background: var(--badge-type); }
		.actions { margin-top: 16px; display: flex; gap: 12px; }
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
		button:disabled { opacity: 0.5; cursor: default; }
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
			text-align: left;
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
			color: var(--muted);
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
		.comment {
			border-top: 1px solid var(--border);
			padding: 12px 0;
		}
		.comment:first-of-type {
			border-top: none;
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
			<h1>${escapeHtml(detail.title)} <span class="muted">#${detail.number}</span></h1>
		</div>
		<div class="meta-row">
			<span>@${escapeHtml(detail.author.login)} opened this issue</span>
			<span>· ${escapeHtml(formatDate(detail.createdAt))}</span>
			${detail.updatedAt && detail.updatedAt !== detail.createdAt ? `<span>· Updated ${escapeHtml(formatDate(detail.updatedAt))}</span>` : ''}
		</div>
		<div class="actions">
			<button id="refresh-button" class="secondary">${REFRESH_ICON} Refresh</button>
			<button id="create-branch-button" class="secondary">${BRANCH_ICON} Create Branch</button>
			<button id="open-web-button" ${openOnWebDisabled}>${EXTERNAL_LINK_ICON} Open on GitCode</button>
		</div>
	</div>
	<div class="layout">
		<main>
			<section>
				<h2>Description</h2>
				<div class="description">${descriptionHtml}</div>
			</section>
			${relatedPrsHtml}
			${conversationHtml}
		</main>
		<aside>
			${renderSidebar(detail)}
		</aside>
	</div>
	${includeScripts ? `<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		document.getElementById('refresh-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'refresh' });
		});
		document.getElementById('create-branch-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'createBranch' });
		});
		document.getElementById('open-web-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'openOnWeb' });
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
