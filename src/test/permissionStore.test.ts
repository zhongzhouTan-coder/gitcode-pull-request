import * as assert from 'assert';
import { GitCodePermissionSnapshot, GitCodeRepository } from '../common/models';
import { Logger } from '../common/logger';
import { PermissionService } from '../gitcode/services/permissionService';
import { PermissionStore } from '../view/state/permissionStore';
import { GitCodeClient } from '../gitcode/client/gitcodeClient';

function createRepo(fullName: string = 'test-owner/test-repo'): GitCodeRepository {
	return {
		remoteName: 'origin',
		owner: fullName.split('/')[0],
		name: fullName.split('/')[1],
		fullName,
		webUrl: `https://gitcode.com/${fullName}`,
	};
}

function createSnapshot(repo: GitCodeRepository, loadedAt: number = Date.now()): GitCodePermissionSnapshot {
	const permissions = [
		{ scope: 'issue', action: 'create', selected: true },
		{ scope: 'pr', action: 'create', selected: true },
		{ scope: 'note', action: 'create', selected: true },
	];

	const lookup = new Map<string, boolean>();
	for (const p of permissions) {
		lookup.set(`${p.scope}:${p.action}`, p.selected);
	}

	return {
		repository: repo,
		permissions,
		loadedAt,
		has(scope: string, action: string): boolean {
			return lookup.get(`${scope}:${action}`) === true;
		},
	};
}

function createFakeClient(): GitCodeClient {
	return {
		async get<T>(): Promise<T> {
			throw new Error('Not implemented in fake');
		},
	};
}

function createFakeLogger(): Logger {
	return {
		debug: () => {},
		info: () => {},
		warn: () => {},
		error: () => {},
	} as unknown as Logger;
}

suite('PermissionStore', () => {
	test('caches snapshots by repository full name', async () => {
		const repo = createRepo();
		const snapshot = createSnapshot(repo);
		let callCount = 0;

		const service: PermissionService = {
			async getRepositoryPermissions(r: GitCodeRepository) {
				callCount++;
				assert.strictEqual(r.fullName, repo.fullName);
				return snapshot;
			},
		} as unknown as PermissionService;

		const store = new PermissionStore(service, createFakeLogger());

		// First call should fetch
		const result1 = await store.get(repo);
		assert.strictEqual(result1, snapshot);
		assert.strictEqual(callCount, 1);

		// Second call should use cache
		const result2 = await store.get(repo);
		assert.strictEqual(result2, snapshot);
		assert.strictEqual(callCount, 1);
	});

	test('peek returns cached snapshot without fetching', async () => {
		const repo = createRepo();
		const snapshot = createSnapshot(repo);
		let callCount = 0;

		const service: PermissionService = {
			async getRepositoryPermissions() {
				callCount++;
				return snapshot;
			},
		} as unknown as PermissionService;

		const store = new PermissionStore(service, createFakeLogger());

		// peek without cache returns undefined
		assert.strictEqual(store.peek(repo), undefined);
		assert.strictEqual(callCount, 0);

		// After get, peek should return cached
		await store.get(repo);
		assert.ok(store.peek(repo));
		assert.strictEqual(callCount, 1);
	});

	test('refresh replaces stale data', async () => {
		const repo = createRepo();
		const snapshot1 = createSnapshot(repo, 1000);
		const snapshot2 = createSnapshot(repo, 2000);
		let callCount = 0;

		const service: PermissionService = {
			async getRepositoryPermissions() {
				callCount++;
				return callCount === 1 ? snapshot1 : snapshot2;
			},
		} as unknown as PermissionService;

		const store = new PermissionStore(service, createFakeLogger());

		const result1 = await store.get(repo);
		assert.strictEqual(result1.loadedAt, 1000);
		assert.strictEqual(callCount, 1);

		const result2 = await store.refresh(repo);
		assert.strictEqual(result2.loadedAt, 2000);
		assert.strictEqual(callCount, 2);

		// get should return refreshed snapshot
		const result3 = await store.get(repo);
		assert.strictEqual(result3.loadedAt, 2000);
		assert.strictEqual(callCount, 2);
	});

	test('concurrent get calls share one in-flight request', async () => {
		const repo = createRepo();
		const snapshot = createSnapshot(repo);
		let callCount = 0;

		const service: PermissionService = {
			async getRepositoryPermissions() {
				callCount++;
				// Simulate a slow API call
				await new Promise((resolve) => setTimeout(resolve, 10));
				return snapshot;
			},
		} as unknown as PermissionService;

		const store = new PermissionStore(service, createFakeLogger());

		// Fire two concurrent calls
		const [result1, result2] = await Promise.all([
			store.get(repo),
			store.get(repo),
		]);

		assert.strictEqual(result1, snapshot);
		assert.strictEqual(result2, snapshot);
		// Should only have made one API call
		assert.strictEqual(callCount, 1);
	});

	test('clear removes cached snapshots', async () => {
		const repo = createRepo();
		const snapshot = createSnapshot(repo);
		let callCount = 0;

		const service: PermissionService = {
			async getRepositoryPermissions() {
				callCount++;
				return snapshot;
			},
		} as unknown as PermissionService;

		const store = new PermissionStore(service, createFakeLogger());

		await store.get(repo);
		assert.strictEqual(callCount, 1);
		assert.ok(store.peek(repo));

		store.clear();
		assert.strictEqual(store.peek(repo), undefined);

		// After clear, get should fetch again
		await store.get(repo);
		assert.strictEqual(callCount, 2);
	});

	test('clear prevents stale in-flight results from repopulating cache', async () => {
		const repo = createRepo();
		const staleSnapshot = createSnapshot(repo, 1000);
		const freshSnapshot = createSnapshot(repo, 2000);
		let resolveFirst: ((snapshot: GitCodePermissionSnapshot) => void) | undefined;
		let callCount = 0;

		const service: PermissionService = {
			async getRepositoryPermissions() {
				callCount++;
				if (callCount === 1) {
					return new Promise<GitCodePermissionSnapshot>((resolve) => {
						resolveFirst = resolve;
					});
				}
				return freshSnapshot;
			},
		} as unknown as PermissionService;

		const store = new PermissionStore(service, createFakeLogger());
		const inFlight = store.get(repo);

		store.clear();
		resolveFirst?.(staleSnapshot);

		const result = await inFlight;
		assert.strictEqual(result, staleSnapshot);
		assert.strictEqual(store.peek(repo), undefined);

		const fresh = await store.get(repo);
		assert.strictEqual(fresh, freshSnapshot);
		assert.strictEqual(store.peek(repo), freshSnapshot);
		assert.strictEqual(callCount, 2);
	});

	test('refreshAll refreshes multiple repositories', async () => {
		const repo1 = createRepo('owner1/repo1');
		const repo2 = createRepo('owner2/repo2');
		const snapshot1 = createSnapshot(repo1, 1000);
		const snapshot2 = createSnapshot(repo2, 2000);
		const fetchedRepos: string[] = [];

		const service: PermissionService = {
			async getRepositoryPermissions(r: GitCodeRepository) {
				fetchedRepos.push(r.fullName);
				return r.fullName === repo1.fullName ? snapshot1 : snapshot2;
			},
		} as unknown as PermissionService;

		const store = new PermissionStore(service, createFakeLogger());
		await store.refreshAll([repo1, repo2]);

		assert.strictEqual(fetchedRepos.length, 2);
		assert.ok(fetchedRepos.includes('owner1/repo1'));
		assert.ok(fetchedRepos.includes('owner2/repo2'));
		assert.strictEqual(store.peek(repo1)?.loadedAt, 1000);
		assert.strictEqual(store.peek(repo2)?.loadedAt, 2000);
	});

	test('API failures do not poison the cache permanently', async () => {
		const repo = createRepo();
		const snapshot = createSnapshot(repo);
		let shouldFail = true;

		const service: PermissionService = {
			async getRepositoryPermissions() {
				if (shouldFail) {
					throw new Error('API error');
				}
				return snapshot;
			},
		} as unknown as PermissionService;

		const store = new PermissionStore(service, createFakeLogger());

		// First call fails
		await assert.rejects(() => store.get(repo));
		assert.strictEqual(store.peek(repo), undefined);

		// Second call succeeds
		shouldFail = false;
		const result = await store.get(repo);
		assert.strictEqual(result, snapshot);
		assert.ok(store.peek(repo));
	});
});
