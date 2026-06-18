import { NotSignedInError } from '../../common/errors';
import { Logger } from '../../common/logger';
import { ExtensionConfiguration } from '../../common/configuration';
import { SessionStore } from '../../authentication/sessionStore';
import { requestJson } from './request';

type QueryValue = string | number | boolean | undefined;

export interface GitCodeClient {
	get<T>(path: string, query?: Record<string, QueryValue>, tokenOverride?: string): Promise<T>;
}

export class GitCodeClientImpl implements GitCodeClient {
	constructor(
		private readonly configuration: ExtensionConfiguration,
		private readonly sessionStore: SessionStore,
		private readonly logger: Logger,
	) {}

	async get<T>(path: string, query?: Record<string, QueryValue>, tokenOverride?: string): Promise<T> {
		return this.request<T>(path, query, tokenOverride);
	}

	private async request<T>(
		path: string,
		query?: Record<string, QueryValue>,
		tokenOverride?: string,
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
			this.logger.debug(`GET ${requestUrl.toString()}`);
		}

		return requestJson<T>({
			method: 'GET',
			url: requestUrl.toString(),
			token,
		});
	}
}
