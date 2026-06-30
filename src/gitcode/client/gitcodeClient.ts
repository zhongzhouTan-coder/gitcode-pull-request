import { NotSignedInError } from '../../common/errors';
import { Logger } from '../../common/logger';
import { ExtensionConfiguration } from '../../common/configuration';
import { SessionStore } from '../../authentication/sessionStore';
import { requestJson } from './request';

type QueryValue = string | number | boolean | undefined;

export interface GitCodeClient {
	get<T>(path: string, query?: Record<string, QueryValue>, tokenOverride?: string): Promise<T>;
}

export interface GitCodeWriteClient extends GitCodeClient {
	post<T>(path: string, body?: unknown, query?: Record<string, QueryValue>, tokenOverride?: string): Promise<T>;
	put<T>(path: string, body?: unknown, query?: Record<string, QueryValue>, tokenOverride?: string): Promise<T>;
	patch<T>(path: string, body?: unknown, query?: Record<string, QueryValue>, tokenOverride?: string): Promise<T>;
}

export class GitCodeClientImpl implements GitCodeWriteClient {
	constructor(
		private readonly configuration: ExtensionConfiguration,
		private readonly sessionStore: SessionStore,
		private readonly logger: Logger,
	) {}

	async get<T>(path: string, query?: Record<string, QueryValue>, tokenOverride?: string): Promise<T> {
		return this.request<T>(path, query, tokenOverride);
	}

	async post<T>(path: string, body?: unknown, query?: Record<string, QueryValue>, tokenOverride?: string): Promise<T> {
		return this.request<T>(path, query, tokenOverride, body);
	}

	async put<T>(path: string, body?: unknown, query?: Record<string, QueryValue>, tokenOverride?: string): Promise<T> {
		return this.request<T>(path, query, tokenOverride, body, 'PUT');
	}

	async patch<T>(path: string, body?: unknown, query?: Record<string, QueryValue>, tokenOverride?: string): Promise<T> {
		return this.request<T>(path, query, tokenOverride, body, 'PATCH');
	}

	private async request<T>(
		path: string,
		query?: Record<string, QueryValue>,
		tokenOverride?: string,
		body?: unknown,
		method?: 'GET' | 'POST' | 'PUT' | 'PATCH',
	): Promise<T> {
		const token = tokenOverride ?? (await this.sessionStore.read())?.accessToken;
		if (!token) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const requestUrl = new URL(path, this.configuration.getBaseUrl());
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				if (value !== undefined) {
					requestUrl.searchParams.set(key, String(value));
				}
			}
		}

		if (this.configuration.getTraceServerEnabled()) {
			this.logger.debug(`${method ?? (body ? 'POST' : 'GET')} ${requestUrl.toString()}`);
		}

		return requestJson<T>({
			method: method ?? (body ? 'POST' : 'GET'),
			url: requestUrl.toString(),
			token,
			body,
		});
	}
}
