import * as assert from 'assert';
import * as vscode from 'vscode';
import { createPromptBudget } from '../view/copilot/copilotPromptBudget';

suite('CopilotPromptBudget', () => {
	test('scales down for smaller models', () => {
		const budget = createPromptBudget({ maxInputTokens: 8_000 } as vscode.LanguageModelChat);

		assert.strictEqual(budget.maxContextChars, 24_000);
		assert.strictEqual(budget.maxBodyChars, 6_000);
		assert.strictEqual(budget.maxPatchChars, 2_400);
	});

	test('caps per-section budgets for larger models', () => {
		const budget = createPromptBudget({ maxInputTokens: 64_000 } as vscode.LanguageModelChat);

		assert.strictEqual(budget.maxContextChars, 192_000);
		assert.strictEqual(budget.maxBodyChars, 12_000);
		assert.strictEqual(budget.maxDiffCommentChars, 2_500);
		assert.strictEqual(budget.maxPullRequestCommentChars, 1_500);
		assert.strictEqual(budget.maxPatchChars, 4_000);
	});
});
