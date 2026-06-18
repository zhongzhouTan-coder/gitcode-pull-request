import { ExtensionConfiguration } from '../../common/configuration';
import { RepositoryNotOnGitCodeError, RepositoryResolutionError } from '../../common/errors';
import { RepositoryContextService } from '../../common/git/repositoryContext';
import { parseGitCodeRemote } from '../../common/git/remoteParser';
import { GitCodeRepository } from '../../common/models';

export class GitCodeRepositoryResolver {
	constructor(
		private readonly repositoryContext: RepositoryContextService,
		private readonly configuration: ExtensionConfiguration,
	) {}

	async resolve(): Promise<GitCodeRepository> {
		const repositories = await this.resolveAll();
		if (!repositories.length) {
			throw new RepositoryNotOnGitCodeError('No GitCode repository could be resolved from the active repository.');
		}

		return repositories[0];
	}

	async resolveAll(): Promise<GitCodeRepository[]> {
		const override = this.configuration.getRepositoryOverride();
		if (override) {
			return [this.fromFullName(override, 'override')];
		}

		const repository = await this.repositoryContext.getActiveRepository();
		if (!repository) {
			throw new RepositoryResolutionError('No active git repository is available from the VS Code Git extension.');
		}

		const remotes = repository.state.remotes
			.map((remote) => ({
				name: remote.name,
				url: remote.fetchUrl ?? remote.pushUrl,
			}))
			.filter((remote): remote is { name: string; url: string } => Boolean(remote.url));
		if (!remotes.length) {
			throw new RepositoryNotOnGitCodeError('No git remote found for the active repository.');
		}

		const prioritizedRemotes = [...remotes].sort((left, right) => {
			return this.getRemotePriority(left.name) - this.getRemotePriority(right.name);
		});

		const repositories: GitCodeRepository[] = [];
		const seenFullNames = new Set<string>();
		for (const remote of prioritizedRemotes) {
			const parsed = parseGitCodeRemote(remote.url);
			if (parsed) {
				if (seenFullNames.has(parsed.fullName)) {
					continue;
				}

				seenFullNames.add(parsed.fullName);
				repositories.push({
					remoteName: remote.name,
					...parsed,
					webUrl: `${this.configuration.getWebUrl()}/${parsed.fullName}`,
				});
			}
		}

		if (repositories.length) {
			return repositories;
		}

		throw new RepositoryNotOnGitCodeError(
			`The active repository has git remotes, but none point to GitCode. Found: ${remotes.map((remote) => `${remote.name}=${remote.url}`).join(', ')}. Configure gitcode.repository to map this workspace to a GitCode repository.`,
		);
	}

	private fromFullName(fullName: string, remoteName: string): GitCodeRepository {
		const [owner, name, ...rest] = fullName.split('/');
		if (!owner || !name || rest.length > 0) {
			throw new RepositoryResolutionError(
				`Invalid gitcode.repository value "${fullName}". Expected "owner/repo".`,
			);
		}

		const parsed = parseGitCodeRemote(`${this.configuration.getWebUrl()}/${owner}/${name}.git`);
		if (!parsed) {
			throw new RepositoryResolutionError(`Unable to resolve GitCode repository from override "${fullName}".`);
		}

		return {
			remoteName,
			...parsed,
			webUrl: `${this.configuration.getWebUrl()}/${parsed.fullName}`,
		};
	}

	private getRemotePriority(remoteName: string): number {
		if (remoteName === 'origin') {
			return 0;
		}

		if (remoteName === 'upstream') {
			return 1;
		}

		return 2;
	}
}
