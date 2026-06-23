import * as https from 'https';
import { URL } from 'url';
import { ApiRequestError } from '../../common/errors';

interface RequestOptions {
	method: 'GET' | 'POST' | 'PUT';
	url: string;
	token?: string;
	body?: unknown;
	accept?: string;
}

export async function requestJson<T>(options: RequestOptions): Promise<T> {
	const rawBody = await requestText({
		...options,
		accept: 'application/json',
	});

	if (!rawBody) {
		return undefined as T;
	}

	return JSON.parse(rawBody) as T;
}

export async function requestBytes(options: RequestOptions): Promise<Uint8Array> {
	const requestUrl = new URL(options.url);
	const payload = options.body ? JSON.stringify(options.body) : undefined;

	return new Promise<Uint8Array>((resolve, reject) => {
		const request = https.request(
			requestUrl,
			{
				method: options.method,
				headers: {
					Accept: options.accept ?? '*/*',
					...(payload ? { 'Content-Type': 'application/json' } : {}),
					...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
				},
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on('data', (chunk) => {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				});
				response.on('end', () => {
					const statusCode = response.statusCode ?? 500;

					if (statusCode < 200 || statusCode >= 300) {
						const body = Buffer.concat(chunks).toString('utf8');
						reject(new ApiRequestError(`GitCode API request failed with status ${statusCode}.`, statusCode, body));
						return;
					}

					resolve(new Uint8Array(Buffer.concat(chunks)));
				});
			},
		);

		request.on('error', reject);

		if (payload) {
			request.write(payload);
		}

		request.end();
	});
}

export async function requestText(options: RequestOptions): Promise<string> {
	const requestUrl = new URL(options.url);
	const payload = options.body ? JSON.stringify(options.body) : undefined;

	return new Promise<string>((resolve, reject) => {
		const request = https.request(
			requestUrl,
			{
				method: options.method,
				headers: {
					Accept: options.accept ?? '*/*',
					...(payload ? { 'Content-Type': 'application/json' } : {}),
					...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
				},
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on('data', (chunk) => {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				});
				response.on('end', () => {
					const rawBody = Buffer.concat(chunks).toString('utf8');
					const statusCode = response.statusCode ?? 500;

					if (statusCode < 200 || statusCode >= 300) {
						reject(new ApiRequestError(`GitCode API request failed with status ${statusCode}.`, statusCode, rawBody));
						return;
					}

					resolve(rawBody);
				});
			},
		);

		request.on('error', reject);

		if (payload) {
			request.write(payload);
		}

		request.end();
	});
}
