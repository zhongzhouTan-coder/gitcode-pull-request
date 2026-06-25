import {
	IssueDetail,
	IssueLabel,
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

function renderUsers(users: IssueUser[]): string {
	if (!users.length) {
		return '<div class="empty">None</div>';
	}

	return `<div class="meta-list">${users.map((u) => {
		const display = u.name && u.name !== u.login
			? `${escapeHtml(u.name)} (@${escapeHtml(u.login)})`
			: `@${escapeHtml(u.login)}`;
		if (u.htmlUrl) {
			return `<button class="participant-btn" data-action="openUrl" data-url="${escapeHtml(u.htmlUrl)}" title="${escapeHtml(u.login)}">${display}</button>`;
		}
		return `<span>${display}</span>`;
	}).join('')}</div>`;
}

function renderMilestone(detail: IssueDetail): string {
	if (!detail.milestone) {
		return '<div class="empty">None</div>';
	}

	const parts: string[] = [escapeHtml(detail.milestone.title)];
	if (detail.milestone.dueOn) {
		parts.push(` (due ${escapeHtml(detail.milestone.dueOn)})`);
	}
	if (detail.milestone.state) {
		parts.push(` — ${escapeHtml(detail.milestone.state)}`);
	}

	return `<div>${parts.join('')}</div>`;
}

function renderSidebar(detail: IssueDetail): string {
	return `
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
		<div class="meta-group">
			<h3>Type</h3>
			<div>${escapeHtml(detail.issueType || 'None')}</div>
		</div>
		<div class="meta-group">
			<h3>Priority</h3>
			<div>${escapeHtml(detail.priorityDetail?.title ?? 'None')}</div>
		</div>
		<div class="meta-group">
			<h3>Workflow State</h3>
			<div>${escapeHtml(detail.issueStateDetail?.title ?? detail.issueState ?? 'None')}</div>
		</div>
		<div class="meta-group">
			<h3>Comments</h3>
			<div>${detail.comments}</div>
		</div>
	</div>
	<div class="card">
		<div class="meta-group">
			<h3>Dates</h3>
			<ul class="meta-list">
				<li>Created: ${escapeHtml(formatDate(detail.createdAt))}</li>
				<li>Updated: ${escapeHtml(formatDate(detail.updatedAt))}</li>
				${detail.finishedAt ? `<li>Finished: ${escapeHtml(formatDate(detail.finishedAt))}</li>` : ''}
			</ul>
		</div>
		<div class="meta-group">
			<h3>Repository</h3>
			<div>${escapeHtml(detail.repository.fullName)}</div>
		</div>
	</div>`;
}

export function getIssueOverviewHtml(detail: IssueDetail, nonce: string, includeScripts: boolean = true): string {
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
		.labels { display: flex; flex-wrap: wrap; gap: 8px; }
		.label-chip {
			display: inline-flex;
			align-items: center;
			padding: 4px 10px;
			border-radius: 999px;
			background: color-mix(in srgb, var(--label-color) 18%, transparent);
			border: 1px solid color-mix(in srgb, var(--label-color) 45%, transparent);
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
		.muted, .empty { color: var(--muted); }
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
			<button id="open-web-button" ${openOnWebDisabled}>${EXTERNAL_LINK_ICON} Open on GitCode</button>
		</div>
	</div>
	<div class="layout">
		<main>
			<section>
				<h2>Description</h2>
				<div class="description">${descriptionHtml}</div>
			</section>
		</main>
		<aside>
			<div class="card">
				${renderSidebar(detail)}
			</div>
		</aside>
	</div>
	${includeScripts ? `<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
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
