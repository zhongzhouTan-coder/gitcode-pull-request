import { GitCodeRepository } from '../models';

const SSH_REMOTE_PATTERN = /^git@gitcode\.com:(?<owner>[^/]+)\/(?<repo>[^.]+?)(?:\.git)?$/i;
const HTTPS_REMOTE_PATTERN = /^https:\/\/gitcode\.com\/(?<owner>[^/]+)\/(?<repo>[^.]+?)(?:\.git)?$/i;

export function parseGitCodeRemote(remoteUrl: string): Pick<GitCodeRepository, 'owner' | 'name' | 'fullName'> | undefined {
	const match = remoteUrl.match(SSH_REMOTE_PATTERN) ?? remoteUrl.match(HTTPS_REMOTE_PATTERN);
	if (!match?.groups) {
		return undefined;
	}

	const owner = match.groups.owner;
	const name = match.groups.repo;
	return {
		owner,
		name,
		fullName: `${owner}/${name}`,
	};
}
