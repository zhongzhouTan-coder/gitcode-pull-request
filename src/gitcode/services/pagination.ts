type QueryValue = string | number | boolean | undefined;

interface PagedClient {
	get<T>(path: string, query?: Record<string, QueryValue>): Promise<T>;
}

export interface PageOptions {
	perPage?: number;
	page?: number;
}

export const DEFAULT_LIST_PAGE_SIZE = 100;
const DEFAULT_PAGE = 1;
const MAX_LIST_PAGES = 50;

export function pageQuery(options?: PageOptions): { per_page: number; page: number } {
	return {
		per_page: options?.perPage ?? DEFAULT_LIST_PAGE_SIZE,
		page: options?.page ?? DEFAULT_PAGE,
	};
}

export async function listPagedRecords<T>(
	client: PagedClient,
	path: string,
	query: Record<string, QueryValue> = {},
	options: PageOptions = {},
): Promise<T[]> {
	const perPage = options.perPage ?? DEFAULT_LIST_PAGE_SIZE;
	const startPage = options.page ?? DEFAULT_PAGE;
	const records: T[] = [];
	const seenRecordKeys = new Set<string>();
	let effectivePageSize = perPage;

	for (let page = startPage; page < startPage + MAX_LIST_PAGES; page++) {
		const response = await client.get<unknown[]>(path, {
			...query,
			per_page: perPage,
			page,
		});

		if (!Array.isArray(response) || response.length === 0) {
			break;
		}

		if (page === startPage && response.length < perPage) {
			effectivePageSize = response.length;
		}

		let newRecordCount = 0;
		for (const record of response) {
			const key = getRecordKey(record);
			if (seenRecordKeys.has(key)) {
				continue;
			}

			seenRecordKeys.add(key);
			records.push(record as T);
			newRecordCount++;
		}

		if (newRecordCount === 0 || response.length < effectivePageSize) {
			break;
		}
	}

	return records;
}

function getRecordKey(record: unknown): string {
	if (record && typeof record === 'object') {
		const fields = record as Record<string, unknown>;
		for (const field of ['id', 'number', 'path', 'filename', 'note_id', 'discussion_id', 'login', 'name', 'sha']) {
			const value = fields[field];
			if (typeof value === 'string' || typeof value === 'number') {
				return `${field}:${value}`;
			}
		}

		const patch = fields.patch;
		if (patch && typeof patch === 'object') {
			const patchFields = patch as Record<string, unknown>;
			for (const field of ['new_path', 'old_path']) {
				const value = patchFields[field];
				if (typeof value === 'string' || typeof value === 'number') {
					return `patch.${field}:${value}`;
				}
			}
		}
	}

	return JSON.stringify(record);
}
