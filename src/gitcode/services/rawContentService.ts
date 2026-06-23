import { NotSignedInError } from '../../common/errors';
import { Logger } from '../../common/logger';
import { ExtensionConfiguration } from '../../common/configuration';
import { SessionStore } from '../../authentication/sessionStore';
import { requestBytes } from '../client/request';

export class RawContentService {
	constructor(
		private readonly configuration: ExtensionConfiguration,
		private readonly sessionStore: SessionStore,
		private readonly logger: Logger,
	) {}

	/**
	 * Fetch the complete file content at a specific commit SHA and repository-relative path.
	 * Returns bytes directly — the caller decides how to interpret them.
	 */
	async getFileContent(owner: string, repo: string, sha: string, path: string): Promise<Uint8Array> {
		const token = (await this.sessionStore.read())?.accessToken;
		if (!token) {
			throw new NotSignedInError('Sign in to GitCode first.');
		}

		const rawUrl = this.buildRawUrl(owner, repo, sha, path);

		if (this.configuration.getTraceServerEnabled()) {
			this.logger.debug(`GET raw: ${owner}/${repo}@${sha.substring(0, 7)}:${path}`);
		}

		return requestBytes({
			method: 'GET',
			url: rawUrl,
			token,
		});
	}

	private buildRawUrl(owner: string, repo: string, sha: string, path: string): string {
		// Percent-encode each path segment individually, keeping '/' separators
		const encodedPath = path
			.split('/')
			.map(segment => encodeURIComponent(segment))
			.join('/');

		// Use the configured base URL to derive the raw origin, but prefer a raw-specific
		// configuration if available. For now, construct from the raw host convention.
		const rawOrigin = this.configuration.getRawUrl();
		return `${rawOrigin}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/${encodeURIComponent(sha)}/${encodedPath}`;
	}
}
