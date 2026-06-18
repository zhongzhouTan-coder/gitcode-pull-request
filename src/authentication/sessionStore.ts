import * as vscode from 'vscode';
import { SECRET_STORAGE_KEY } from '../common/constants';
import { AuthSession } from './types';

export class SessionStore {
	constructor(private readonly secretStorage: vscode.SecretStorage) {}

	async read(): Promise<AuthSession | undefined> {
		const value = await this.secretStorage.get(SECRET_STORAGE_KEY);
		return value ? (JSON.parse(value) as AuthSession) : undefined;
	}

	async write(session: AuthSession): Promise<void> {
		await this.secretStorage.store(SECRET_STORAGE_KEY, JSON.stringify(session));
	}

	async delete(): Promise<void> {
		await this.secretStorage.delete(SECRET_STORAGE_KEY);
	}
}
