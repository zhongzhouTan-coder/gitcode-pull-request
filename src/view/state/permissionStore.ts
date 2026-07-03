import { GitCodePermissionSnapshot, GitCodeRepository } from '../../common/models';
import { Logger } from '../../common/logger';
import { PermissionService } from '../../gitcode/services/permissionService';

/**
 * Caches permission snapshots by repository fullName for the current session.
 * Shared across issue and pull request views via ViewController.
 */
export class PermissionStore {
	private readonly cache = new Map<string, GitCodePermissionSnapshot>();
	private readonly inFlight = new Map<string, Promise<GitCodePermissionSnapshot>>();
	private generation = 0;

	constructor(
		private readonly service: PermissionService,
		private readonly logger: Logger,
	) {}

	/**
	 * Returns the cached snapshot when present, otherwise fetches from the API.
	 */
	async get(repository: GitCodeRepository): Promise<GitCodePermissionSnapshot> {
		const key = repository.fullName;
		const cached = this.cache.get(key);
		if (cached) {
			return cached;
		}

		return this.refresh(repository);
	}

	/**
	 * Returns the cached snapshot without triggering a fetch.
	 */
	peek(repository: GitCodeRepository): GitCodePermissionSnapshot | undefined {
		return this.cache.get(repository.fullName);
	}

	/**
	 * Always calls the API and replaces the cached snapshot.
	 * Concurrent calls for the same repository share one in-flight request.
	 */
	async refresh(repository: GitCodeRepository): Promise<GitCodePermissionSnapshot> {
		const key = repository.fullName;
		const requestGeneration = this.generation;

		// Deduplicate concurrent requests
		const existing = this.inFlight.get(key);
		if (existing) {
			return existing;
		}

		const promise = this.service.getRepositoryPermissions(repository)
			.then((snapshot) => {
				if (this.generation === requestGeneration) {
					this.cache.set(key, snapshot);
				}
				return snapshot;
			})
			.finally(() => {
				if (this.generation === requestGeneration) {
					this.inFlight.delete(key);
				}
			});

		this.inFlight.set(key, promise);
		return promise;
	}

	/**
	 * Refreshes permissions for multiple repositories.
	 * Failures on individual repositories are logged but do not prevent
	 * other repositories from being refreshed.
	 */
	async refreshAll(repositories: readonly GitCodeRepository[]): Promise<void> {
		const results = await Promise.allSettled(
			repositories.map((repo) => this.refresh(repo)),
		);

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			if (result.status === 'rejected') {
				this.logger.error(
					`Failed to refresh permissions for ${repositories[i].fullName}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
				);
			}
		}
	}

	/**
	 * Removes all cached permission snapshots.
	 * Called on sign-out or authentication session changes.
	 */
	clear(): void {
		this.generation++;
		this.cache.clear();
		this.inFlight.clear();
	}
}
