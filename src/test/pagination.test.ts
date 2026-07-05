import * as assert from 'assert';
import { GitCodeRepository } from '../common/models';
import { RepositoryService } from '../gitcode/services/repositoryService';
import { listPagedRecords, pageQuery } from '../gitcode/services/pagination';

suite('pagination helpers', () => {
	test('pageQuery defaults to page 1 and 100 records per page', () => {
		assert.deepStrictEqual(pageQuery(), { per_page: 100, page: 1 });
		assert.deepStrictEqual(pageQuery({ perPage: 40, page: 2 }), { per_page: 40, page: 2 });
	});

	test('listPagedRecords fetches subsequent pages until a short page', async () => {
		const queries: Array<Record<string, unknown> | undefined> = [];
		const client = {
			get: async <T>(_path: string, query?: Record<string, unknown>): Promise<T> => {
				queries.push(query);
				const page = query?.page;
				const count = page === 1 ? 100 : page === 2 ? 1 : 0;
				return Array.from({ length: count }, (_, index) => ({ id: `${page}-${index}` })) as T;
			},
		};

		const records = await listPagedRecords<{ id: string }>(client, '/items', { state: 'open' });

		assert.strictEqual(records.length, 101);
		assert.deepStrictEqual(queries, [
			{ state: 'open', per_page: 100, page: 1 },
			{ state: 'open', per_page: 100, page: 2 },
		]);
	});

	test('listPagedRecords stops after 50 pages by default', async () => {
		const queries: Array<Record<string, unknown> | undefined> = [];
		const client = {
			get: async <T>(_path: string, query?: Record<string, unknown>): Promise<T> => {
				queries.push(query);
				return [{ id: String(query?.page) }] as T;
			},
		};

		const records = await listPagedRecords<{ id: string }>(client, '/items');

		assert.strictEqual(records.length, 50);
		assert.strictEqual(queries.length, 50);
		assert.deepStrictEqual(queries[0], { per_page: 100, page: 1 });
		assert.deepStrictEqual(queries[49], { per_page: 100, page: 50 });
	});

	test('listPagedRecords keeps pull request files that share the same sha', async () => {
		const client = {
			get: async <T>(_path: string, query?: Record<string, unknown>): Promise<T> => {
				if (query?.page === 1) {
					return [
						{ sha: 'same-head', filename: 'config/config.ini' },
						{ sha: 'same-head', filename: 'src/loader.py' },
					] as T;
				}

				return [] as T;
			},
		};

		const records = await listPagedRecords<{ sha: string; filename: string }>(client, '/files');

		assert.deepStrictEqual(records.map((record) => record.filename), [
			'config/config.ini',
			'src/loader.py',
		]);
	});

	test('RepositoryService.listMembers loads collaborator pages beyond the default pagination cap', async () => {
		const repository: GitCodeRepository = {
			remoteName: 'origin',
			owner: 'org',
			name: 'repo',
			fullName: 'org/repo',
			webUrl: 'https://gitcode.com/org/repo',
		};
		const queries: Array<Record<string, unknown> | undefined> = [];
		const service = new RepositoryService({
			get: async <T>(_path: string, query?: Record<string, unknown>): Promise<T> => {
				queries.push(query);
				if ((query?.page as number) <= 51) {
					return [{
						login: `member-${query?.page}`,
						role_name: 'Developer',
						access_level: 30,
					}] as T;
				}
				return [] as T;
			},
			post: async () => undefined as never,
			put: async () => undefined as never,
			patch: async () => undefined as never,
			delete: async () => undefined as never,
		} as any);

		const members = await service.listMembers(repository, { perPage: 1 });

		assert.strictEqual(members.length, 51);
		assert.strictEqual(members[0].login, 'member-1');
		assert.strictEqual(members[50].login, 'member-51');
		assert.strictEqual(queries.length, 52);
		assert.deepStrictEqual(queries[0], { per_page: 1, page: 1 });
		assert.deepStrictEqual(queries[50], { per_page: 1, page: 51 });
		assert.deepStrictEqual(queries[51], { per_page: 1, page: 52 });
	});
});
