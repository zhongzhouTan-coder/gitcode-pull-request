import * as assert from 'assert';
import { CopilotIssueContextStore } from '../view/copilot/copilotIssueContextStore';
import { GitCodeRepository } from '../common/models';

const repository: GitCodeRepository = {
	remoteName: 'origin',
	owner: 'owner',
	name: 'repo',
	fullName: 'owner/repo',
	webUrl: 'https://gitcode.com/owner/repo',
};

suite('CopilotIssueContextStore', () => {
	test('returns undefined when no issue is selected', () => {
		const store = new CopilotIssueContextStore();
		assert.strictEqual(store.getSelected(), undefined);
	});

	test('selects and returns the selected issue', () => {
		const store = new CopilotIssueContextStore();
		store.select({
			repository,
			issueNumber: 309,
			title: 'Quantization warning for Qwen3.6',
			url: 'https://gitcode.com/owner/repo/issues/309',
		});

		const selected = store.getSelected();
		assert.ok(selected);
		assert.strictEqual(selected!.repository.fullName, 'owner/repo');
		assert.strictEqual(selected!.issueNumber, 309);
		assert.strictEqual(selected!.title, 'Quantization warning for Qwen3.6');
		assert.strictEqual(selected!.url, 'https://gitcode.com/owner/repo/issues/309');
	});

	test('clear removes the selected issue', () => {
		const store = new CopilotIssueContextStore();
		store.select({
			repository,
			issueNumber: 309,
			title: 'Test',
		});
		assert.ok(store.getSelected());

		store.clear();
		assert.strictEqual(store.getSelected(), undefined);
	});

	test('subsequent select replaces the previous selection', () => {
		const store = new CopilotIssueContextStore();
		store.select({
			repository,
			issueNumber: 1,
			title: 'First issue',
		});
		store.select({
			repository,
			issueNumber: 2,
			title: 'Second issue',
		});

		const selected = store.getSelected();
		assert.strictEqual(selected!.issueNumber, 2);
		assert.strictEqual(selected!.title, 'Second issue');
	});
});
