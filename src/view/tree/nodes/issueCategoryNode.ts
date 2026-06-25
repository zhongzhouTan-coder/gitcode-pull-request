import { AuthenticationFailedError, NotSignedInError, RepositoryNotOnGitCodeError, RepositoryResolutionError, ApiRequestError } from '../../../common/errors';
import { GitCodeRepository } from '../../../common/models';
import { IssueTreeStore, IssueCategoryKey } from '../../state/issueTreeStore';
import { BaseNode } from './baseNode';
import { EmptyStateNode } from './emptyStateNode';
import { IssueNode } from './issueNode';

export class IssueCategoryNode extends BaseNode {
	readonly id: string;

	constructor(
		private readonly store: IssueTreeStore,
		private readonly repository: GitCodeRepository,
		private readonly categoryKey: IssueCategoryKey,
		private readonly label: string,
		parent?: BaseNode,
	) {
		super(parent);
		this.id = `issueCategory:${repository.fullName}:${categoryKey}`;
	}

	getTreeItem() {
		return {
			id: this.id,
			label: this.label,
			contextValue: 'issueCategory',
			collapsibleState: 1, // Collapsed — expand to load issues
		};
	}

	async getChildren(): Promise<BaseNode[]> {
		try {
			const issues = await this.store.getIssues(this.repository, this.categoryKey);
			if (!issues.length) {
				return [new EmptyStateNode('No open issues', undefined, undefined, this)];
			}

			return issues.map((issue) => new IssueNode(this.repository, issue, this));
		} catch (error) {
			return [this.toErrorNode(error)];
		}
	}

	private toErrorNode(error: unknown): EmptyStateNode {
		if (error instanceof NotSignedInError) {
			return new EmptyStateNode('Sign in to GitCode', undefined, undefined, this);
		}

		if (error instanceof AuthenticationFailedError) {
			return new EmptyStateNode('GitCode authentication failed', undefined, undefined, this);
		}

		if (error instanceof RepositoryNotOnGitCodeError) {
			return new EmptyStateNode('No GitCode remote found', 'Set gitcode.repository to override the workspace repository.', undefined, this);
		}

		if (error instanceof RepositoryResolutionError) {
			return new EmptyStateNode('Open a git repository to list issues', error.message, undefined, this);
		}

		if (error instanceof ApiRequestError) {
			const description = error.statusCode === 401 || error.statusCode === 403
				? 'Check your GitCode session'
				: `HTTP ${error.statusCode}`;
			return new EmptyStateNode('Unable to load issues', description, undefined, this);
		}

		if (error instanceof Error) {
			return new EmptyStateNode('Unable to load issues', error.message, undefined, this);
		}

		return new EmptyStateNode('Unable to load issues', undefined, undefined, this);
	}
}
