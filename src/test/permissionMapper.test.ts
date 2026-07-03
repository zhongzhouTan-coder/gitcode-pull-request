import * as assert from 'assert';
import { GitCodeRepository } from '../common/models';
import { mapPermissionSnapshot, buildPermissionKey } from '../gitcode/mappers/permissionMapper';

function createRepo(): GitCodeRepository {
	return {
		remoteName: 'origin',
		owner: 'test-owner',
		name: 'test-repo',
		fullName: 'test-owner/test-repo',
		webUrl: 'https://gitcode.com/test-owner/test-repo',
	};
}

suite('permissionMapper', () => {
	test('maps role_info fields', () => {
		const repo = createRepo();
		const response = {
			role_info: {
				role_uuid: 'test-uuid',
				name: 'Developer',
				cn_name: '开发者',
				roles_type: 2,
				access_level: 30,
			},
		};

		const snapshot = mapPermissionSnapshot(repo, response);
		assert.strictEqual(snapshot.role?.roleUuid, 'test-uuid');
		assert.strictEqual(snapshot.role?.name, 'Developer');
		assert.strictEqual(snapshot.role?.displayName, '开发者');
		assert.strictEqual(snapshot.role?.rolesType, 2);
		assert.strictEqual(snapshot.role?.accessLevel, 30);
	});

	test('maps selected and unselected actions', () => {
		const repo = createRepo();
		const response = {
			resource_trees: [
				{
					resource_id: 6,
					name: 'issue',
					cn_name: 'Issue',
					scope: 'issue',
					actions: [
						{
							permission_id: 19,
							action: 'create',
							name: 'create',
							cn_name: '创建',
							selected: true,
						},
						{
							permission_id: 20,
							action: 'update',
							name: 'update',
							cn_name: '更新',
							selected: false,
						},
					],
				},
			],
		};

		const snapshot = mapPermissionSnapshot(repo, response);
		assert.strictEqual(snapshot.permissions.length, 2);
		assert.strictEqual(snapshot.has('issue', 'create'), true);
		assert.strictEqual(snapshot.has('issue', 'update'), false);
	});

	test('has(scope, action) is true only for selected actions', () => {
		const repo = createRepo();
		const response = {
			resource_trees: [
				{
					scope: 'pr',
					actions: [
						{ action: 'create', selected: true },
						{ action: 'merge', selected: false },
					],
				},
				{
					scope: 'note',
					actions: [
						{ action: 'create', selected: true },
						{ action: 'resolve', selected: true },
					],
				},
			],
		};

		const snapshot = mapPermissionSnapshot(repo, response);
		assert.strictEqual(snapshot.has('pr', 'create'), true);
		assert.strictEqual(snapshot.has('pr', 'merge'), false);
		assert.strictEqual(snapshot.has('note', 'create'), true);
		assert.strictEqual(snapshot.has('note', 'resolve'), true);
		assert.strictEqual(snapshot.has('branch', 'create'), false);
		assert.strictEqual(snapshot.has('issue', 'create'), false);
	});

	test('unknown scopes and actions are preserved', () => {
		const repo = createRepo();
		const response = {
			resource_trees: [
				{
					scope: 'custom-scope',
					actions: [
						{ action: 'custom-action', selected: true },
					],
				},
			],
		};

		const snapshot = mapPermissionSnapshot(repo, response);
		assert.strictEqual(snapshot.permissions.length, 1);
		assert.strictEqual(snapshot.permissions[0].scope, 'custom-scope');
		assert.strictEqual(snapshot.permissions[0].action, 'custom-action');
		assert.strictEqual(snapshot.has('custom-scope', 'custom-action'), true);
	});

	test('missing or malformed resource_trees returns an empty snapshot', () => {
		const repo = createRepo();
		const snapshot = mapPermissionSnapshot(repo, {});

		assert.strictEqual(snapshot.permissions.length, 0);
		assert.strictEqual(snapshot.has('issue', 'create'), false);
		assert.strictEqual(snapshot.role, undefined);
	});

	test('resource_trees with no scope uses name as scope', () => {
		const repo = createRepo();
		const response = {
			resource_trees: [
				{
					name: 'issue',
					actions: [
						{ action: 'create', selected: true },
					],
				},
			],
		};

		const snapshot = mapPermissionSnapshot(repo, response);
		assert.strictEqual(snapshot.has('issue', 'create'), true);
	});

	test('resource_trees with no actions array is skipped', () => {
		const repo = createRepo();
		const response = {
			resource_trees: [
				{
					scope: 'pr',
				},
				{
					scope: 'note',
					actions: [
						{ action: 'create', selected: true },
					],
				},
			],
		};

		const snapshot = mapPermissionSnapshot(repo, response);
		assert.strictEqual(snapshot.permissions.length, 1);
		assert.strictEqual(snapshot.has('note', 'create'), true);
	});

	test('buildPermissionKey creates consistent keys', () => {
		assert.strictEqual(buildPermissionKey('issue', 'create'), 'issue:create');
		assert.strictEqual(buildPermissionKey('pr', 'update'), 'pr:update');
		assert.strictEqual(buildPermissionKey('note', 'resolve'), 'note:resolve');
	});
});
