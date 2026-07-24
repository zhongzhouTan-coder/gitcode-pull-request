export function formatGitPushErrorMessage(error: unknown, remoteName?: string): string {
	const rawMessage = error instanceof Error ? error.message : String(error ?? '');
	const message = rawMessage.trim() || 'git push failed.';
	const remoteHint = remoteName ? ` for remote "${remoteName}"` : '';

	if (/could not read Username/i.test(message) && /https:\/\/gitcode\.com/i.test(message)) {
		return `Failed to push${remoteHint}: Git credentials are not configured for https://gitcode.com. Configure a Git credential helper or personal access token, or switch the GitCode remote to SSH.`;
	}

	if (/Authentication failed/i.test(message) && /gitcode\.com/i.test(message)) {
		return `Failed to push${remoteHint}: GitCode rejected the Git credentials. Update the stored HTTPS credentials or switch the GitCode remote to SSH.`;
	}

	if (/Permission denied \(publickey\)/i.test(message) && /gitcode\.com/i.test(message)) {
		return `Failed to push${remoteHint}: GitCode rejected the SSH key. Add the correct SSH key to GitCode or choose a remote you can push to.`;
	}

	return `Failed to push${remoteHint}: ${message}`;
}
