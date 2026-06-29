import { GitRepository } from './gitTypes';

/**
 * Lightweight git operations that the VS Code Git extension API does not
 * expose directly.  All methods use argument arrays; no shell string
 * building.
 */
export class LocalGitService {
	async getCurrentBranch(repository: GitRepository): Promise<string | undefined> {
		return repository.state.HEAD?.name;
	}

	async hasUncommittedChanges(repository: GitRepository): Promise<boolean> {
		try {
			const result = await this.runGit(repository, ['status', '--porcelain']);
			return result.stdout.trim().length > 0;
		} catch {
			return false;
		}
	}

	async branchExists(repository: GitRepository, branchName: string): Promise<boolean> {
		try {
			await this.runGit(repository, ['rev-parse', '--verify', `refs/heads/${branchName}`]);
			return true;
		} catch {
			return false;
		}
	}

	async listRemoteBranches(repository: GitRepository): Promise<string[]> {
		const result = await this.runGit(repository, ['branch', '--remotes', '--format=%(refname:short)']);
		return result.stdout
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.endsWith('/HEAD'));
	}

	async fetchBranch(repository: GitRepository, remoteName: string, branchName: string): Promise<void> {
		await this.runGit(repository, [
			'fetch',
			remoteName,
			`+refs/heads/${branchName}:refs/remotes/${remoteName}/${branchName}`,
		]);
	}

	async createAndCheckoutBranch(
		repository: GitRepository,
		branchName: string,
		startPoint?: string,
	): Promise<void> {
		const args = ['checkout', '-b', branchName];
		if (startPoint) {
			args.push(startPoint);
		}

		await this.runGit(repository, args);
	}

	async checkoutBranch(
		repository: GitRepository,
		branchName: string,
	): Promise<void> {
		await this.runGit(repository, ['checkout', branchName]);
	}

	private async runGit(
		repository: GitRepository,
		args: string[],
	): Promise<{ stdout: string; stderr: string }> {
		const { spawn } = await import('child_process');

		return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
			const child = spawn('git', args, {
				cwd: repository.rootUri.fsPath,
				env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
			});

			let stdout = '';
			let stderr = '';
			child.stdout.on('data', (data: Buffer) => {
				stdout += data.toString();
			});
			child.stderr.on('data', (data: Buffer) => {
				stderr += data.toString();
			});

			child.on('close', (code) => {
				if (code === 0) {
					resolve({ stdout, stderr });
				} else {
					reject(new Error(stderr.trim() || `git ${args[0]} failed with exit code ${code}`));
				}
			});

			child.on('error', (err) => {
				reject(new Error(`Failed to run git: ${err.message}`));
			});
		});
	}
}

/**
 * Generate a branch name slug from an issue title.
 */
export function issueBranchSlug(issueNumber: number, title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50);
	return `issue/${issueNumber}-${slug}`;
}
