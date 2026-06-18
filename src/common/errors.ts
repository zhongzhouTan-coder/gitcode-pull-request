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
