import { URL } from 'url';
import MarkdownIt = require('markdown-it');
import { sanitizeHtml, containsHtmlTags } from './htmlSanitizer';

function sanitizeUrl(url: string): string | undefined {
	try {
		const parsed = new URL(url);
		if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'data:') {
			return parsed.toString();
		}
	} catch {
		return undefined;
	}

	return undefined;
}

function removeAttribute(token: MarkdownIt.Token, name: string): void {
	const index = token.attrIndex(name);
	if (index >= 0) {
		token.attrs?.splice(index, 1);
	}
}

const markdownIt = new MarkdownIt({
	html: true,
	linkify: true,
	breaks: false,
	typographer: false,
});

const defaultLinkOpen = markdownIt.renderer.rules.link_open;
markdownIt.renderer.rules.link_open = (
	tokens: MarkdownIt.Token[],
	idx: number,
	options: MarkdownIt.Options,
	env: unknown,
	self: MarkdownIt.Renderer,
) => {
	const token = tokens[idx];
	const hrefIndex = token.attrIndex('href');
	const href = hrefIndex >= 0 ? token.attrs?.[hrefIndex]?.[1] : undefined;
	const sanitized = href ? sanitizeUrl(href) : undefined;

	if (!sanitized) {
		removeAttribute(token, 'href');
	}

	token.attrSet('target', '_blank');
	token.attrSet('rel', 'noopener noreferrer');

	if (sanitized) {
		token.attrSet('href', sanitized);
	}

	if (defaultLinkOpen) {
		return defaultLinkOpen(tokens, idx, options, env, self);
	}

	return self.renderToken(tokens, idx, options);
};

const defaultImage = markdownIt.renderer.rules.image;
markdownIt.renderer.rules.image = (
	tokens: MarkdownIt.Token[],
	idx: number,
	options: MarkdownIt.Options,
	env: unknown,
	self: MarkdownIt.Renderer,
) => {
	const token = tokens[idx];
	const srcIndex = token.attrIndex('src');
	const src = srcIndex >= 0 ? token.attrs?.[srcIndex]?.[1] : undefined;
	const sanitized = src ? sanitizeUrl(src) : undefined;

	if (!sanitized) {
		const alt = token.content || 'image';
		return `<span>${markdownIt.utils.escapeHtml(alt)}</span>`;
	}

	token.attrSet('src', sanitized);
	token.attrSet('loading', 'lazy');

	if (defaultImage) {
		return defaultImage(tokens, idx, options, env, self);
	}

	return self.renderToken(tokens, idx, options);
};

export function renderMarkdown(markdown: string): string {
	if (!markdown.trim()) {
		return '<p>No description provided.</p>';
	}

	const rendered = markdownIt.render(markdown);

	// When the markdown source contains raw HTML, sanitize the rendered output.
	// This allows safe HTML (tables, divs, links) from API comments while
	// stripping dangerous tags (script, style) and event handlers (onclick).
	if (containsHtmlTags(markdown)) {
		return sanitizeHtml(rendered);
	}

	return rendered;
}
