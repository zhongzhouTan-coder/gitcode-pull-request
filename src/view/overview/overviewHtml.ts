import {
	EditPullRequestOptions,
	IssueLabel,
	IssueRepositoryRef,
	IssueUser,
	PullRequestComment,
	PullRequestCommentReply,
	PullRequestCommentsSnapshot,
	PullRequestDetail,
	PullRequestDiffComment,
	PullRequestGeneralComment,
	PullRequestLabel,
	PullRequestParticipant,
	PullRequestRelatedIssue,
	PullRequestRelatedIssuesSnapshot,
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

/** Refresh circular-arrow icon (16×16). */
const REFRESH_ICON = `<svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
	<path d="M2 8a6 6 0 0 1 10.9-3.5L14 6V2.1h1.6v5.8H9.8V6.4h2.5A4.4 4.4 0 1 0 13.3 11l1.2 1A6 6 0 1 1 2 8Z" fill="currentColor"/>
</svg>`;

/** External-link icon (16×16). */
const EXTERNAL_LINK_ICON = `<svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
	<path d="M3 2v11h11V8.5h1V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h4.5v1H3Zm5.5 0V1H15v6.5h-1V2.7L7.9 8.9l-.8-.8L13.3 2H8.5Z" fill="currentColor"/>
</svg>`;

/** Compact pencil/edit icon for section editing. */
const PENCIL_ICON = `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
	<path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10ZM11.207 2.5 13.5 4.793 12.793 5.5 10.5 3.207 11.207 2.5Zm1.586 2.793L10.5 3 4 9.5 5.5 12l.5.5 6.793-6.793ZM3 13.5l-.586 1.086 2.293-.293L3.5 13ZM7.5 9.5 9 11l.793-.793L8.5 9.207 7.5 9.5Z"/>
</svg>`;

function renderParticipants(participants: PullRequestParticipant[]): string {
	if (!participants.length) {
		return '<div class="empty">None</div>';
	}

	return `<div class="participant-list">${participants.map((p) => {
		const avatar = renderSvgAvatar(p.login, p.name);
		const displayName = p.name && p.name !== p.login
			? `${escapeHtml(p.name)} <span class="muted">@${escapeHtml(p.login)}</span>`
			: `@${escapeHtml(p.login)}`;

		if (p.htmlUrl) {
			return `<button class="participant-btn" data-action="openUrl" data-url="${escapeHtml(p.htmlUrl)}" title="${escapeHtml(p.login)}">
				${avatar}
				<span class="participant-name">${displayName}</span>
			</button>`;
		}

		return `<span class="participant-row">
			${avatar}
			<span class="participant-name">${displayName}</span>
		</span>`;
	}).join('')}</div>`;
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
	const parts: string[] = [];
	if (comment.location.path) {
		parts.push(`<span class="comment-file">${escapeHtml(comment.location.path)}</span>`);
	}
	parts.push(`line ${comment.location.startLine}`);
	if (comment.location.endLine !== comment.location.startLine) {
		parts.push(`-${comment.location.endLine}`);
	}
	return parts.join(' · ');
}

function renderDiffCommentBadges(comment: PullRequestDiffComment): string {
	const badges: string[] = [];
	if (comment.resolved) {
		badges.push('<span class="badge badge-resolved">Resolved</span>');
	}
	if (comment.isOutdated) {
		badges.push('<span class="badge badge-outdated">Outdated</span>');
	}
	return badges.join(' ');
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

function renderConversationComment(comment: PullRequestComment): string {
	if (comment.kind === 'pullRequest') {
		return renderGeneralCommentCard(comment);
	}
	return renderDiffCommentCard(comment);
}

function renderGeneralCommentCard(comment: PullRequestGeneralComment): string {
	return `
		<div class="comment-card">
			<div class="comment-header">
				${renderCommentAvatar(comment.author)}
				<span class="comment-author">${renderInlineAuthors([comment.author])}</span>
				<span class="comment-time">${escapeHtml(formatDate(comment.createdAt))}</span>
				${hasEditedMarker(comment) ? '<span class="edited-marker">edited</span>' : ''}
			</div>
			<div class="comment-body">${renderCommentBody(comment.body)}</div>
			${renderConversationReplies(comment.replies)}
		</div>
	`;
}

function renderDiffCommentCard(comment: PullRequestDiffComment): string {
	return `
		<div class="comment-card comment-card-diff">
			<div class="comment-header">
				${renderCommentAvatar(comment.author)}
				<span class="comment-author">${renderInlineAuthors([comment.author])}</span>
				<span class="comment-time">${escapeHtml(formatDate(comment.createdAt))}</span>
				${hasEditedMarker(comment) ? '<span class="edited-marker">edited</span>' : ''}
			</div>
			<div class="comment-meta">
				<span class="comment-location">${renderDiffCommentLocation(comment)}</span>
				${renderDiffCommentBadges(comment)}
			</div>
			<div class="comment-body">${renderCommentBody(comment.body)}</div>
			${renderConversationReplies(comment.replies)}
		</div>
	`;
}

function renderConversationSection(snapshot: PullRequestCommentsSnapshot): string {
	const comments = [...snapshot.comments].sort((a, b) => {
		return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
	});

	if (!comments.length) {
		return '<section><h2>Conversation</h2><div class="empty">No comments yet.</div></section>';
	}

	const countText = `${comments.length}`;
	return `
		<section>
			<h2>Conversation (${countText})</h2>
			<div class="conversation-list">
				${comments.map((c) => renderConversationComment(c)).join('')}
			</div>
		</section>
	`;
}

function renderConversationLoading(): string {
	return '<section><h2>Conversation</h2><div class="empty">Loading comments...</div></section>';
}

function renderConversationError(message: string): string {
	return `<section><h2>Conversation</h2><div class="comment-error">${escapeHtml(message)}</div></section>`;
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

function renderRelatedIssueRow(issue: PullRequestRelatedIssue): string {
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

	return `
		<div class="related-issue-row related-issue-${stateClass}">
			<div class="related-issue-rail" aria-hidden="true"></div>
			<div class="related-issue-main">
				<div class="related-issue-title-row">
					${titleHtml}
					${externalLink}
				</div>
				<div class="related-issue-meta">
					${metaParts.join('')}
				</div>
				${renderIssueLabels(issue.labels)}
			</div>
		</div>
	`;
}

export function renderRelatedIssuesSection(snapshot: PullRequestRelatedIssuesSnapshot): string {
	const issues = snapshot.issues;

	if (!issues.length) {
		return '<section><h2>Related Issues</h2><div class="empty">No related issues.</div></section>';
	}

	const countText = `${issues.length}`;
	return `
		<section>
			<h2>Related Issues (${countText})</h2>
			<div class="related-issues-list">
				${issues.map((issue) => renderRelatedIssueRow(issue)).join('')}
			</div>
		</section>
	`;
}

export function renderRelatedIssuesLoading(): string {
	return '<section><h2>Related Issues</h2><div class="empty">Loading related issues...</div></section>';
}

export function renderRelatedIssuesError(message: string): string {
	return `<section><h2>Related Issues</h2><div class="comment-error">${escapeHtml(message)}</div></section>`;
}

export function getOverviewHtml(detail: PullRequestDetail, nonce: string, conversationHtml?: string, relatedIssuesHtml?: string, editOptions?: EditPullRequestOptions, includeScripts: boolean = true): string {
	const descriptionHtml = renderMarkdown(detail.body);
	const draftBadge = detail.isDraft ? '<span class="badge badge-draft">Draft</span>' : '';
	const openOnWebDisabled = detail.htmlUrl ? '' : 'disabled';
	const conversationSection = conversationHtml ?? '';
	const relatedIssuesSection = relatedIssuesHtml ?? '';

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
	const detailSnapshotJson = serializeForInlineScript({
		title: detail.title,
		body: detail.body,
		state: detail.state === 'closed' ? 'closed' : 'open',
		draft: detail.isDraft,
		labels: detail.labels,
		milestone: detail.milestone ?? null,
	});
	const currentTitleJson = serializeForInlineScript(detail.title);

	const draftText = detail.isDraft ? 'Yes' : 'No';
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
		.participant-btn,
		.participant-row {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 2px 0;
		}
		.participant-btn {
			border: none;
			background: none;
			color: inherit;
			font: inherit;
			cursor: pointer;
			text-align: left;
			width: 100%;
			border-radius: 6px;
			padding: 4px 6px;
			margin: -2px -6px;
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
		/* ---- Conversation / Comments ---- */
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
		.comment-header {
			display: flex;
			align-items: center;
			gap: 10px;
			margin-bottom: 10px;
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
		.comment-location { color: var(--muted); }
		.badge-resolved {
			background: var(--badge-merged);
			color: white;
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
		.comment-error { color: var(--vscode-errorForeground); padding: 8px 0; }
		/* ---- Related Issues ---- */
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
			width: 16px;
			height: 16px;
			border: none;
			background: transparent;
			color: var(--muted);
			cursor: pointer;
			border-radius: 3px;
			opacity: 0;
			transition: opacity 0.15s, background 0.15s;
			flex-shrink: 0;
			padding: 0;
		}
		.edit-section-wrapper:hover .edit-icon-btn,
		.edit-section-wrapper:focus-within .edit-icon-btn,
		.edit-icon-btn:focus-visible {
			opacity: 1;
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
			<button id="refresh-button" class="secondary">${REFRESH_ICON} Refresh</button>
			<button id="open-web-button" ${openOnWebDisabled}>${EXTERNAL_LINK_ICON} Open on GitCode</button>
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
		</main>
		<aside>
			<div class="card status-summary-card">
				<h3>Status Summary</h3>
				${renderStatus(detail)}
			</div>
			<div class="card">
				<div class="meta-group">
					<h3>Reviewers</h3>
					${renderParticipants(detail.reviewers)}
				</div>
				<div class="meta-group">
					<h3>Assignees</h3>
					${renderParticipants(detail.assignees)}
				</div>
				<div class="meta-group">
					<h3>Testers</h3>
					${renderParticipants(detail.testers)}
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
			<div class="card edit-section-wrapper">
				<div class="edit-section-header">
					<h3>State</h3>
					<button class="edit-icon-btn" data-section="state" title="Edit state" aria-label="Edit state">${PENCIL_ICON}</button>
				</div>
				<div class="section-view-state">${stateLabel(detail)}</div>
				<div class="section-edit-area" data-section-edit="state" style="display:none">
					<select data-section-input="state">
						<option value="open" ${detail.state === 'open' ? 'selected' : ''}>Open</option>
						<option value="closed" ${detail.state === 'closed' ? 'selected' : ''}>Closed</option>
					</select>
					<div class="section-edit-actions">
						<button class="btn-primary btn-save-section" data-section="state">Save</button>
						<button class="btn-secondary btn-cancel-section" data-section="state">Cancel</button>
						<span class="section-edit-saving" style="display:none">Saving...</span>
					</div>
					<div class="section-edit-error" style="display:none"></div>
				</div>
			</div>
			<div class="card edit-section-wrapper">
				<div class="edit-section-header">
					<h3>Draft</h3>
					<button class="edit-icon-btn" data-section="draft" title="Edit draft" aria-label="Edit draft">${PENCIL_ICON}</button>
				</div>
				<div class="section-view-draft">${draftText}</div>
				<div class="section-edit-area" data-section-edit="draft" style="display:none">
					<label style="display:flex;align-items:center;gap:8px;cursor:pointer">
						<input type="checkbox" data-section-input="draft" ${detail.isDraft ? 'checked' : ''}>
						<span>Mark as draft</span>
					</label>
					<div class="section-edit-actions">
						<button class="btn-primary btn-save-section" data-section="draft">Save</button>
						<button class="btn-secondary btn-cancel-section" data-section="draft">Cancel</button>
						<span class="section-edit-saving" style="display:none">Saving...</span>
					</div>
					<div class="section-edit-error" style="display:none"></div>
				</div>
			</div>
			<div class="card edit-section-wrapper">
				<div class="edit-section-header">
					<h3>Close Related Issues</h3>
					<button class="edit-icon-btn" data-section="closeRelatedIssue" title="Edit close related issues" aria-label="Edit close related issues">${PENCIL_ICON}</button>
				</div>
				<div class="section-view-closeRelatedIssue"><span class="muted">Default</span></div>
				<div class="section-edit-area" data-section-edit="closeRelatedIssue" style="display:none">
					<label style="display:flex;align-items:center;gap:8px;cursor:pointer">
						<input type="checkbox" data-section-input="closeRelatedIssue">
						<span>Close related issues after merge</span>
					</label>
					<div class="section-edit-actions">
						<button class="btn-primary btn-save-section" data-section="closeRelatedIssue">Save</button>
						<button class="btn-secondary btn-cancel-section" data-section="closeRelatedIssue">Cancel</button>
						<span class="section-edit-saving" style="display:none">Saving...</span>
					</div>
					<div class="section-edit-error" style="display:none"></div>
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
		const detailSnapshot = ${detailSnapshotJson};

		// Current pull request title (always sent with section saves per API contract)
		var currentTitle = ${currentTitleJson};
		var editingSection = null;
		var selectedLabels = [];
		var selectedMilestone = null;

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

			if (section === 'state') {
				const stateInput = document.querySelector('[data-section-input="state"]');
				if (stateInput) {
					stateInput.value = detailSnapshot.state || 'open';
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
					closeRelatedIssueInput.checked = false;
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

		function startEdit(section) {
			// Only one section editable at a time
			if (editingSection && editingSection !== section) {
				cancelEdit(editingSection);
			}

			const view = getSectionView(section);
			const edit = getSectionEdit(section);
			const titleView = document.querySelector('.section-view-title');
			const titleEdit = document.querySelector('[data-section-edit="title"]');

			if (view) view.style.display = 'none';
			if (edit) edit.style.display = 'block';

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

			if (view) view.style.display = '';
			if (edit) edit.style.display = 'none';

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
			if (saveBtn) saveBtn.disabled = saving;
			if (cancelBtn) cancelBtn.disabled = saving;
			if (savingEl) savingEl.style.display = saving ? '' : 'none';
		}

		function showSectionError(section, message) {
			const err = getSectionError(section);
			if (err) {
				err.textContent = message;
				err.style.display = '';
			}
		}

		function buildInput(section) {
			var title = document.querySelector('[data-section-input="title"]');
			var currentTitleValue = title ? title.value.trim() : currentTitle;

			var input = { title: currentTitleValue };

			switch (section) {
				case 'title':
					// Only title changes
					break;
				case 'body':
					input.body = getSectionInput('body') || '';
					break;
				case 'labels':
						input.labels = selectedLabels.map(function(label) {
							return label.name;
						}).join(',');
					break;
				case 'milestone':
						input.milestoneNumber = selectedMilestone ? Number(selectedMilestone.number) : undefined;
					break;
				case 'state':
					input.state = getSectionInput('state') || undefined;
					break;
				case 'draft':
					input.draft = getSectionInput('draft');
					break;
				case 'closeRelatedIssue':
					input.closeRelatedIssue = getSectionInput('closeRelatedIssue');
					break;
			}

			return input;
		}

		function saveSection(section) {
			var input = buildInput(section);
			if (!input.title) {
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
		});

		document.getElementById('refresh-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'refresh' });
		});
		document.getElementById('open-web-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'openOnWeb' });
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
	</script>` : ''}
</body>
</html>`;
}

export function getOverviewWithCommentsHtml(detail: PullRequestDetail, snapshot: PullRequestCommentsSnapshot, nonce: string, relatedIssuesHtml?: string, editOptions?: EditPullRequestOptions): string {
	return getOverviewHtml(detail, nonce, renderConversationSection(snapshot), relatedIssuesHtml, editOptions);
}

export function getOverviewWithCommentsLoadingHtml(detail: PullRequestDetail, nonce: string, relatedIssuesHtml?: string, editOptions?: EditPullRequestOptions): string {
	return getOverviewHtml(detail, nonce, renderConversationLoading(), relatedIssuesHtml, editOptions, false);
}

export function getOverviewWithCommentsErrorHtml(detail: PullRequestDetail, errorMessage: string, nonce: string, relatedIssuesHtml?: string, editOptions?: EditPullRequestOptions): string {
	return getOverviewHtml(detail, nonce, renderConversationError(errorMessage), relatedIssuesHtml, editOptions);
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
