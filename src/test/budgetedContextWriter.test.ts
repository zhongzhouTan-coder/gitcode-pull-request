import * as assert from 'assert';
import { BudgetedContextWriter } from '../view/copilot/budgetedContextWriter';

suite('BudgetedContextWriter', () => {
	test('preserves truncation marker when text exceeds budget', () => {
		const writer = new BudgetedContextWriter(18);

		writer.append('abcdefghijklmnopqrstuvwxyz');

		assert.match(writer.toString(), /\[truncated\]$/);
		assert.strictEqual(writer.wasTruncated(), true);
		assert.ok(writer.toString().length <= 18);
	});

	test('appendTruncated marks section truncation', () => {
		const writer = new BudgetedContextWriter(100);

		writer.appendTruncated('abcdef', 3);

		assert.strictEqual(writer.toString(), 'abc\n[truncated]');
		assert.strictEqual(writer.wasTruncated(), true);
	});
});
