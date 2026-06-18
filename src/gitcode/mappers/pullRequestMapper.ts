import { PullRequestSummary } from '../../common/models';

interface UserLike {
	login?: string;
	username?: string;
	name?: string;
}

function pickUserName(user: UserLike | undefined): string {
	return user?.login ?? user?.username ?? user?.name ?? 'unknown';
}

export function mapPullRequest(dto: any): PullRequestSummary {
	return {
		id: Number(dto.id ?? dto.number ?? dto.iid ?? 0),
		number: Number(dto.number ?? dto.iid ?? dto.id ?? 0),
		title: String(dto.title ?? 'Untitled pull request'),
		author: pickUserName(dto.user ?? dto.author),
		updatedAt: String(dto.updated_at ?? dto.updatedAt ?? ''),
		sourceBranch: dto.head?.ref ?? dto.head_branch ?? dto.source_branch,
		targetBranch: dto.base?.ref ?? dto.base_branch ?? dto.target_branch,
		url: dto.html_url ?? dto.web_url ?? dto.url,
		isDraft: Boolean(dto.draft),
	};
}
