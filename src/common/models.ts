export interface GitCodeRepository {
	remoteName: string;
	owner: string;
	name: string;
	fullName: string;
	webUrl: string;
}

export interface PullRequestSummary {
	id: number;
	number: number;
	title: string;
	author: string;
	updatedAt: string;
	sourceBranch?: string;
	targetBranch?: string;
	url?: string;
	isDraft?: boolean;
}
