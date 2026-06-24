import {
	PullRequestComment,
	PullRequestCommentReply,
	PullRequestCommentsSnapshot,
	PullRequestDetail,
	PullRequestDiffComment,
	PullRequestGeneralComment,
	PullRequestLabel,
	PullRequestParticipant,
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

function renderParticipants(participants: PullRequestParticipant[]): string {
	if (!participants.length) {
		return '<div class="empty">None</div>';
	}

	return `<ul class="meta-list">${participants.map((participant) => {
		const primary = participant.name && participant.name !== participant.login
			? `${escapeHtml(participant.name)} <span class="muted">@${escapeHtml(participant.login)}</span>`
			: `@${escapeHtml(participant.login)}`;
		return `<li>${primary}</li>`;
	}).join('')}</ul>`;
}

function renderLabels(labels: PullRequestLabel[]): string {
	if (!labels.length) {
		return '<div class="empty">None</div>';
	}

	return `<div class="labels">${labels.map((label) => (
		`<span class="label-chip" style="--label-color:${escapeHtml(labelColor(label.color))}">${escapeHtml(label.name)}</span>`
	)).join('')}</div>`;
}

function renderStatus(detail: PullRequestDetail): string {
	const lines: string[] = [];
	lines.push(`<div class="status-line"><span class="status-name">Mergeable</span><span>${detail.mergeability.mergeable ? 'Yes' : 'No'}</span></div>`);
	if (detail.mergeability.canMergeCheck !== undefined) {
		lines.push(`<div class="status-line"><span class="status-name">Merge check</span><span>${detail.mergeability.canMergeCheck ? 'Ready' : 'Blocked'}</span></div>`);
	}
	if (detail.mergeability.hasConflicts !== undefined) {
		lines.push(`<div class="status-line"><span class="status-name">Conflicts</span><span>${detail.mergeability.hasConflicts ? 'Detected' : 'None'}</span></div>`);
	}
	if (detail.mergeability.ciPassed !== undefined) {
		lines.push(`<div class="status-line"><span class="status-name">CI</span><span>${detail.mergeability.ciPassed ? 'Passed' : 'Pending / Failed'}</span></div>`);
	}
	if (detail.mergeability.reviewPassed !== undefined) {
		lines.push(`<div class="status-line"><span class="status-name">Review</span><span>${detail.mergeability.reviewPassed ? 'Passed' : 'Pending / Blocked'}</span></div>`);
	}

	if (detail.mergeability.reasons.length) {
		lines.push(`<ul class="reason-list">${detail.mergeability.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>`);
	}

	return lines.join('');
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

export function getOverviewHtml(detail: PullRequestDetail, nonce: string, conversationHtml?: string): string {
	const descriptionHtml = renderMarkdown(detail.body);
	const draftBadge = detail.isDraft ? '<span class="badge badge-draft">Draft</span>' : '';
	const openOnWebDisabled = detail.htmlUrl ? '' : 'disabled';
	const conversationSection = conversationHtml ?? '';

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
			border: 1px solid var(--border);
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			padding: 8px 14px;
			border-radius: 6px;
			cursor: pointer;
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
		.meta-list, .reason-list { margin: 0; padding-left: 18px; }
		.meta-list li, .reason-list li { margin: 4px 0; }
		.labels { display: flex; flex-wrap: wrap; gap: 8px; }
		.label-chip {
			display: inline-flex;
			align-items: center;
			padding: 4px 10px;
			border-radius: 999px;
			background: color-mix(in srgb, var(--label-color) 18%, transparent);
			border: 1px solid color-mix(in srgb, var(--label-color) 45%, transparent);
		}
		.status-line {
			display: flex;
			justify-content: space-between;
			gap: 12px;
			padding: 6px 0;
			border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		}
		.status-line:last-of-type { border-bottom: none; }
		.status-name { color: var(--muted); }
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
		@media (max-width: 900px) {
			.layout { grid-template-columns: 1fr; }
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="title-row">
			<span class="badge badge-${detail.state}">${stateLabel(detail)}</span>
			${draftBadge}
			<h1>${escapeHtml(detail.title)} <span class="muted">#${detail.number}</span></h1>
		</div>
		<div class="meta-row">
			<span>@${escapeHtml(detail.author.login)}</span>
			<span>${escapeHtml(detail.source.ref)} -> ${escapeHtml(detail.target.ref)}</span>
			<span>Updated ${escapeHtml(formatDate(detail.updatedAt))}</span>
		</div>
		<div class="actions">
			<button id="refresh-button" class="secondary">Refresh</button>
			<button id="open-web-button" ${openOnWebDisabled}>Open on GitCode</button>
		</div>
	</div>
	<div class="layout">
		<main>
			<section>
				<h2>Status Summary</h2>
				${renderStatus(detail)}
			</section>
			<section>
				<h2>Description</h2>
				<div class="description">${descriptionHtml}</div>
			</section>
			${conversationSection}
		</main>
		<aside>
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
				<div class="meta-group">
					<h3>Labels</h3>
					${renderLabels(detail.labels)}
				</div>
			</div>
			<div class="card">
				<div class="meta-group">
					<h3>Branches</h3>
					<ul class="meta-list">
						<li>Source: ${escapeHtml(detail.source.repositoryFullName ?? detail.source.ref)} / ${escapeHtml(detail.source.ref)}</li>
						<li>Target: ${escapeHtml(detail.target.repositoryFullName ?? detail.target.ref)} / ${escapeHtml(detail.target.ref)}</li>
					</ul>
				</div>
				<div class="meta-group">
					<h3>Timestamps</h3>
					<ul class="meta-list">
						<li>Created: ${escapeHtml(formatDate(detail.createdAt))}</li>
						<li>Updated: ${escapeHtml(formatDate(detail.updatedAt))}</li>
						<li>Closed: ${escapeHtml(formatDate(detail.closedAt))}</li>
						<li>Merged: ${escapeHtml(formatDate(detail.mergedAt))}</li>
					</ul>
				</div>
			</div>
		</aside>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		document.getElementById('refresh-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'refresh' });
		});
		document.getElementById('open-web-button')?.addEventListener('click', () => {
			vscode.postMessage({ command: 'openOnWeb' });
		});
	</script>
</body>
</html>`;
}

export function getOverviewWithCommentsHtml(detail: PullRequestDetail, snapshot: PullRequestCommentsSnapshot, nonce: string): string {
	return getOverviewHtml(detail, nonce, renderConversationSection(snapshot));
}

export function getOverviewWithCommentsLoadingHtml(detail: PullRequestDetail, nonce: string): string {
	return getOverviewHtml(detail, nonce, renderConversationLoading());
}

export function getOverviewWithCommentsErrorHtml(detail: PullRequestDetail, errorMessage: string, nonce: string): string {
	return getOverviewHtml(detail, nonce, renderConversationError(errorMessage));
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
