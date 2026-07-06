import * as assert from 'assert';
import {
	GitCodeRepository,
	GitCodeRoleInfo,
	PermissionRequirement,
} from '../common/models';
import {
	buildIssueOverviewPermissions,
	buildPullRequestOverviewPermissions,
	hasEffectivePermission,
} from '../view/permissions/permissionHelpers';
import { buildPullRequestParticipantCandidates } from '../view/permissions/participantRoleEligibility';
import {
	getRolePermissionProfile,
	normalizeRoleKey,
	roleCanByDefault,
} from '../view/permissions/rolePermissionProfiles';
import { mapPermissionSnapshot } from '../gitcode/mappers/permissionMapper';

function createRepo(): GitCodeRepository {
	return {
		remoteName: 'origin',
		owner: 'test-owner',
		name: 'test-repo',
		fullName: 'test-owner/test-repo',
		webUrl: 'https://gitcode.com/test-owner/test-repo',
	};
}

function createRequirement(scope: string, action: string): PermissionRequirement {
	return {
		scope,
		action,
		message: () => 'permission denied',
	};
}

suite('rolePermissionProfiles', () => {
	test('maps known role names case-insensitively', () => {
		assert.strictEqual(normalizeRoleKey({ name: 'Owner' }), 'owner');
		assert.strictEqual(normalizeRoleKey({ name: 'Maintainer' }), 'maintainer');
		assert.strictEqual(normalizeRoleKey({ name: 'DEVELOPER' }), 'developer');
		assert.strictEqual(normalizeRoleKey({ name: 'reporter' }), 'reporter');
		assert.strictEqual(normalizeRoleKey({ name: 'Guest' }), 'guest');
	});

	test('maps known access levels when role name is missing', () => {
		assert.strictEqual(normalizeRoleKey({ accessLevel: 50 }), 'owner');
		assert.strictEqual(normalizeRoleKey({ accessLevel: 40 }), 'maintainer');
		assert.strictEqual(normalizeRoleKey({ accessLevel: 30 }), 'developer');
		assert.strictEqual(normalizeRoleKey({ accessLevel: 20 }), 'reporter');
		assert.strictEqual(normalizeRoleKey({ accessLevel: 10 }), 'guest');
	});

	test('returns unknown for unrecognized names and preserves raw role info', () => {
		const role: GitCodeRoleInfo = {
			name: 'Custom Role',
			displayName: '自定义角色',
			accessLevel: 999,
		};

		assert.strictEqual(normalizeRoleKey(role), 'unknown');

		const profile = getRolePermissionProfile(role);
		assert.strictEqual(profile.key, 'unknown');
		assert.strictEqual(profile.name, 'Custom Role');
		assert.strictEqual(profile.displayName, '自定义角色');
		assert.strictEqual(profile.accessLevel, 999);
	});

	test('role default capability lookup follows the documented matrix', () => {
		assert.strictEqual(
			roleCanByDefault({ name: 'Maintainer' }, createRequirement('pr', 'merge')),
			true,
		);
		assert.strictEqual(
			roleCanByDefault({ name: 'Reporter' }, createRequirement('pr', 'merge')),
			false,
		);
		assert.strictEqual(
			roleCanByDefault({ name: 'Guest' }, createRequirement('note', 'create')),
			true,
		);
		assert.strictEqual(
			roleCanByDefault({ name: 'Owner' }, createRequirement('repo', 'delete')),
			false,
		);
		assert.strictEqual(
			roleCanByDefault({ name: 'Developer' }, createRequirement('branch', 'create')),
			false,
		);
	});

	test('role defaults do not mutate raw snapshot permission checks', () => {
		const repo = createRepo();
		const snapshot = mapPermissionSnapshot(repo, {
			role_info: {
				name: 'Maintainer',
				access_level: 40,
			},
			resource_trees: [
				{
					scope: 'pr',
					actions: [{ action: 'merge', selected: false }],
				},
			],
		});

		assert.strictEqual(roleCanByDefault(snapshot.role, createRequirement('pr', 'merge')), true);
		assert.strictEqual(snapshot.has('pr', 'merge'), false);
	});

	test('effective permission allows action permission or role default or object ownership', () => {
		const repo = createRepo();
		const snapshot = mapPermissionSnapshot(repo, {
			role_info: {
				name: 'Reporter',
				access_level: 20,
			},
			resource_trees: [
				{
					scope: 'issue',
					actions: [{ action: 'create', selected: true }],
				},
				{
					scope: 'pr',
					actions: [{ action: 'update', selected: false }],
				},
			],
		});

		assert.strictEqual(hasEffectivePermission(snapshot, createRequirement('issue', 'create')), true);
		assert.strictEqual(hasEffectivePermission(snapshot, createRequirement('note', 'resolve')), true);
		assert.strictEqual(hasEffectivePermission(snapshot, createRequirement('pr', 'update')), false);
		assert.strictEqual(hasEffectivePermission(snapshot, createRequirement('pr', 'update'), true), true);
	});

	test('participant candidates are derived from collaborator role permissions', () => {
		const candidates = buildPullRequestParticipantCandidates([
			{ login: 'owner', role: { name: 'Owner', accessLevel: 50 } },
			{ login: 'maintainer', role: { name: 'Maintainer', accessLevel: 40 } },
			{ login: 'developer', role: { name: 'Developer', accessLevel: 30 } },
			{ login: 'reporter', role: { name: 'Reporter', accessLevel: 20 } },
			{ login: 'guest', role: { name: 'Guest', accessLevel: 10 } },
		]);

		assert.deepStrictEqual(candidates.reviewers.map((user) => user.login), ['owner', 'maintainer', 'developer']);
		assert.deepStrictEqual(candidates.testers.map((user) => user.login), ['owner', 'maintainer', 'developer', 'reporter']);
		assert.deepStrictEqual(candidates.assignees.map((user) => user.login), ['owner', 'maintainer']);
	});

	test('overview permission builders keep owner rules scoped to author-edit and state actions', () => {
		const repo = createRepo();
		const snapshot = mapPermissionSnapshot(repo, {
			role_info: {
				name: 'Guest',
				access_level: 10,
			},
			resource_trees: [
				{
					scope: 'issue',
					actions: [{ action: 'update', selected: false }, { action: 'reopen', selected: false }],
				},
				{
					scope: 'pr',
					actions: [{ action: 'update', selected: false }, { action: 'close', selected: false }, { action: 'reopen', selected: false }],
				},
			],
		});

		const issuePermissions = buildIssueOverviewPermissions(snapshot, {
			authorLogin: 'alice',
			currentUserLogin: 'ALICE',
		});
		assert.strictEqual(issuePermissions.canEditIssue, false);
		assert.strictEqual(issuePermissions.canEditIssueAuthorSections, true);
		assert.strictEqual(issuePermissions.canCloseIssue, true);
		assert.strictEqual(issuePermissions.canReopenIssue, true);

		const pullRequestPermissions = buildPullRequestOverviewPermissions(snapshot, {
			authorLogin: 'alice',
			currentUserLogin: 'ALICE',
		});
		assert.strictEqual(pullRequestPermissions.canEditPullRequest, false);
		assert.strictEqual(pullRequestPermissions.canEditPullRequestAuthorSections, true);
		assert.strictEqual(pullRequestPermissions.canClosePullRequest, true);
		assert.strictEqual(pullRequestPermissions.canReopenPullRequest, true);
		assert.strictEqual(pullRequestPermissions.canUpdateRelatedIssues, false);
	});
});
