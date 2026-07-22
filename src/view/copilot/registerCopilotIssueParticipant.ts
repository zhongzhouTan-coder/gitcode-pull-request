import * as vscode from 'vscode';
import { CopilotIssueContextStore } from './copilotIssueContextStore';
import { CopilotIssueContextBuilder } from './copilotIssueContextBuilder';
import { CopilotPromptBudget, createPromptBudget } from './copilotPromptBudget';

const PARTICIPANT_ID = 'gitcode-issue.context';

const DEFAULT_SYSTEM_INSTRUCTION = `You are helping with the selected GitCode issue. Use the supplied issue
details, comments, related pull requests, and workspace metadata. Prioritize
reported behavior, expected behavior, reproduction steps, likely root cause,
implementation plan, test plan, and pull request draft. Do not claim that code
has been changed, branches have been created, commits have been pushed, or pull
requests have been opened unless the extension explicitly reports that action.`;

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function registerCopilotIssueParticipant(
	store: CopilotIssueContextStore,
	contextBuilder: CopilotIssueContextBuilder,
): vscode.Disposable {
	const participant = vscode.chat.createChatParticipant(
		PARTICIPANT_ID,
		async (request, _context, stream, token) => {
			const selected = store.getSelected();
			if (!selected) {
				stream.markdown('Select a GitCode issue first with **GitCode: Use Issue as Copilot Context**.');
				return;
			}

			const budget = createPromptBudget(request.model);

			// Load issue context
			let contextText: string;
			try {
				contextText = await contextBuilder.build(selected, token, budget);
			} catch (error) {
				if (!token.isCancellationRequested) {
					stream.markdown(`Failed to load issue context: ${errorMessage(error)}`);
				}
				return;
			}

			if (token.isCancellationRequested) {
				return;
			}

			const messages = [
				vscode.LanguageModelChatMessage.User(DEFAULT_SYSTEM_INSTRUCTION),
				vscode.LanguageModelChatMessage.User(contextText),
				vscode.LanguageModelChatMessage.User(request.prompt),
			];

			try {
				const response = await request.model.sendRequest(messages, {
					justification: 'Use the selected GitCode issue as chat context.',
				}, token);

				for await (const chunk of response.text) {
					stream.markdown(chunk);
				}
			} catch (error) {
				if (!token.isCancellationRequested) {
					stream.markdown(`Language model request failed: ${errorMessage(error)}`);
				}
			}
		},
	);

	participant.iconPath = new vscode.ThemeIcon('issues');
	return participant;
}
