import * as vscode from 'vscode';
import { AuthenticationFailedError } from '../common/errors';
import { UserService } from '../gitcode/services/userService';
import { SessionStore } from './sessionStore';
import { AuthProvider, AuthSession } from './types';

export class PATAuthProvider implements AuthProvider {
	constructor(
		private readonly sessionStore: SessionStore,
		private readonly userService: UserService,
	) {}

	async signIn(): Promise<AuthSession> {
		const token = await vscode.window.showInputBox({
			title: 'GitCode Personal Access Token',
			prompt: 'Enter a GitCode Personal Access Token',
			ignoreFocusOut: true,
			password: true,
			validateInput: (value) => (value.trim() ? undefined : 'Token is required'),
		});

		if (!token) {
			throw new AuthenticationFailedError('Sign-in cancelled.');
		}

		const account = await this.userService.getCurrentUser(token.trim());
		const session: AuthSession = {
			accessToken: token.trim(),
			accountName: account.login,
			authType: 'pat',
		};

		await this.sessionStore.write(session);
		return session;
	}

	async signOut(): Promise<void> {
		await this.sessionStore.delete();
	}

	getSession(): Promise<AuthSession | undefined> {
		return this.sessionStore.read();
	}
}
