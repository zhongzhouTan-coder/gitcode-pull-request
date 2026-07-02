import * as vscode from 'vscode';
import { IssueService } from '../../gitcode/services/issueService';
import { IssueCommentService } from '../../gitcode/services/issueCommentService';
import { RepositoryContextService } from '../../common/git/repositoryContext';
import { SelectedCopilotIssue } from './copilotIssueContextStore';
import { IssueComment, IssueRelatedPullRequest } from '../../common/models';
import { BudgetedContextWriter } from './budgetedContextWriter';
import { CopilotPromptBudget, DEFAULT_COPILOT_PROMPT_BUDGET } from './copilotPromptBudget';
import { GitRepository } from '../../common/git/gitTypes';

const MAX_COMMENTS = 50;
const MAX_RELATED_PRS = 20;

type Result<T> =
	| { ok: true; value: T }
	| { ok: false; error: unknown };

export class CopilotIssueContextBuilder {
	constructor(
		private readonly issueService: IssueService,
		private readonly issueCommentService: IssueCommentService,
		private readonly repositoryContextService: RepositoryContextService,
	) {}

	async build(
		selected: SelectedCopilotIssue,
		token: vscode.CancellationToken,
		budget: CopilotPromptBudget = DEFAULT_COPILOT_PROMPT_BUDGET,
	): Promise<string> {
		const { repository, issueNumber } = selected;
		const writer = new BudgetedContextWriter(budget.maxContextChars);

		writer.appendLine(`## Repository: ${repository.fullName}`);
		writer.appendLine(`Remote: ${repository.remoteName}`);
		writer.appendLine(`Web URL: ${repository.webUrl}`);
		writer.appendLine();

		let detail;
		try {
			detail = await this.issueService.getIssue(repository, issueNumber);
		} catch (error) {
			throw new Error(
				`Unable to load issue #${issueNumber} from ${repository.fullName}: ${errorMessage(error)}`,
			);
		}

		if (token.isCancellationRequested) {
			return '';
		}

		const [commentsResult, relatedPrsResult, workspaceResult] = await Promise.all([
			toResult(this.issueCommentService.listIssueComments(repository, issueNumber)),
			toResult(this.issueService.listIssueRelatedPullRequests(repository, issueNumber)),
			toResult(this.repositoryContextService.getActiveRepository()),
		]);

		if (token.isCancellationRequested) {
			return '';
		}

		writer.appendLine(`## Issue #${detail.number}: ${detail.title}`);
		writer.appendLine(`State: ${detail.state}`);
		writer.appendLine(`Author: ${detail.author.login}`);
		if (detail.labels.length > 0) {
			writer.appendLine(`Labels: ${detail.labels.map((label) => label.name).join(', ')}`);
		}
		if (detail.assignees.length > 0) {
			writer.appendLine(`Assignees: ${detail.assignees.map((assignee) => assignee.login).join(', ')}`);
		}
		if (detail.milestone) {
			writer.appendLine(`Milestone: ${detail.milestone.title}`);
		}
		if (detail.issueTypeDetail) {
			writer.appendLine(`Type: ${detail.issueTypeDetail.title}`);
		}
		if (detail.priorityDetail) {
			writer.appendLine(`Priority: ${detail.priorityDetail.title}`);
		}
		if (detail.issueStateDetail) {
			writer.appendLine(`Workflow State: ${detail.issueStateDetail.title}`);
		}
		writer.appendLine(`Created: ${detail.createdAt} | Updated: ${detail.updatedAt}`);
		if (detail.url) {
			writer.appendLine(`URL: ${detail.url}`);
		}
		writer.appendLine();

		if (detail.body) {
			writer.appendLine('### Description');
			writer.appendTruncated(detail.body, budget.maxBodyChars);
			writer.appendLine();
			writer.appendLine();
		}

		appendIssueComments(writer, commentsResult, budget);
		appendRelatedPullRequests(writer, relatedPrsResult);
		appendWorkspace(writer, workspaceResult);

		return writer.toString();
	}
}

function appendIssueComments(
	writer: BudgetedContextWriter,
	result: Result<IssueComment[]>,
	budget: CopilotPromptBudget,
): void {
	if (!result.ok) {
		writer.appendLine('### Comments');
		writer.appendLine(`_Unable to load comments: ${errorMessage(result.error)}_`);
		writer.appendLine();
		return;
	}

	const comments = [...result.value]
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	const selected = comments.slice(0, MAX_COMMENTS);

	if (selected.length === 0) {
		return;
	}

	writer.appendLine(`### Recent Comments (${selected.length}${comments.length > selected.length ? ` of ${comments.length}` : ''})`);
	writer.appendLine();

	for (const comment of selected) {
		writer.appendLine(`- ${comment.author.login} at ${comment.createdAt}`);
		writer.appendTruncated(indent(comment.body), budget.maxPullRequestCommentChars);
		writer.appendLine();
		writer.appendLine();
	}

	if (comments.length > selected.length) {
		writer.appendLine(`[limited to the ${selected.length} most recent comments]`);
		writer.appendLine();
	}
}

function appendRelatedPullRequests(
	writer: BudgetedContextWriter,
	result: Result<IssueRelatedPullRequest[]>,
): void {
	if (!result.ok) {
		writer.appendLine('### Related Pull Requests');
		writer.appendLine(`_Unable to load related pull requests: ${errorMessage(result.error)}_`);
		writer.appendLine();
		return;
	}

	const relatedPrs = result.value;
	const prLimit = Math.min(relatedPrs.length, MAX_RELATED_PRS);
	const truncated = relatedPrs.length > MAX_RELATED_PRS;

	if (prLimit === 0) {
		return;
	}

	writer.appendLine(`### Related Pull Requests (${prLimit}${truncated ? ` of ${relatedPrs.length}` : ''})`);
	writer.appendLine();

	for (let i = 0; i < prLimit; i++) {
		const pr = relatedPrs[i];
		writer.appendLine(`- #${pr.number} ${pr.title} (${pr.state}) by ${pr.author.login}`);
		writer.appendLine(`  Source: ${pr.source.ref} -> Target: ${pr.target.ref}`);
		if (pr.url) {
			writer.appendLine(`  URL: ${pr.url}`);
		}
		writer.appendLine();
	}

	if (truncated) {
		writer.appendLine(`[truncated: ${relatedPrs.length - MAX_RELATED_PRS} more pull requests not shown]`);
		writer.appendLine();
	}
}

function appendWorkspace(
	writer: BudgetedContextWriter,
	result: Result<GitRepository | undefined>,
): void {
	if (!result.ok || !result.value) {
		return;
	}

	const currentBranch = result.value.state.HEAD?.name;
	if (!currentBranch) {
		return;
	}

	writer.appendLine('### Workspace');
	writer.appendLine(`Current branch: \`${currentBranch}\``);
	writer.appendLine(`Repository path: ${result.value.rootUri.fsPath}`);
	writer.appendLine();
}

async function toResult<T>(promise: Promise<T>): Promise<Result<T>> {
	try {
		return { ok: true, value: await promise };
	} catch (error) {
		return { ok: false, error };
	}
}

function indent(value: string, prefix: string = '  '): string {
	return value.split(/\r?\n/).map((line) => `${prefix}${line}`).join('\n');
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
