import * as assert from 'assert';
import { mapPullRequestOperationLog, mapPullRequestOperationLogs } from '../gitcode/mappers/pullRequestOperationLogMapper';

suite('PullRequestOperationLogMapper', () => {
	const sampleItem = {
		content: 'resolved all discussions',
		id: 177934270,
		action: 'discussion',
		merge_request_id: 8797630,
		created_at: '2026-07-01T00:10:02+08:00',
		updated_at: '2026-07-01T00:10:02+08:00',
		discussion_id: '16d6c1ab551818dd9e758137be483d79161a7f41',
		project: 'tangxuanya/msmodelslim',
		user: {
			id: '695337496415d64a21d4d6c7',
			name: 'tangxuanya',
			login: 'tangxuanya',
			iam_id: 'OkHqxXUduQJpeUFmvagZMsIrlr99OSb6',
			nick_name: 'tangxuanya',
			state: 'active',
			email: 'cqyzdp1@163.com',
			name_cn: '',
			web_url: 'https://gitcode.com/tangxuanya',
		},
		action_type: 'discussion',
	};

	test('maps a complete sample item from the API', () => {
		const log = mapPullRequestOperationLog(sampleItem);

		assert.strictEqual(log.id, '177934270');
		assert.strictEqual(log.content, 'resolved all discussions');
		assert.strictEqual(log.action, 'discussion');
		assert.strictEqual(log.actionType, 'discussion');
		assert.strictEqual(log.pullRequestId, '8797630');
		assert.strictEqual(log.discussionId, '16d6c1ab551818dd9e758137be483d79161a7f41');
		assert.strictEqual(log.project, 'tangxuanya/msmodelslim');
		assert.strictEqual(log.createdAt, '2026-07-01T00:10:02+08:00');
		assert.strictEqual(log.updatedAt, '2026-07-01T00:10:02+08:00');
		assert.strictEqual(log.actor.login, 'tangxuanya');
		assert.strictEqual(log.actor.name, 'tangxuanya');
		assert.strictEqual(log.actor.nickName, 'tangxuanya');
		assert.strictEqual(log.actor.htmlUrl, 'https://gitcode.com/tangxuanya');
		assert.strictEqual(log.actor.id, '695337496415d64a21d4d6c7');
		assert.strictEqual(log.actor.state, 'active');
	});

	test('tolerates missing user', () => {
		const dto = { ...sampleItem, user: undefined };
		const log = mapPullRequestOperationLog(dto);

		assert.strictEqual(log.actor.login, 'unknown');
		assert.strictEqual(log.actor.name, undefined);
	});

	test('tolerates missing action_type, falls back to action', () => {
		const dto = { ...sampleItem, action_type: undefined, action: 'opened' };
		const log = mapPullRequestOperationLog(dto);

		assert.strictEqual(log.actionType, 'opened');
	});

	test('falls back to activity when action and action_type are missing', () => {
		const dto = { ...sampleItem, action_type: undefined, action: undefined };
		const log = mapPullRequestOperationLog(dto);

		assert.strictEqual(log.actionType, 'activity');
	});

	test('maps string and numeric IDs to strings', () => {
		const dto = { ...sampleItem, id: 'abc-123', merge_request_id: 42 };
		const log = mapPullRequestOperationLog(dto);

		assert.strictEqual(log.id, 'abc-123');
		assert.strictEqual(log.pullRequestId, '42');
	});

	test('maps content to empty string when omitted', () => {
		const dto = { ...sampleItem, content: undefined };
		const log = mapPullRequestOperationLog(dto);

		assert.strictEqual(log.content, '');
	});

	test('sorts by createdAt ascending', () => {
		const dtos = [
			{ ...sampleItem, id: 3, created_at: '2026-07-01T00:10:02+08:00' },
			{ ...sampleItem, id: 1, created_at: '2026-06-30T10:30:10+08:00' },
			{ ...sampleItem, id: 2, created_at: '2026-06-30T23:36:55+08:00' },
		];

		const logs = mapPullRequestOperationLogs(dtos);

		assert.strictEqual(logs[0].id, '1');
		assert.strictEqual(logs[1].id, '2');
		assert.strictEqual(logs[2].id, '3');
	});

	test('falls back to numeric ID sort when dates are equal', () => {
		const dtos = [
			{ ...sampleItem, id: 3, created_at: '2026-07-01T00:10:02+08:00' },
			{ ...sampleItem, id: 1, created_at: '2026-07-01T00:10:02+08:00' },
			{ ...sampleItem, id: 2, created_at: '2026-07-01T00:10:02+08:00' },
		];

		const logs = mapPullRequestOperationLogs(dtos);

		assert.strictEqual(logs[0].id, '1');
		assert.strictEqual(logs[1].id, '2');
		assert.strictEqual(logs[2].id, '3');
	});

	test('handles invalid dates by falling back to ID sort', () => {
		const dtos = [
			{ ...sampleItem, id: 3, created_at: 'not a date' },
			{ ...sampleItem, id: 1, created_at: 'also not a date' },
			{ ...sampleItem, id: 2, created_at: 'invalid' },
		];

		const logs = mapPullRequestOperationLogs(dtos);

		assert.strictEqual(logs[0].id, '1');
		assert.strictEqual(logs[1].id, '2');
		assert.strictEqual(logs[2].id, '3');
	});

	test('preserves discussion_id when present', () => {
		const dto = { ...sampleItem, discussion_id: 'abc123' };
		const log = mapPullRequestOperationLog(dto);

		assert.strictEqual(log.discussionId, 'abc123');
	});

	test('preserves discussion_id undefined when not present', () => {
		const dto = { ...sampleItem, discussion_id: undefined };
		const log = mapPullRequestOperationLog(dto);

		assert.strictEqual(log.discussionId, undefined);
	});

	test('normalizes missing dates to empty strings', () => {
		const dto = { ...sampleItem, created_at: undefined, updated_at: null };
		const log = mapPullRequestOperationLog(dto);

		assert.strictEqual(log.createdAt, '');
		assert.strictEqual(log.updatedAt, '');
	});
});
