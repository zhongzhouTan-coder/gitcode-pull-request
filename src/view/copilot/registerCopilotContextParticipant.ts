import * as vscode from 'vscode';
import { CopilotPromptBudget, createPromptBudget } from './copilotPromptBudget';

export interface CopilotContextParticipantOptions<TSelected> {
	participantId: string;
	icon: vscode.ThemeIcon;
	getSelected(): TSelected | undefined;
	missingSelectionMessage: string;
	buildContext(
		selected: TSelected,
		budget: CopilotPromptBudget,
		token: vscode.CancellationToken,
	): Promise<string>;
	systemInstruction: string;
	requestJustification: string;
	loadFailurePrefix: string;
}

export function registerCopilotContextParticipant<TSelected>(
	options: CopilotContextParticipantOptions<TSelected>,
): vscode.Disposable {
	const participant = vscode.chat.createChatParticipant(
		options.participantId,
		async (request, _context, stream, token) => {
			const selected = options.getSelected();
			if (!selected) {
				stream.markdown(options.missingSelectionMessage);
				return;
			}

			const budget = createPromptBudget(request.model);
			let contextText: string;
			try {
				contextText = await options.buildContext(selected, budget, token);
			} catch (error) {
				if (token.isCancellationRequested) {
					return;
				}

				stream.markdown(`${options.loadFailurePrefix}: ${errorMessage(error)}`);
				return;
			}

			if (token.isCancellationRequested) {
				return;
			}

			const messages = [
				vscode.LanguageModelChatMessage.User(options.systemInstruction),
				vscode.LanguageModelChatMessage.User(contextText),
				vscode.LanguageModelChatMessage.User(request.prompt),
			];

			try {
				const response = await request.model.sendRequest(messages, {
					justification: options.requestJustification,
				}, token);

				for await (const chunk of response.text) {
					stream.markdown(chunk);
				}
			} catch (error) {
				if (token.isCancellationRequested) {
					return;
				}

				stream.markdown(`Language model request failed: ${errorMessage(error)}`);
			}
		},
	);

	participant.iconPath = options.icon;
	return participant;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
