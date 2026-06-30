import { PullRequestDiffSnapshot } from '../../common/models';
import { GitCodeRepository } from '../../common/models';
import { PullRequestService } from '../../gitcode/services/pullRequestService';

/**
 * Caches the files.json diff snapshot by repository and PR number.
 * In-flight promises are shared so concurrent diff opens reuse the same request.
 */
export class PullRequestDiffStore {
	private readonly snapshots = new Map<string, Promise<PullRequestDiffSnapshot>>();

	constructor(private readonly pullRequestService: PullRequestService) {}

	getOrFetch(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestDiffSnapshot> {
		const key = this.makeKey(repository, pullRequestNumber);
		const existing = this.snapshots.get(key);
		if (existing) {
			return existing;
		}

		const promise = this.pullRequestService
			.getPullRequestDiffSnapshot(repository, pullRequestNumber)
			.catch((error) => {
				this.snapshots.delete(key);
				throw error;
			});

		this.snapshots.set(key, promise);
		return promise;
	}

	refresh(repository: GitCodeRepository, pullRequestNumber: number): Promise<PullRequestDiffSnapshot> {
		this.invalidate(repository.fullName, pullRequestNumber);
		return this.getOrFetch(repository, pullRequestNumber);
	}

	invalidate(repositoryKey: string, pullRequestNumber: number): void {
		const key = `${repositoryKey}#${pullRequestNumber}:snapshot`;
		this.snapshots.delete(key);
	}

	/** Clear all cached snapshots without disposing the store. */
	clear(): void {
		this.snapshots.clear();
	}

	dispose(): void {
		this.snapshots.clear();
	}

	private makeKey(repository: GitCodeRepository, pullRequestNumber: number): string {
		return `${repository.fullName}#${pullRequestNumber}:snapshot`;
	}
}
