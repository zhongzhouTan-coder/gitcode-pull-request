import {
	PullRequestDiffFileContext,
	PullRequestDiffFileContextLine,
	PullRequestDiffRefs,
	PullRequestDiffSnapshot,
	PullRequestFileJsonDto,
	PullRequestFileJsonLineDto,
	PullRequestFilesJsonDto,
} from '../../common/models';

export function mapDiffSnapshot(dto: PullRequestFilesJsonDto): PullRequestDiffSnapshot {
	const refs = mapDiffRefs(dto);
	const fileTypes = new Map<string, string>();
	const files: PullRequestDiffFileContext[] = [];

	if (dto.diffs) {
		for (const file of dto.diffs) {
			const statistic = file.statistic;
			const path = statistic?.new_path ?? statistic?.path ?? statistic?.old_path;
			if (path && statistic?.type) {
				fileTypes.set(path, statistic.type);
			}
			const context = mapDiffFileContext(file);
			if (context) {
				files.push(context);
			}
		}
	}

	return { refs, fileTypes, files };
}

function mapDiffRefs(dto: PullRequestFilesJsonDto): PullRequestDiffRefs {
	const baseSha = normalizeSha(dto.diff_refs?.base_sha);
	const headSha = normalizeSha(dto.diff_refs?.head_sha);

	if (!baseSha || !headSha) {
		throw new Error('diff_refs is missing base_sha or head_sha');
	}

	return {
		baseSha,
		startSha: normalizeSha(dto.diff_refs?.start_sha),
		headSha,
	};
}

function normalizeSha(value: string | undefined): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	// SHA should be a hex string of at least 7 characters
	if (!/^[0-9a-f]{7,}$/i.test(trimmed)) {
		return undefined;
	}

	return trimmed;
}

function mapDiffFileContext(dto: PullRequestFileJsonDto): PullRequestDiffFileContext | undefined {
	const statistic = dto.statistic;
	const path = statistic?.new_path ?? statistic?.path ?? statistic?.old_path;
	if (!path) {
		return undefined;
	}

	const lines = (dto.content?.text ?? [])
		.map(mapDiffFileContextLine)
		.filter((line): line is PullRequestDiffFileContextLine => line !== undefined);

	return {
		path,
		previousPath: statistic?.old_path && statistic.old_path !== path ? statistic.old_path : undefined,
		type: statistic?.type,
		lines,
	};
}

function mapDiffFileContextLine(dto: PullRequestFileJsonLineDto): PullRequestDiffFileContextLine | undefined {
	const content = typeof dto.line_content === 'string' ? dto.line_content : '';
	if (content.startsWith('@@')) {
		return undefined;
	}

	const oldLine = lineNumber(dto.old_line);
	const newLine = lineNumber(dto.new_line);
	const kind = diffLineKind(dto.type, oldLine, newLine);
	if (!kind || (oldLine === undefined && newLine === undefined)) {
		return undefined;
	}

	return {
		kind,
		oldLine,
		newLine,
		content: normalizeLineContent(content, kind),
	};
}

function lineNumber(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
		return value;
	}

	if (typeof value === 'object' && value !== null && 'line_num' in value) {
		const lineNum = (value as { line_num?: unknown }).line_num;
		if (typeof lineNum === 'number' && Number.isInteger(lineNum) && lineNum > 0) {
			return lineNum;
		}
	}

	return undefined;
}

function diffLineKind(type: unknown, oldLine: number | undefined, newLine: number | undefined): PullRequestDiffFileContextLine['kind'] | undefined {
	if (type === 'old') {
		return 'delete';
	}
	if (type === 'new') {
		return 'add';
	}
	if (oldLine !== undefined && newLine !== undefined) {
		return 'context';
	}
	if (newLine !== undefined) {
		return 'add';
	}
	if (oldLine !== undefined) {
		return 'delete';
	}
	return undefined;
}

function normalizeLineContent(content: string, kind: PullRequestDiffFileContextLine['kind']): string {
	if (kind === 'add' && content.startsWith('+')) {
		return content.slice(1);
	}
	if (kind === 'delete' && content.startsWith('-')) {
		return content.slice(1);
	}
	if (kind === 'context' && content.startsWith(' ')) {
		return content.slice(1);
	}
	return content;
}
