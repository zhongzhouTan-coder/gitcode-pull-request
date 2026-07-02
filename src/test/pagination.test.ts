import * as assert from 'assert';
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
});
