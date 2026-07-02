import * as vscode from 'vscode';
import { CopilotIssueContextStore } from './copilotIssueContextStore';
import { CopilotIssueContextBuilder } from './copilotIssueContextBuilder';
import { registerCopilotContextParticipant } from './registerCopilotContextParticipant';

const PARTICIPANT_ID = 'gitcode-issue.context';

const DEFAULT_SYSTEM_INSTRUCTION = `You are helping settle the selected GitCode issue. Use the supplied issue
details, comments, related pull requests, and workspace metadata. Prioritize
reported behavior, expected behavior, reproduction steps, likely root cause,
implementation plan, test plan, and pull request draft. Do not claim that code
has been changed, branches have been created, commits have been pushed, or pull
requests have been opened unless the extension explicitly reports that action.`;

export function registerCopilotIssueParticipant(
	store: CopilotIssueContextStore,
	contextBuilder: CopilotIssueContextBuilder,
): vscode.Disposable {
	return registerCopilotContextParticipant({
		participantId: PARTICIPANT_ID,
		icon: new vscode.ThemeIcon('issues'),
		getSelected: () => store.getSelected(),
		missingSelectionMessage: 'Select a GitCode issue first with **GitCode: Use Issue as Copilot Context**.',
		buildContext: (selected, budget, token) => contextBuilder.build(selected, token, budget),
		systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
		requestJustification: 'Use the selected GitCode issue as manual chat context.',
		loadFailurePrefix: 'Failed to load issue context',
	});
}
