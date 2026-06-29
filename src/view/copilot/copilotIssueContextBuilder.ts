import * as vscode from 'vscode';
import { IssueService } from '../../gitcode/services/issueService';
import { IssueCommentService } from '../../gitcode/services/issueCommentService';
import { RepositoryContextService } from '../../common/git/repositoryContext';
import { SelectedCopilotIssue } from './copilotIssueContextStore';

const MAX_BODY_CHARS = 12_000;
const MAX_COMMENTS = 50;
const MAX_SINGLE_COMMENT_CHARS = 2_000;
const MAX_RELATED_PRS = 20;
const MAX_TOTAL_CHARS = 40_000;

export class CopilotIssueContextBuilder {
	constructor(
		private readonly issueService: IssueService,
		private readonly issueCommentService: IssueCommentService,
		private readonly repositoryContextService: RepositoryContextService,
	) {}

	async build(
		selected: SelectedCopilotIssue,
		token: vscode.CancellationToken,
	): Promise<string> {
		const { repository, issueNumber } = selected;
		const parts: string[] = [];

		// 1. Repository metadata
		parts.push(`## Repository: ${repository.fullName}`);
		parts.push(`Remote: ${repository.remoteName}`);
		parts.push(`Web URL: ${repository.webUrl}`);
		parts.push('');

		// 2. Issue detail (strict — fail the request if this fails)
		try {
			const detail = await this.issueService.getIssue(repository, issueNumber);
			if (token.isCancellationRequested) { return ''; }

			parts.push(`## Issue #${detail.number}: ${detail.title}`);
			parts.push(`State: ${detail.state}`);
			parts.push(`Author: ${detail.author.login}`);
			if (detail.labels.length > 0) {
				parts.push(`Labels: ${detail.labels.map((l) => l.name).join(', ')}`);
			}
			if (detail.assignees.length > 0) {
				parts.push(`Assignees: ${detail.assignees.map((a) => a.login).join(', ')}`);
			}
			if (detail.milestone) {
				parts.push(`Milestone: ${detail.milestone.title}`);
			}
			if (detail.issueTypeDetail) {
				parts.push(`Type: ${detail.issueTypeDetail.title}`);
			}
			if (detail.priorityDetail) {
				parts.push(`Priority: ${detail.priorityDetail.title}`);
			}
			if (detail.issueStateDetail) {
				parts.push(`Workflow State: ${detail.issueStateDetail.title}`);
			}
			parts.push(`Created: ${detail.createdAt} | Updated: ${detail.updatedAt}`);
			if (detail.url) {
				parts.push(`URL: ${detail.url}`);
			}
			parts.push('');

			if (detail.body) {
				parts.push('### Description');
				parts.push(truncate(detail.body, MAX_BODY_CHARS));
				parts.push('');
			}
		} catch (error) {
			throw new Error(
				`Unable to load issue #${issueNumber} from ${repository.fullName}: ${errorMessage(error)}`,
			);
		}

		if (token.isCancellationRequested) { return ''; }

		// 3. Issue comments (lenient)
		try {
			const comments = await this.issueCommentService.listIssueComments(repository, issueNumber);
			if (token.isCancellationRequested) { return ''; }

			const newest = comments.slice(-MAX_COMMENTS);

			if (newest.length > 0) {
				parts.push(`### Recent Comments (${newest.length}${comments.length > MAX_COMMENTS ? ` of ${comments.length}` : ''})`);
				parts.push('');

				for (const comment of newest) {
					parts.push(`**${comment.author.login}** at ${comment.createdAt}:`);
					parts.push(truncate(comment.body, MAX_SINGLE_COMMENT_CHARS));
					parts.push('');
				}

				if (comments.length > MAX_COMMENTS) {
					parts.push(`[limited to the ${MAX_COMMENTS} most recent comments]`);
					parts.push('');
				}
			}
		} catch (error) {
			parts.push('### Comments');
			parts.push(`_Unable to load comments: ${errorMessage(error)}_`);
			parts.push('');
		}

		if (token.isCancellationRequested) { return ''; }

		// 4. Related pull requests (lenient)
		try {
			const relatedPrs = await this.issueService.listIssueRelatedPullRequests(repository, issueNumber);
			if (token.isCancellationRequested) { return ''; }

			const prLimit = Math.min(relatedPrs.length, MAX_RELATED_PRS);
			const truncated = relatedPrs.length > MAX_RELATED_PRS;

			if (prLimit > 0) {
				parts.push(`### Related Pull Requests (${prLimit}${truncated ? ` of ${relatedPrs.length}` : ''})`);
				parts.push('');

				for (let i = 0; i < prLimit; i++) {
					const pr = relatedPrs[i];
					parts.push(`- #${pr.number} ${pr.title} (${pr.state}) by ${pr.author.login}`);
					parts.push(`  Source: ${pr.source.ref} → Target: ${pr.target.ref}`);
					if (pr.url) {
						parts.push(`  URL: ${pr.url}`);
					}
					parts.push('');
				}

				if (truncated) {
					parts.push(`[truncated: ${relatedPrs.length - MAX_RELATED_PRS} more pull requests not shown]`);
					parts.push('');
				}
			}
		} catch (error) {
			parts.push('### Related Pull Requests');
			parts.push(`_Unable to load related pull requests: ${errorMessage(error)}_`);
			parts.push('');
		}

		if (token.isCancellationRequested) { return ''; }

		// 5. Workspace metadata
		try {
			const gitRepo = await this.repositoryContextService.getActiveRepository();
			if (gitRepo) {
				const currentBranch = gitRepo.state.HEAD?.name;
				if (currentBranch) {
					parts.push('### Workspace');
					parts.push(`Current branch: \`${currentBranch}\``);
					parts.push(`Repository path: ${gitRepo.rootUri.fsPath}`);
					parts.push('');
				}
			}
		} catch {
			// Omit workspace section if unavailable
		}

		// Build final payload
		const raw = parts.join('\n');
		return truncate(raw, MAX_TOTAL_CHARS);
	}
}

function truncate(value: string, maxChars: number): string {
	if (value.length <= maxChars) {
		return value;
	}
	return value.slice(0, maxChars) + '\n[truncated]';
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
