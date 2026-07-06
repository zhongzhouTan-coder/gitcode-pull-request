export class GitCodeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class NotSignedInError extends GitCodeError {}
export class AuthenticationFailedError extends GitCodeError {}
export class RepositoryNotOnGitCodeError extends GitCodeError {}
export class ApiRequestError extends GitCodeError {
	constructor(
		message: string,
		public readonly statusCode: number,
		public readonly details?: string,
	) {
		super(message);
	}
}

export class RepositoryResolutionError extends GitCodeError {}

export function getApiRequestErrorMessage(error: unknown): string {
	if (!(error instanceof ApiRequestError)) {
		return error instanceof Error ? error.message : '';
	}

	if (!error.details) {
		return error.message;
	}

	try {
		const parsed = JSON.parse(error.details) as { error_message?: unknown };
		if (typeof parsed.error_message === 'string' && parsed.error_message.trim()) {
			return parsed.error_message;
		}
	} catch {
		// Fall back to the base error message when details are not structured JSON.
	}

	return error.message;
}
