import { GitCodeRepositoryDetail } from '../../common/models';

export function mapRepositoryDetail(dto: any): GitCodeRepositoryDetail {
	return {
		id: Number(dto?.id ?? 0),
		fullName: String(dto?.full_name ?? dto?.path ?? dto?.fullName ?? ''),
		name: String(dto?.name ?? ''),
		path: String(dto?.path ?? dto?.full_name ?? ''),
		defaultBranch: String(dto?.default_branch ?? dto?.defaultBranch ?? 'main'),
		webUrl: String(dto?.web_url ?? dto?.html_url ?? ''),
		fork: Boolean(dto?.fork ?? dto?.is_fork ?? false),
	};
}
