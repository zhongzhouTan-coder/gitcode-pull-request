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

		return this.findActiveRepository(gitApi);
	}

	/**
	 * Waits for a Git repository with remotes to become available.
	 * This handles the case where VS Code is starting up and the Git extension
	 * has not yet discovered repositories or loaded their remote information.
	 *
	 * @param timeoutMs Maximum time to wait in milliseconds (default: 15000)
	 * @returns A repository with remotes, or undefined if the timeout is reached.
	 */
	async waitForRepository(timeoutMs: number = 15000, options: { logTimeout?: boolean } = {}): Promise<GitRepository | undefined> {
		const gitApi = await this.getGitApi();
		if (!gitApi) {
			return undefined;
		}

		// Check if a repository with remotes is already available
		const existing = this.findRepositoryWithRemotes(gitApi);
		if (existing) {
			return existing;
		}

		// Wait for a repository with remotes to become available
		return new Promise<GitRepository | undefined>((resolve) => {
			let resolved = false;
			const disposables: vscode.Disposable[] = [];

			const done = (repo: GitRepository | undefined) => {
				if (resolved) {
					return;
				}
				resolved = true;
				for (const d of disposables) {
					d.dispose();
				}
				resolve(repo);
			};

			if (timeoutMs > 0) {
				const timeout = setTimeout(() => {
					if (options.logTimeout ?? true) {
						this.logger.debug('Timed out waiting for Git repository with remotes.');
					}
					done(undefined);
				}, timeoutMs);
				disposables.push(new vscode.Disposable(() => clearTimeout(timeout)));
			}

			// Listen for new repositories being opened
			disposables.push(
				gitApi.onDidOpenRepository((repo) => {
					if (this.isActiveRepositoryWithRemotes(gitApi, repo)) {
						done(repo);
					} else {
						// Repository opened but remotes not yet loaded — listen for state changes
						disposables.push(
							repo.state.onDidChange(() => {
								if (this.isActiveRepositoryWithRemotes(gitApi, repo)) {
									done(repo);
								}
							}),
						);
					}
				}),
			);

			// Also monitor existing repositories for state changes (remotes loading)
			for (const repo of gitApi.repositories) {
				disposables.push(
					repo.state.onDidChange(() => {
						if (this.isActiveRepositoryWithRemotes(gitApi, repo)) {
							done(repo);
						}
					}),
				);
			}
		});
	}

	private findRepositoryWithRemotes(gitApi: GitApi): GitRepository | undefined {
		const repository = this.findActiveRepository(gitApi);
		return repository?.state.remotes.length ? repository : undefined;
	}

	private isActiveRepositoryWithRemotes(gitApi: GitApi, repository: GitRepository): boolean {
		return this.findActiveRepository(gitApi) === repository && repository.state.remotes.length > 0;
	}

	private findActiveRepository(gitApi: GitApi): GitRepository | undefined {
		const activeFile = vscode.window.activeTextEditor?.document.uri;
		if (activeFile) {
			const matchingRepository = gitApi.repositories.find(
				(repository) => activeFile.fsPath.startsWith(repository.rootUri.fsPath),
			);
			if (matchingRepository) {
				return matchingRepository;
			}
		}

		return gitApi.repositories[0];
	}
}
