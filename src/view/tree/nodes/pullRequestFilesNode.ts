import * as vscode from 'vscode';
import { AuthenticationFailedError, NotSignedInError, RepositoryNotOnGitCodeError, RepositoryResolutionError, ApiRequestError } from '../../../common/errors';
import { GitCodeRepository, PullRequestFileChange } from '../../../common/models';
import { PullRequestTreeStore } from '../../state/pullRequestTreeStore';
import { BaseNode } from './baseNode';
import { DirectoryNode } from './directoryNode';
import { EmptyStateNode } from './emptyStateNode';
import { PullRequestFileNode } from './pullRequestFileNode';

interface DirectoryEntry {
	type: 'directory';
	path: string;
	children: Map<string, DirEntry>;
	files: PullRequestFileChange[];
}

type DirEntry = DirectoryEntry | { type: 'file'; file: PullRequestFileChange };

export class PullRequestFilesNode extends BaseNode {
	readonly id: string;
	private totalAdditions = 0;
	private totalDeletions = 0;
	private fileCount = 0;

	constructor(
		private readonly store: PullRequestTreeStore,
		private readonly repository: GitCodeRepository,
		private readonly pullRequestNumber: number,
		private readonly layoutSupplier: () => 'tree' | 'flat',
		parent?: BaseNode,
	) {
		super(parent);
		this.id = `pullRequestFiles:${repository.fullName}:${pullRequestNumber}`;
	}

	getTreeItem(): vscode.TreeItem {
		const item = new vscode.TreeItem('Files', vscode.TreeItemCollapsibleState.Collapsed);
		item.id = this.id;
		item.contextValue = 'pullRequestFiles';
		return item;
	}

	async getChildren(): Promise<BaseNode[]> {
		try {
			const files = await this.store.getPullRequestFiles(this.repository, this.pullRequestNumber);
			if (!files.length) {
				return [new EmptyStateNode('No changed files', undefined, undefined, this)];
			}

			this.fileCount = files.length;
			this.totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
			this.totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

			const layout = this.layoutSupplier();
			if (layout === 'flat') {
				return this.buildFlatLayout(files);
			}

			return this.buildTreeLayout(files);
		} catch (error) {
			return [this.toErrorNode(error)];
		}
	}

	updateTreeItem(item: vscode.TreeItem): void {
		if (this.fileCount > 0) {
			item.label = `Files (${this.fileCount})`;
			item.description = `+${this.totalAdditions} -${this.totalDeletions}`;
		}
	}

	private buildFlatLayout(files: PullRequestFileChange[]): PullRequestFileNode[] {
		const layout = 'flat';
		return files.map((file) => new PullRequestFileNode(this.repository, this.pullRequestNumber, file, layout, this));
	}

	private buildTreeLayout(files: PullRequestFileChange[]): BaseNode[] {
		const root: DirectoryEntry = { type: 'directory', path: '', children: new Map(), files: [] };

		for (const file of files) {
			const segments = file.path.split('/').filter(Boolean);
			this.insertIntoTree(root, segments, file);
		}

		this.compactTree(root);

		const layout = 'tree';
		return this.convertToNodes(root, layout);
	}

	private insertIntoTree(dir: DirectoryEntry, segments: string[], file: PullRequestFileChange): void {
		if (segments.length === 0) {
			dir.files.push(file);
			return;
		}

		const [head, ...rest] = segments;
		if (rest.length === 0) {
			dir.children.set(head, { type: 'file', file });
			return;
		}

		let child = dir.children.get(head);
		if (!child || child.type === 'file') {
			const newDir: DirectoryEntry = { type: 'directory', path: dir.path ? `${dir.path}/${head}` : head, children: new Map(), files: [] };
			dir.children.set(head, newDir);
			child = newDir;
		}

		const childDir = child as DirectoryEntry;
		this.insertIntoTree(childDir, rest, file);
	}

	private compactTree(dir: DirectoryEntry): void {
		for (const [name, child] of dir.children) {
			if (child.type === 'directory') {
				this.compactTree(child);
			}
		}

		while (dir.files.length === 0 && dir.children.size === 1) {
			const [singleEntry] = dir.children.entries();
			const [name, child] = singleEntry;
			if (child.type !== 'directory') {
				break;
			}

			const childDir = child as DirectoryEntry;
			const newPath = childDir.path;
			dir.path = newPath;
			dir.children = childDir.children;
			dir.files = childDir.files;

			for (const [childName, grandchild] of dir.children) {
				if (grandchild.type === 'directory') {
					(grandchild as DirectoryEntry).path = `${newPath}/${childName}`;
				}
			}
		}
	}

	private convertToNodes(dir: DirectoryEntry, layout: 'tree' | 'flat'): BaseNode[] {
		const nodes: BaseNode[] = [];

		const sortedDirs = [...dir.children.entries()]
			.filter(([, entry]) => entry.type === 'directory')
			.sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

		const sortedFiles = [...dir.children.values()]
			.filter((entry): entry is { type: 'file'; file: PullRequestFileChange } => entry.type === 'file')
			.sort((a, b) => a.file.path.localeCompare(b.file.path, undefined, { sensitivity: 'base' }));

		for (const [/* name */, child] of sortedDirs) {
			const childDir = child as DirectoryEntry;
			nodes.push(new DirectoryNode(
				this.repository,
				this.pullRequestNumber,
				childDir.path,
				(childPath) => {
					const subDir = this.findDirByPath(dir, childPath);
					return subDir ? this.convertToNodes(subDir, layout) : [];
				},
				this,
			));
		}

		for (const entry of sortedFiles) {
			nodes.push(new PullRequestFileNode(this.repository, this.pullRequestNumber, entry.file, layout, this));
		}

		return nodes;
	}

	private findDirByPath(dir: DirectoryEntry, targetPath: string): DirectoryEntry | undefined {
		if (dir.path === targetPath) {
			return dir;
		}

		for (const [, child] of dir.children) {
			if (child.type === 'directory') {
				const found = this.findDirByPath(child, targetPath);
				if (found) {
					return found;
				}
			}
		}

		return undefined;
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
			if (error.statusCode === 404) {
				return new EmptyStateNode('Pull request or repository not found', undefined, undefined, this);
			}

			const description = error.statusCode === 401 || error.statusCode === 403
				? 'Check your GitCode session'
				: `HTTP ${error.statusCode}`;
			return new EmptyStateNode('Unable to load changed files', description, undefined, this);
		}

		if (error instanceof Error) {
			return new EmptyStateNode('Unable to load changed files', error.message, undefined, this);
		}

		return new EmptyStateNode('Unable to load changed files', undefined, undefined, this);
	}
}
