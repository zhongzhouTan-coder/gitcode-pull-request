import { GitCodeRepository } from '../../common/models';

export interface SelectedCopilotPullRequest {
	repository: GitCodeRepository;
	pullRequestNumber: number;
	title: string;
	url?: string;
}

export class CopilotPullRequestContextStore {
	private selected?: SelectedCopilotPullRequest;

	select(value: SelectedCopilotPullRequest): void {
		this.selected = value;
	}

	getSelected(): SelectedCopilotPullRequest | undefined {
		return this.selected;
	}

	clear(): void {
		this.selected = undefined;
	}
}
