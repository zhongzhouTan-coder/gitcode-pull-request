import {
	PullRequestCommentsSnapshot,
	PullRequestDiffComment,
	PullRequestFileChange,
} from '../../common/models';

export interface DiffCommentContextLine {
	kind: 'context' | 'add' | 'delete';
	oldLine?: number;
	newLine?: number;
	content: string;
	isCommentLine: boolean;
}

export interface DiffCommentContext {
	commentId: string;
	lines: readonly DiffCommentContextLine[];
}

interface ParsedPatchLine {
	kind: 'context' | 'add' | 'delete';
	oldLine?: number;
	newLine?: number;
	content: string;
}

const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const DEFAULT_CONTEXT_RADIUS = 3;

export function buildDiffCommentContexts(
	snapshot: PullRequestCommentsSnapshot,
	files: readonly PullRequestFileChange[],
): ReadonlyMap<string, DiffCommentContext> {
	const filesByPath = new Map<string, PullRequestFileChange>();
	for (const file of files) {
		filesByPath.set(file.path, file);
		if (file.previousPath) {
			filesByPath.set(file.previousPath, file);
		}
	}

	const contexts = new Map<string, DiffCommentContext>();
	for (const comment of snapshot.comments) {
		if (comment.kind !== 'diff' || !comment.location.path) {
			continue;
		}

		const file = filesByPath.get(comment.location.path);
		if (!file?.patch) {
			continue;
		}

		const lines = extractDiffContext(file.patch, comment);
		if (lines.length) {
			contexts.set(comment.id, {
				commentId: comment.id,
				lines,
			});
		}
	}

	return contexts;
}

export function extractDiffContext(
	patch: string,
	comment: PullRequestDiffComment,
	contextRadius = DEFAULT_CONTEXT_RADIUS,
): DiffCommentContextLine[] {
	const hunk = findHunkForNewLine(patch, comment.location.startLine);
	if (!hunk.length) {
		return [];
	}

	const anchorIndex = hunk.findIndex((line) => line.newLine === comment.location.startLine && line.kind !== 'delete');
	if (anchorIndex < 0) {
		return [];
	}

	const start = Math.max(0, anchorIndex - contextRadius);
	const end = Math.min(hunk.length, anchorIndex + contextRadius + 1);
	return hunk.slice(start, end).map((line) => ({
		...line,
		isCommentLine: line.kind !== 'delete'
			&& line.newLine !== undefined
			&& line.newLine >= comment.location.startLine
			&& line.newLine <= comment.location.endLine,
	}));
}

function findHunkForNewLine(patch: string, targetLine: number): ParsedPatchLine[] {
	let oldLine = 0;
	let newLine = 0;
	let currentHunk: ParsedPatchLine[] = [];
	let inHunk = false;

	for (const rawLine of patch.split(/\r?\n/)) {
		const header = HUNK_HEADER_PATTERN.exec(rawLine);
		if (header) {
			if (currentHunk.some((line) => line.newLine === targetLine)) {
				return currentHunk;
			}

			oldLine = Number(header[1]);
			newLine = Number(header[2]);
			currentHunk = [];
			inHunk = true;
			continue;
		}

		if (!inHunk) {
			continue;
		}

		if (rawLine.startsWith('\\')) {
			continue;
		}

		const prefix = rawLine[0];
		const content = rawLine.slice(1);

		if (prefix === '+') {
			currentHunk.push({ kind: 'add', newLine, content });
			newLine += 1;
			continue;
		}

		if (prefix === '-') {
			currentHunk.push({ kind: 'delete', oldLine, content });
			oldLine += 1;
			continue;
		}

		currentHunk.push({ kind: 'context', oldLine, newLine, content });
		oldLine += 1;
		newLine += 1;
	}

	return currentHunk.some((line) => line.newLine === targetLine) ? currentHunk : [];
}
