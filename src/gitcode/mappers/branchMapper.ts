import { GitCodeBranch } from '../../common/models';

export function mapBranch(dto: any): GitCodeBranch {
	return {
		name: String(dto?.name ?? ''),
		sha: typeof dto?.commit?.sha === 'string' ? dto.commit.sha : undefined,
		isDefault: Boolean(dto?.is_default_branch ?? dto?.default_branch ?? dto?.isDefault ?? false),
		isProtected: Boolean(dto?.protected ?? dto?.isProtected ?? false),
		lastCommitMessage: typeof dto?.commit?.message === 'string' ? dto.commit.message : undefined,
	};
}

export function mapBranches(dtos: any[]): GitCodeBranch[] {
	return dtos.map(mapBranch);
}
