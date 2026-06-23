import { GitCodeRepository } from '../../common/models';
import { PullRequestTreeStore } from '../state/pullRequestTreeStore';
import { BaseNode } from './nodes/baseNode';
import { EmptyStateNode } from './nodes/emptyStateNode';
import { RepositoryNode } from './nodes/repositoryNode';

export class NodeFactory {
	constructor(
		private readonly store: PullRequestTreeStore,
		private readonly layoutSupplier: () => 'tree' | 'flat',
	) {}

	createRepositoryNode(repository: GitCodeRepository): RepositoryNode {
		return new RepositoryNode(this.store, repository, this.layoutSupplier);
	}

	createEmptyStateNode(label: string, description?: string): BaseNode {
		return new EmptyStateNode(label, description);
	}
}
