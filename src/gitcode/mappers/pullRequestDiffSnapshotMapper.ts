import { PullRequestDiffRefs, PullRequestDiffSnapshot, PullRequestFilesJsonDto } from '../../common/models';

export function mapDiffSnapshot(dto: PullRequestFilesJsonDto): PullRequestDiffSnapshot {
	const refs = mapDiffRefs(dto);
	const fileTypes = new Map<string, string>();

	if (dto.diffs) {
		for (const file of dto.diffs) {
			const statistic = file.statistic;
			const path = statistic?.new_path ?? statistic?.path ?? statistic?.old_path;
			if (path && statistic?.type) {
				fileTypes.set(path, statistic.type);
			}
		}
	}

	return { refs, fileTypes };
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
