import * as vscode from 'vscode';
import { SessionStore } from './sessionStore';
import { AuthProvider, AuthSession } from './types';

export class AuthService {
	private readonly onDidChangeSessionEmitter = new vscode.EventEmitter<AuthSession | undefined>();

	readonly onDidChangeSession = this.onDidChangeSessionEmitter.event;

	constructor(
		private readonly provider: AuthProvider,
		private readonly sessionStore: SessionStore,
	) {}

	async signIn(): Promise<AuthSession> {
		const session = await this.provider.signIn();
		this.onDidChangeSessionEmitter.fire(session);
		return session;
	}

	async signOut(): Promise<void> {
		await this.provider.signOut();
		this.onDidChangeSessionEmitter.fire(undefined);
	}

	async getSession(): Promise<AuthSession | undefined> {
		return this.sessionStore.read();
	}
}
