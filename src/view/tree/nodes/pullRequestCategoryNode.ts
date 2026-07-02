import { AuthenticationFailedError, NotSignedInError, RepositoryNotOnGitCodeError, RepositoryResolutionError, ApiRequestError } from '../../../common/errors';
import { GitCodeRepository } from '../../../common/models';
import { PullRequestTreeStore, PullRequestCategoryKey } from '../../state/pullRequestTreeStore';
import { BaseNode } from './baseNode';
import { EmptyStateNode } from './emptyStateNode';
import { PullRequestNode } from './pullRequestNode';

export class PullRequestCategoryNode extends BaseNode {
	readonly id: string;

	constructor(
		private readonly store: PullRequestTreeStore,
		private readonly repository: GitCodeRepository,
		private readonly categoryKey: PullRequestCategoryKey,
		private readonly label: string,
		private readonly layoutSupplier: () => 'tree' | 'flat',
		parent?: BaseNode,
	) {
		super(parent);
		this.id = `category:${repository.fullName}:${categoryKey}`;
	}

	getTreeItem() {
		return {
			id: this.id,
			label: this.label,
			contextValue: 'pullRequestCategory',
			collapsibleState: 1,
		};
	}

	async getChildren(): Promise<BaseNode[]> {
		try {
			const pullRequests = await this.store.getPullRequests(this.repository, this.categoryKey);
			if (!pullRequests.length) {
				return [new EmptyStateNode(this.getEmptyLabel(), undefined, undefined, this)];
			}

			return pullRequests.map(
				(pullRequest) => new PullRequestNode(
					this.repository,
					this.categoryKey,
					pullRequest,
					this.store,
					this.layoutSupplier,
					this,
				),
			);
		} catch (error) {
			return [this.toErrorNode(error)];
		}
	}

	private getEmptyLabel(): string {
		switch (this.categoryKey) {
			case 'createdByMe':
				return 'No pull requests created by you';
			default:
				return 'No open pull requests';
		}
	}

	private toErrorNode(error: unknown): EmptyStateNode {
		if (error instanceof NotSignedInError) {
			return EmptyStateNode.signIn(this);
		}

		if (error instanceof AuthenticationFailedError) {
			return new EmptyStateNode('GitCode authentication failed', undefined, undefined, this);
		}

		if (error instanceof RepositoryResolutionError || error instanceof RepositoryNotOnGitCodeError) {
			return new EmptyStateNode(error.message, undefined, undefined, this);
		}

		if (error instanceof ApiRequestError) {
			const description = error.statusCode === 401 || error.statusCode === 403
				? 'Check your GitCode session'
				: `HTTP ${error.statusCode}`;
			return new EmptyStateNode('Unable to load pull requests', description, undefined, this);
		}

		if (error instanceof Error) {
			return new EmptyStateNode('Unable to load pull requests', error.message, undefined, this);
		}

		return new EmptyStateNode('Unable to load pull requests', undefined, undefined, this);
	}
}
