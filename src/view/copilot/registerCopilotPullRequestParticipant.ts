import * as vscode from 'vscode';
import { CopilotPullRequestContextStore } from './copilotPullRequestContextStore';
import { CopilotPullRequestContextBuilder } from './copilotPullRequestContextBuilder';
import { registerCopilotContextParticipant } from './registerCopilotContextParticipant';

const PARTICIPANT_ID = 'gitcode.context';

const DEFAULT_SYSTEM_INSTRUCTION = `You are reviewing the selected GitCode pull request. Use the supplied PR details,
file changes, and comments. Prioritize correctness bugs, regressions, security
risks, unclear behavior, and missing tests. If the user asks for a different task,
follow that task using the same PR context.`;

export function registerCopilotPullRequestParticipant(
	store: CopilotPullRequestContextStore,
	contextBuilder: CopilotPullRequestContextBuilder,
): vscode.Disposable {
	return registerCopilotContextParticipant({
		participantId: PARTICIPANT_ID,
		icon: new vscode.ThemeIcon('git-pull-request'),
		getSelected: () => store.getSelected(),
		missingSelectionMessage: 'Select a GitCode pull request first with **GitCode: Use Pull Request as Copilot Context**.',
		buildContext: (selected, budget, token) => contextBuilder.build(selected, token, budget),
		systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
		requestJustification: 'Use the selected GitCode pull request as manual chat context.',
		loadFailurePrefix: 'Failed to load pull request context',
	});
}
