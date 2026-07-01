import * as assert from 'assert';
import { mapIssueOperationLog, mapIssueOperationLogs } from '../gitcode/mappers/issueOperationLogMapper';

suite('IssueOperationLogMapper', () => {
	test('maps the documented sample item', () => {
		const result = mapIssueOperationLog({
			id: 177875197,
			content: 'changed title from **old** to **new**',
			action_type: 'title',
			issue_id: '4126565',
			created_at: '2026-06-30T17:58:21+08:00',
			update_at: '2026-06-30T17:58:21+08:00',
			user: {
				id: '695337496415d64a21d4d6c7',
				login: 'tangxuanya',
				name: 'Tang Xuanya',
				html_url: 'https://gitcode.com/tangxuanya',
			},
		});

		assert.deepStrictEqual(result, {
			id: '177875197',
			content: 'changed title from **old** to **new**',
			actionType: 'title',
			issueId: '4126565',
			actor: {
				id: '695337496415d64a21d4d6c7',
				login: 'tangxuanya',
				name: 'Tang Xuanya',
				htmlUrl: 'https://gitcode.com/tangxuanya',
			},
			createdAt: '2026-06-30T17:58:21+08:00',
			updatedAt: '2026-06-30T17:58:21+08:00',
		});
	});

	test('falls back for missing actor and action type', () => {
		const result = mapIssueOperationLog({
			id: '2',
			content: undefined,
			created_at: '2026-07-01T09:00:00+08:00',
		});

		assert.strictEqual(result.content, '');
		assert.strictEqual(result.actionType, 'activity');
		assert.strictEqual(result.actor.login, 'unknown');
	});

	test('sorts by ascending date and falls back to id for invalid dates', () => {
		const result = mapIssueOperationLogs([
			{ id: 3, created_at: 'invalid', action_type: 'label' },
			{ id: 2, created_at: 'invalid', action_type: 'label' },
			{ id: 10, created_at: '2026-07-01T10:00:00+08:00', action_type: 'title' },
			{ id: 9, created_at: '2026-07-01T09:00:00+08:00', action_type: 'milestone' },
		]);

		assert.deepStrictEqual(result.map((item) => item.id), ['2', '3', '9', '10']);
	});

	test('prefers updated_at and falls back to update_at', () => {
		const first = mapIssueOperationLog({ id: 1, updated_at: '2026-07-01T10:00:00+08:00' });
		const second = mapIssueOperationLog({ id: 2, update_at: '2026-07-01T11:00:00+08:00' });

		assert.strictEqual(first.updatedAt, '2026-07-01T10:00:00+08:00');
		assert.strictEqual(second.updatedAt, '2026-07-01T11:00:00+08:00');
	});
});