import * as vscode from 'vscode';

export interface CopilotPromptBudget {
	maxContextChars: number;
	maxBodyChars: number;
	maxDiffCommentChars: number;
	maxPullRequestCommentChars: number;
	maxPatchChars: number;
	maxReplyChars: number;
}

export function createPromptBudget(model: vscode.LanguageModelChat): CopilotPromptBudget {
	const maxInputTokens = model.maxInputTokens ?? 16_000;
	const reservedTokens = Math.max(2_000, Math.floor(maxInputTokens * 0.25));
	const usableTokens = Math.max(4_000, maxInputTokens - reservedTokens);
	const maxContextChars = usableTokens * 4;

	return {
		maxContextChars,
		maxBodyChars: Math.min(12_000, Math.floor(maxContextChars * 0.25)),
		maxDiffCommentChars: Math.min(2_500, Math.floor(maxContextChars * 0.08)),
		maxPullRequestCommentChars: Math.min(1_500, Math.floor(maxContextChars * 0.05)),
		maxPatchChars: Math.min(4_000, Math.floor(maxContextChars * 0.10)),
		maxReplyChars: Math.min(1_000, Math.floor(maxContextChars * 0.03)),
	};
}

export const DEFAULT_COPILOT_PROMPT_BUDGET: CopilotPromptBudget = {
	maxContextChars: 40_000,
	maxBodyChars: 12_000,
	maxDiffCommentChars: 2_500,
	maxPullRequestCommentChars: 1_500,
	maxPatchChars: 4_000,
	maxReplyChars: 1_000,
};
