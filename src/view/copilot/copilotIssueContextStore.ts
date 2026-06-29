import { GitCodeRepository } from '../../common/models';

export interface SelectedCopilotIssue {
	repository: GitCodeRepository;
	issueNumber: number;
	title: string;
	url?: string;
}

export class CopilotIssueContextStore {
	private selected?: SelectedCopilotIssue;

	select(value: SelectedCopilotIssue): void {
		this.selected = value;
	}

	getSelected(): SelectedCopilotIssue | undefined {
		return this.selected;
	}

	clear(): void {
		this.selected = undefined;
	}
}
