import { URL } from 'url';

/**
 * A minimal HTML sanitizer for VS Code webview content.
 *
 * Strips dangerous tags and attributes while preserving layout-related HTML
 * (tables, divs, links, etc.) that the GitCode API may return in comment bodies.
 *
 * The webview CSP already blocks inline scripts and restricts resource loading,
 * so this sanitizer focuses on removing event handlers, script/style tags,
 * and javascript: URLs.
 */

/** Tags whose entire element (including content) is removed. */
const STRIP_TAGS = new Set([
	'script', 'style', 'iframe', 'object', 'embed', 'form', 'input',
	'button', 'link', 'meta', 'noscript', 'applet', 'frame', 'frameset',
]);

/** Allowed HTML tags. Anything not in this set is stripped (content kept). */
const ALLOWED_TAGS = new Set([
	'div', 'span', 'a', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
	'caption', 'colgroup', 'col',
	'p', 'br', 'hr',
	'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'sub', 'sup',
	'code', 'pre', 'kbd', 'samp', 'var',
	'blockquote', 'q', 'cite',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
	'ul', 'ol', 'li', 'dl', 'dt', 'dd',
	'img', 'figure', 'figcaption',
	'details', 'summary',
	'abbr', 'address', 'mark', 'small', 'time',
]);

/** Allowed attributes (checked by name, not by element). */
const ALLOWED_ATTRS = new Set([
	'href', 'src', 'alt', 'title', 'class', 'id', 'lang', 'dir',
	'colspan', 'rowspan', 'headers', 'scope',
	'width', 'height',
	'align', 'valign',
	'border', 'cellpadding', 'cellspacing',
	'target', 'rel',
	'loading', 'decoding',
	'open',
	'start', 'type', 'reversed',
]);

/** Attribute names that are always stripped regardless of element. */
const DANGEROUS_ATTR_PREFIXES = ['on'];
const DANGEROUS_URL_PREFIXES = ['javascript:', 'vbscript:', 'data:text/html'];

function isDangerousUrl(url: string): boolean {
	const lower = url.trim().toLowerCase();
	return DANGEROUS_URL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function sanitizeUrl(url: string | undefined): string | undefined {
	if (!url) {
		return undefined;
	}

	const trimmed = url.trim();
	if (!trimmed) {
		return undefined;
	}

	if (isDangerousUrl(trimmed)) {
		return undefined;
	}

	// Allow http, https, mailto, and relative URLs
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
			return trimmed;
		}
		return undefined;
	} catch {
		// Relative URL — allow if it doesn't start with a dangerous prefix
		if (isDangerousUrl(trimmed)) {
			return undefined;
		}
		return trimmed;
	}
}

function sanitizeAttrs(attrs: string): string {
	if (!attrs.trim()) {
		return '';
	}

	const result: string[] = [];

	// Match attribute name="value" or name='value' or name=value
	const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
	let match: RegExpExecArray | null;

	while ((match = attrRegex.exec(attrs)) !== null) {
		const name = match[1].toLowerCase();
		const value = match[2] ?? match[3] ?? match[4] ?? '';

		// Strip dangerous attributes
		if (DANGEROUS_ATTR_PREFIXES.some((prefix) => name.startsWith(prefix))) {
			continue;
		}

		if (!ALLOWED_ATTRS.has(name)) {
			continue;
		}

		// Sanitize URL attributes
		if (name === 'href' || name === 'src') {
			const sanitized = sanitizeUrl(value);
			if (!sanitized) {
				continue;
			}
			result.push(`${name}="${sanitized.replace(/"/g, '&quot;')}"`);
			continue;
		}

		result.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
	}

	return result.length ? ` ${result.join(' ')}` : '';
}

function sanitizeTag(tagName: string, attrs: string): string {
	const lower = tagName.toLowerCase();

	if (STRIP_TAGS.has(lower)) {
		return '';
	}

	if (!ALLOWED_TAGS.has(lower)) {
		return '';
	}

	const safeAttrs = sanitizeAttrs(attrs);
	return `<${lower}${safeAttrs}>`;
}

/**
 * Sanitize raw HTML content.
 * - Strips dangerous tags entirely (script, style, iframe, etc.)
 * - Allows a whitelist of safe tags
 * - Strips dangerous attributes (onclick, onerror, etc.)
 * - Sanitizes URLs in href and src attributes
 */
export function sanitizeHtml(html: string): string {
	if (!html) {
		return '';
	}

	let result = '';
	let pos = 0;
	const len = html.length;

	while (pos < len) {
		const lt = html.indexOf('<', pos);

		if (lt === -1) {
			result += html.slice(pos);
			break;
		}

		// Append text before this tag
		result += html.slice(pos, lt);

		// Find the end of the tag name
		const tagStart = lt + 1;
		if (tagStart >= len) {
			result += '&lt;';
			break;
		}

		// Check for closing tag: </tag>
		if (html[tagStart] === '/') {
			const gt = html.indexOf('>', tagStart);
			if (gt === -1) {
				result += '&lt;/';
				pos = tagStart;
				continue;
			}

			const tagName = html.slice(tagStart + 1, gt).trim().split(/\s+/)[0].toLowerCase();

			if (STRIP_TAGS.has(tagName)) {
				// Skip closing tag for stripped elements
				pos = gt + 1;
				continue;
			}

			if (!ALLOWED_TAGS.has(tagName) && tagName) {
				// Unknown tag — skip closing tag but keep content
				pos = gt + 1;
				continue;
			}

			result += `</${tagName}>`;
			pos = gt + 1;
			continue;
		}

		// Self-closing tag: <br/>, <hr/>, <img ... />
		// Or opening tag: <div class="foo">
		const gt = html.indexOf('>', tagStart);
		if (gt === -1) {
			result += '&lt;';
			pos = tagStart;
			continue;
		}

		const tagContent = html.slice(tagStart, gt);
		const spaceIdx = tagContent.search(/\s/);
		let tagName: string;
		let attrs: string;
		let selfClosing = false;

		if (spaceIdx === -1) {
			tagName = tagContent;
			attrs = '';
		} else {
			tagName = tagContent.slice(0, spaceIdx);
			attrs = tagContent.slice(spaceIdx);
		}

		// Handle self-closing
		if (tagName.endsWith('/')) {
			tagName = tagName.slice(0, -1);
			selfClosing = true;
		}
		if (attrs.endsWith('/')) {
			attrs = attrs.slice(0, -1);
			selfClosing = true;
		}

		const lower = tagName.toLowerCase();

		// Comments: <!-- ... -->
		if (lower.startsWith('!')) {
			// Could be <!-- ... --> or <!DOCTYPE ...>
			if (html.slice(lt, lt + 4) === '<!--') {
				const commentEnd = html.indexOf('-->', lt + 4);
				if (commentEnd !== -1) {
					pos = commentEnd + 3;
					continue;
				}
			}
			// Skip DOCTYPE and other declarations
			pos = gt + 1;
			continue;
		}

		if (STRIP_TAGS.has(lower)) {
			// For script and style, find the closing tag
			const closeTag = `</${lower}`;
			const closeIdx = html.toLowerCase().indexOf(closeTag, gt + 1);
			if (closeIdx !== -1) {
				const closeGt = html.indexOf('>', closeIdx);
				pos = closeGt !== -1 ? closeGt + 1 : closeIdx + closeTag.length;
			} else {
				pos = gt + 1;
			}
			continue;
		}

		if (!ALLOWED_TAGS.has(lower)) {
			// Unknown tag — strip the tag but keep inner content
			pos = gt + 1;
			continue;
		}

		const sanitizedTag = sanitizeTag(tagName, attrs);
		if (sanitizedTag) {
			result += sanitizedTag;
		}

		pos = gt + 1;
	}

	return result;
}

/**
 * Check if a string contains HTML tags.
 */
export function containsHtmlTags(text: string): boolean {
	return /<[a-zA-Z][^>]*>/.test(text);
}
