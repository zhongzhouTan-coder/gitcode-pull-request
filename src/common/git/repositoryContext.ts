import * as vscode from 'vscode';
import { EXTENSION_ID } from '../constants';
import { Logger } from '../logger';
import { GitApi, GitExtension, GitRepository } from './gitTypes';

export class RepositoryContextService {
	constructor(private readonly logger: Logger) {}

	async getGitApi(): Promise<GitApi | undefined> {
		const extension = vscode.extensions.getExtension<GitExtension>(EXTENSION_ID.git);
		if (!extension) {
			this.logger.error('VS Code Git extension is unavailable.');
			return undefined;
		}

		if (!extension.isActive) {
			try {
				await extension.activate();
			} catch (error) {
				this.logger.error(
					`Failed to activate VS Code Git extension: ${error instanceof Error ? error.message : String(error)}`,
				);
				return undefined;
			}
		}

		const exports = extension.exports;
		if (!exports) {
			this.logger.debug('VS Code Git extension did not expose an API.');
			return undefined;
		}

		return exports.getAPI(1);
	}

	async getActiveRepository(): Promise<GitRepository | undefined> {
		const gitApi = await this.getGitApi();
		if (!gitApi) {
			return undefined;
		}

		const activeFile = vscode.window.activeTextEditor?.document.uri;
		if (activeFile) {
			const matchingRepository = gitApi.repositories.find((repository) =>
				activeFile.fsPath.startsWith(repository.rootUri.fsPath),
			);
			if (matchingRepository) {
				return matchingRepository;
			}
		}

		return gitApi.repositories[0];
	}
}
