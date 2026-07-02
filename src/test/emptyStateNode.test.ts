import * as assert from 'assert';
import { EmptyStateNode } from '../view/tree/nodes/emptyStateNode';

suite('EmptyStateNode', () => {
	test('signIn creates a clickable sign-in command node', () => {
		const parent = new EmptyStateNode('Parent');
		const node = EmptyStateNode.signIn(parent);
		const item = node.getTreeItem();

		assert.strictEqual(item.label, 'Sign in to GitCode');
		assert.strictEqual(item.description, 'Click to sign in');
		assert.strictEqual(item.command?.command, 'gitcode.signIn');
		assert.strictEqual(item.command?.title, 'Sign in to GitCode');
		assert.strictEqual(node.parent, parent);
	});
});
