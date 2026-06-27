import * as vscode from 'vscode';
import { CopilotPullRequestContextStore } from './copilotPullRequestContextStore';
import { CopilotPullRequestContextBuilder } from './copilotPullRequestContextBuilder';

const PARTICIPANT_ID = 'gitcode-pull-request.context';

const DEFAULT_SYSTEM_INSTRUCTION = `You are reviewing the selected GitCode pull request. Use the supplied PR details,
file changes, and comments. Prioritize correctness bugs, regressions, security
risks, unclear behavior, and missing tests. If the user asks for a different task,
follow that task using the same PR context.`;

export function registerCopilotPullRequestParticipant(
	store: CopilotPullRequestContextStore,
	contextBuilder: CopilotPullRequestContextBuilder,
): vscode.Disposable {
	const participant = vscode.chat.createChatParticipant(
		PARTICIPANT_ID,
		async (request, _context, stream, token) => {
			const selected = store.getSelected();
			if (!selected) {
				stream.markdown(
					'Select a GitCode pull request first with **GitCode: Use Pull Request as Copilot Context**.',
				);
				return;
			}

			try {
				const pullRequestContext = await contextBuilder.build(selected, token);

				if (token.isCancellationRequested) {
					return;
				}

				const messages = [
					vscode.LanguageModelChatMessage.User(DEFAULT_SYSTEM_INSTRUCTION),
					vscode.LanguageModelChatMessage.User(pullRequestContext),
					vscode.LanguageModelChatMessage.User(request.prompt),
				];

				const response = await request.model.sendRequest(messages, {
					justification: 'Use the selected GitCode pull request as manual chat context.',
				}, token);

				for await (const chunk of response.text) {
					stream.markdown(chunk);
				}
			} catch (error) {
				if (token.isCancellationRequested) {
					return;
				}

				stream.markdown(
					`Failed to load pull request context: ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
			}
		},
	);

	participant.iconPath = new vscode.ThemeIcon('git-pull-request');

	return participant;
}
