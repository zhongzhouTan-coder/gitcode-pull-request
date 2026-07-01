import * as assert from 'assert';
import { GitCodeRepository, PullRequestSummary } from '../common/models';
import { PullRequestNode } from '../view/tree/nodes/pullRequestNode';

suite('PullRequestNode', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	const pullRequest: PullRequestSummary = {
		id: 1,
		number: 42,
		title: 'Add feature',
		author: 'testuser',
		updatedAt: '2026-07-01T00:00:00Z',
	};

	test('uses category in tree item id so duplicate pull requests remain unique', () => {
		const allOpenNode = new PullRequestNode(repository, 'allOpen', pullRequest, {} as any, () => 'tree');
		const createdByMeNode = new PullRequestNode(repository, 'createdByMe', pullRequest, {} as any, () => 'tree');

		assert.strictEqual(allOpenNode.getTreeItem().id, 'pullRequest:org/repo:allOpen:42');
		assert.strictEqual(createdByMeNode.getTreeItem().id, 'pullRequest:org/repo:createdByMe:42');
		assert.notStrictEqual(allOpenNode.getTreeItem().id, createdByMeNode.getTreeItem().id);
	});
});
