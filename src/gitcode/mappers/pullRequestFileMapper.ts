import { PullRequestFileChange, PullRequestFileStatus } from '../../common/models';

interface PatchDto {
	diff?: string;
	old_path?: string;
	new_path?: string;
	new_file?: boolean;
	renamed_file?: boolean;
	deleted_file?: boolean;
	too_large?: boolean;
}

interface FileDto {
	sha?: string;
	filename?: string;
	status?: string;
	additions?: number;
	deletions?: number;
	blob_id?: string;
	blob_url?: string;
	raw_url?: string;
	patch?: PatchDto;
	source_branch?: string;
	target_branch?: string;
	source_project?: {
		full_name?: string;
	};
	target_project?: {
		full_name?: string;
	};
}

function resolvePath(dto: FileDto): string {
	const patch = dto.patch;
	if (patch?.new_path) {
		return patch.new_path;
	}

	if (dto.filename) {
		return dto.filename;
	}

	return patch?.old_path ?? '';
}

function resolveStatus(dto: FileDto): PullRequestFileStatus {
	const patch = dto.patch;
	if (patch?.deleted_file === true) {
		return 'deleted';
	}

	if (patch?.renamed_file === true) {
		return 'renamed';
	}

	if (patch?.new_file === true) {
		return 'added';
	}

	const status = dto.status?.toLowerCase();
	if (status === 'added' || status === 'modified' || status === 'deleted' || status === 'renamed') {
		return status;
	}

	return 'modified';
}

function normalizeUrl(value?: string): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

export function mapPullRequestFile(dto: FileDto): PullRequestFileChange {
	const patch = dto.patch;

	return {
		sha: String(dto.sha ?? ''),
		path: resolvePath(dto),
		previousPath: patch?.renamed_file ? (patch.old_path ?? undefined) : undefined,
		status: resolveStatus(dto),
		additions: typeof dto.additions === 'number' && dto.additions >= 0 ? dto.additions : 0,
		deletions: typeof dto.deletions === 'number' && dto.deletions >= 0 ? dto.deletions : 0,
		blobId: dto.blob_id ?? undefined,
		blobUrl: normalizeUrl(dto.blob_url),
		rawUrl: normalizeUrl(dto.raw_url),
		patch: patch?.diff?.trim() ? patch.diff : undefined,
		tooLarge: patch?.too_large === true,
		sourceBranch: dto.source_branch ?? undefined,
		targetBranch: dto.target_branch ?? undefined,
		sourceRepository: dto.source_project?.full_name ?? undefined,
		targetRepository: dto.target_project?.full_name ?? undefined,
	};
}

export function mapPullRequestFiles(dtos: FileDto[]): PullRequestFileChange[] {
	return dtos.map(mapPullRequestFile);
}
