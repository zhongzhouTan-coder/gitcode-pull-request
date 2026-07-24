import * as vscode from 'vscode';
import { Logger } from '../../common/logger';
import { RepositoryContextService } from '../../common/git/repositoryContext';
import { LocalGitService } from '../../common/git/localGitService';
import { GitRemote, GitRepository } from '../../common/git/gitTypes';
import { parseGitCodeRemote } from '../../common/git/remoteParser';
import { IssueNode, IssueNodeContext } from '../tree/nodes/issueNode';

export type IssueBranchBase = {
	label: string;
	description: string;
	startPoint?: string;
	remoteName?: string;
	branchName?: string;
};

export type IssueCommandContext = {
	repository: IssueNodeContext['repository'];
	issueNumber: number;
	title: string;
	url?: string;
};

export function resolveIssueContext(value: unknown): IssueNodeContext | undefined {
	if (!value) {
		return undefined;
	}

	if (isIssueNodeContext(value)) {
		return value;
	}

	if (value instanceof IssueNode) {
		return value.context;
	}

	return undefined;
}

function isIssueNodeContext(value: unknown): value is IssueNodeContext {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return typeof candidate.repository === 'object'
		&& typeof candidate.issue === 'object';
}

export function resolveIssueCommandContext(value: unknown): IssueCommandContext | undefined {
	const issueContext = resolveIssueContext(value);
	if (issueContext) {
		return {
			repository: issueContext.repository,
			issueNumber: issueContext.issue.number,
			title: issueContext.issue.title,
			url: issueContext.issue.url,
		};
	}

	if (!value || typeof value !== 'object') {
		return undefined;
	}

	const candidate = value as Record<string, unknown>;
	if (
		typeof candidate.repository === 'object'
		&& typeof candidate.issueNumber === 'number'
		&& typeof candidate.title === 'string'
	) {
		return {
			repository: candidate.repository as IssueCommandContext['repository'],
			issueNumber: candidate.issueNumber,
			title: candidate.title,
			url: typeof candidate.url === 'string' ? candidate.url : undefined,
		};
	}

	return undefined;
}

function splitRemoteBranch(remoteBranch: string, remotes: GitRemote[]): { remoteName: string; branchName: string } | undefined {
	const matchingRemote = [...remotes]
		.sort((a, b) => b.name.length - a.name.length)
		.find((remote) => remoteBranch === remote.name || remoteBranch.startsWith(`${remote.name}/`));

	if (!matchingRemote || remoteBranch === matchingRemote.name) {
		return undefined;
	}

	return {
		remoteName: matchingRemote.name,
		branchName: remoteBranch.slice(matchingRemote.name.length + 1),
	};
}

export function repositoryMatchesIssue(gitRepo: GitRepository, issueRepository: IssueCommandContext['repository']): boolean {
	return gitRepo.state.remotes.some((remote) => {
		const remoteUrl = remote.fetchUrl ?? remote.pushUrl;
		if (!remoteUrl) {
			return false;
		}

		return parseGitCodeRemote(remoteUrl)?.fullName === issueRepository.fullName;
	});
}

export async function getIssueGitRepository(
	repositoryContext: RepositoryContextService,
	issueRepository: IssueCommandContext['repository'],
	logger: Logger,
): Promise<GitRepository | undefined> {
	const gitApi = await repositoryContext.getGitApi();
	if (!gitApi) {
		return undefined;
	}

	const matchingRepositories = gitApi.repositories.filter((repository) => repositoryMatchesIssue(repository, issueRepository));
	if (!matchingRepositories.length) {
		logger.error(`No open local git repository matches GitCode repository ${issueRepository.fullName}.`);
		return undefined;
	}

	try {
		const activeRepository = await repositoryContext.getActiveRepository();
		if (activeRepository && matchingRepositories.includes(activeRepository)) {
			return activeRepository;
		}
	} catch (error) {
		logger.error(`Failed to get active repository: ${error instanceof Error ? error.message : String(error)}`);
	}

	return matchingRepositories[0];
}

export async function pickIssueBranchBase(
	gitService: LocalGitService,
	gitRepo: GitRepository,
	logger: Logger,
): Promise<IssueBranchBase | undefined> {
	const currentBranch = await gitService.getCurrentBranch(gitRepo);
	const remotes = gitRepo.state.remotes;
	const remoteBranches = new Set<string>();

	try {
		for (const branch of await gitService.listRemoteBranches(gitRepo)) {
			remoteBranches.add(branch);
		}
	} catch (error) {
		logger.error(`Failed to list remote branches: ${error instanceof Error ? error.message : String(error)}`);
	}

	const remoteItems = [...remoteBranches]
		.map((branch): IssueBranchBase | undefined => {
			const parsed = splitRemoteBranch(branch, remotes);
			if (!parsed) {
				return undefined;
			}
			return {
				label: branch,
				description: 'Fetch before creating branch',
				startPoint: branch,
				remoteName: parsed.remoteName,
				branchName: parsed.branchName,
			};
		})
		.filter((item): item is IssueBranchBase => item !== undefined)
		.sort((a, b) => {
			const priority = (label: string): number => {
				switch (label) {
					case 'upstream/master': return 0;
					case 'origin/master': return 1;
					case 'upstream/main': return 2;
					case 'origin/main': return 3;
					default: return 4;
				}
			};
			return priority(a.label) - priority(b.label) || a.label.localeCompare(b.label);
		});

	const currentItem: IssueBranchBase = {
		label: currentBranch ? `Current branch (${currentBranch})` : 'Current branch',
		description: 'Do not fetch; create from current HEAD',
	};

	return vscode.window.showQuickPick(
		[...remoteItems, currentItem],
		{
			placeHolder: 'Select the base branch for the issue branch',
			ignoreFocusOut: true,
		},
	);
}
