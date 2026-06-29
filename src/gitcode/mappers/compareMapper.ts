import { GitCodeCompareResult, GitCodeCompareCommit, GitCodeCompareFile } from '../../common/models';

function mapCompareCommit(dto: any): GitCodeCompareCommit {
	return {
		sha: String(dto?.sha ?? ''),
		message: String(dto?.commit?.message ?? dto?.message ?? ''),
		authorName: dto?.commit?.author?.name ?? dto?.author?.name ?? dto?.authorName,
	};
}

function mapCompareFile(dto: any): GitCodeCompareFile {
	return {
		path: String(dto?.path ?? dto?.filename ?? ''),
		status: String(dto?.status ?? ''),
		additions: Number(dto?.additions ?? dto?.stats?.additions ?? 0),
		deletions: Number(dto?.deletions ?? dto?.stats?.deletions ?? 0),
	};
}

export function mapCompareResult(dto: any): GitCodeCompareResult {
	return {
		baseSha: typeof dto?.base_sha === 'string' ? dto.base_sha : typeof dto?.base_commit?.sha === 'string' ? dto.base_commit.sha : undefined,
		mergeBaseSha: typeof dto?.merge_base_sha === 'string' ? dto.merge_base_sha : undefined,
		commits: Array.isArray(dto?.commits) ? dto.commits.map(mapCompareCommit) : [],
		files: Array.isArray(dto?.files) ? dto.files.map(mapCompareFile) : Array.isArray(dto?.diffs) ? dto.diffs.map(mapCompareFile) : [],
		truncated: Boolean(dto?.truncated ?? false),
	};
}
