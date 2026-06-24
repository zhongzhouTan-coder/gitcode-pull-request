import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitApi, GitRepository } from '../common/git/gitTypes';
import { RepositoryContextService } from '../common/git/repositoryContext';
import { Logger } from '../common/logger';

suite('RepositoryContextService', () => {
	test('waits for remotes on the active repository in a multi-root workspace', async () => {
		const document = await vscode.workspace.openTextDocument({ content: '', language: 'typescript' });
		await vscode.window.showTextDocument(document);

		const activeRepositoryChanges = new vscode.EventEmitter<void>();
		const otherRepositoryChanges = new vscode.EventEmitter<void>();
		const openRepository = new vscode.EventEmitter<GitRepository>();
		const closeRepository = new vscode.EventEmitter<GitRepository>();
		const activeRepository: GitRepository = {
			rootUri: vscode.Uri.file(document.uri.fsPath),
			state: {
				remotes: [],
				onDidChange: activeRepositoryChanges.event,
			},
		};
		const otherRepository: GitRepository = {
			rootUri: vscode.Uri.file('/other-repository'),
			state: {
				remotes: [{ name: 'origin', fetchUrl: 'https://gitcode.com/other/repository.git' }],
				onDidChange: otherRepositoryChanges.event,
			},
		};
		const gitApi: GitApi = {
			repositories: [activeRepository, otherRepository],
			onDidOpenRepository: openRepository.event,
			onDidCloseRepository: closeRepository.event,
		};
		const service = new RepositoryContextService({ debug: () => undefined } as unknown as Logger);
		service.getGitApi = async () => gitApi;

		try {
			const waiting = service.waitForRepository(500);
			const earlyResult = await Promise.race([
				waiting.then(() => 'resolved'),
				new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 10)),
			]);
			assert.strictEqual(earlyResult, 'pending');

			activeRepository.state.remotes.push({
				name: 'origin',
				fetchUrl: 'https://gitcode.com/active/repository.git',
			});
			activeRepositoryChanges.fire();

			assert.strictEqual(await waiting, activeRepository);
		} finally {
			activeRepositoryChanges.dispose();
			otherRepositoryChanges.dispose();
			openRepository.dispose();
			closeRepository.dispose();
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
	});
});
