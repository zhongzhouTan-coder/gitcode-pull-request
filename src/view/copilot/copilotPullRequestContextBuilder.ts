import * as vscode from 'vscode';
import { PullRequestService } from '../../gitcode/services/pullRequestService';
import { CommentService } from '../../gitcode/services/commentService';
import { SelectedCopilotPullRequest } from './copilotPullRequestContextStore';
import {
	PullRequestComment,
	PullRequestDiffComment,
	PullRequestFileChange,
	PullRequestGeneralComment,
} from '../../common/models';
import { BudgetedContextWriter } from './budgetedContextWriter';
import { CopilotPromptBudget, DEFAULT_COPILOT_PROMPT_BUDGET } from './copilotPromptBudget';

const MAX_DIFF_COMMENTS = 50;
const MAX_GENERAL_COMMENTS = 20;
const MAX_FILES = 100;

type Result<T> =
	| { ok: true; value: T }
	| { ok: false; error: unknown };

export class CopilotPullRequestContextBuilder {
	constructor(
		private readonly pullRequestService: PullRequestService,
		private readonly commentService: CommentService,
	) {}

	async build(
		selected: SelectedCopilotPullRequest,
		token: vscode.CancellationToken,
		budget: CopilotPromptBudget = DEFAULT_COPILOT_PROMPT_BUDGET,
	): Promise<string> {
		const { repository, pullRequestNumber } = selected;
		const writer = new BudgetedContextWriter(budget.maxContextChars);

		const [detailResult, filesResult, commentsResult] = await Promise.all([
			toResult(this.pullRequestService.getPullRequest(repository, pullRequestNumber)),
			toResult(this.pullRequestService.listPullRequestFiles(repository, pullRequestNumber)),
			toResult(this.commentService.listPullRequestComments(repository, pullRequestNumber)),
		]);

		if (token.isCancellationRequested) {
			return '';
		}

		if (!detailResult.ok) {
			throw new Error(
				`Unable to load pull request #${pullRequestNumber} from ${repository.fullName}: ${errorMessage(detailResult.error)}`,
			);
		}
		if (!filesResult.ok) {
			throw new Error(
				`Unable to load changed files for pull request #${pullRequestNumber} from ${repository.fullName}: ${errorMessage(filesResult.error)}`,
			);
		}

		const detail = detailResult.value;
		const files = filesResult.value;

		writer.appendLine(`## Pull Request #${detail.number}: ${detail.title}`);
		writer.appendLine(`Repository: ${repository.fullName}`);
		writer.appendLine(`State: ${detail.state}${detail.isDraft ? ' (draft)' : ''}`);
		writer.appendLine(`Author: ${detail.author.login}`);
		writer.appendLine(`Source: ${detail.source.label} -> Target: ${detail.target.label}`);
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

		appendFileManifest(writer, files);

		if (commentsResult.ok) {
			appendComments(writer, commentsResult.value, budget);
		} else {
			writer.appendLine('### Pull Request Comments');
			writer.appendLine(`_Unable to load comments: ${errorMessage(commentsResult.error)}_`);
			writer.appendLine();
		}

		appendPatchExcerpts(writer, files, budget);

		return writer.toString();
	}
}

function appendFileManifest(writer: BudgetedContextWriter, files: readonly PullRequestFileChange[]): void {
	const fileLimit = Math.min(files.length, MAX_FILES);
	const truncated = files.length > MAX_FILES;
	writer.appendLine(`### Changed Files (${fileLimit}${truncated ? ` of ${files.length}` : ''})`);
	writer.appendLine();

	for (let i = 0; i < fileLimit; i++) {
		const file = files[i];
		writer.appendLine(`- \`${file.path}\` (${fileStatusLabel(file)}, +${file.additions} -${file.deletions})`);
	}

	if (truncated) {
		writer.appendLine(`[truncated: ${files.length - MAX_FILES} more files not shown]`);
	}
	writer.appendLine();
}

function appendComments(
	writer: BudgetedContextWriter,
	comments: readonly PullRequestComment[],
	budget: CopilotPromptBudget,
): void {
	const diffComments = comments
		.filter((comment): comment is PullRequestDiffComment => comment.kind === 'diff')
		.sort(compareDiffComments)
		.slice(0, MAX_DIFF_COMMENTS);
	const generalComments = comments
		.filter((comment): comment is PullRequestGeneralComment => comment.kind === 'pullRequest')
		.sort(compareNewestFirst)
		.slice(0, MAX_GENERAL_COMMENTS);

	if (diffComments.length > 0) {
		writer.appendLine(`### Diff Review Comments (${diffComments.length})`);
		writer.appendLine();
		for (const comment of diffComments) {
			appendDiffComment(writer, comment, budget);
		}
		const totalDiffComments = comments.filter((comment) => comment.kind === 'diff').length;
		if (totalDiffComments > diffComments.length) {
			writer.appendLine(`[limited to ${diffComments.length} prioritized diff comments]`);
			writer.appendLine();
		}
	}

	if (generalComments.length > 0 && writer.remaining() > 0) {
		writer.appendLine(`### General Pull Request Comments (${generalComments.length})`);
		writer.appendLine();
		for (const comment of generalComments) {
			appendGeneralComment(writer, comment, budget);
		}
		const totalGeneralComments = comments.filter((comment) => comment.kind === 'pullRequest').length;
		if (totalGeneralComments > generalComments.length) {
			writer.appendLine(`[limited to ${generalComments.length} newest general pull request comments]`);
			writer.appendLine();
		}
	}
}

function appendDiffComment(
	writer: BudgetedContextWriter,
	comment: PullRequestDiffComment,
	budget: CopilotPromptBudget,
): void {
	const status = comment.resolved ? 'resolved' : 'unresolved';
	const outdated = comment.isOutdated ? ', outdated' : '';
	writer.appendLine(`- [${status}${outdated}] ${formatDiffLocation(comment)} by ${comment.author.login} at ${comment.createdAt}`);
	writer.appendTruncated(indent(comment.body), budget.maxDiffCommentChars);
	writer.appendLine();
	appendReplies(writer, comment, budget);
	writer.appendLine();
}

function appendGeneralComment(
	writer: BudgetedContextWriter,
	comment: PullRequestGeneralComment,
	budget: CopilotPromptBudget,
): void {
	writer.appendLine(`- ${comment.author.login} at ${comment.createdAt}`);
	writer.appendTruncated(indent(comment.body), budget.maxPullRequestCommentChars);
	writer.appendLine();
	appendReplies(writer, comment, budget);
	writer.appendLine();
}

function appendReplies(
	writer: BudgetedContextWriter,
	comment: PullRequestComment,
	budget: CopilotPromptBudget,
): void {
	for (const reply of comment.replies) {
		writer.appendLine(`  Reply by ${reply.author.login} at ${reply.createdAt}:`);
		writer.appendTruncated(indent(reply.body, '    '), budget.maxReplyChars);
		writer.appendLine();
	}
}

function appendPatchExcerpts(
	writer: BudgetedContextWriter,
	files: readonly PullRequestFileChange[],
	budget: CopilotPromptBudget,
): void {
	const patchFiles = prioritizePatchFiles(files)
		.filter((file) => file.patch && !file.tooLarge)
		.slice(0, MAX_FILES);

	if (patchFiles.length === 0 || writer.remaining() <= 0) {
		return;
	}

	writer.appendLine('### Patch Excerpts');
	writer.appendLine();

	let shown = 0;
	for (const file of patchFiles) {
		if (!file.patch || writer.remaining() < 200) {
			break;
		}

		writer.appendLine(`#### ${file.path}`);
		writer.appendLine('```diff');
		writer.appendTruncated(file.patch, Math.min(budget.maxPatchChars, writer.remaining()));
		writer.appendLine();
		writer.appendLine('```');
		writer.appendLine();
		shown += 1;
	}

	if (shown < patchFiles.length && writer.remaining() > 0) {
		writer.appendLine(`[truncated: ${patchFiles.length - shown} patch excerpts not shown]`);
		writer.appendLine();
	}
}

function prioritizePatchFiles(files: readonly PullRequestFileChange[]): PullRequestFileChange[] {
	return [...files].sort((a, b) => patchPriority(a) - patchPriority(b));
}

function patchPriority(file: PullRequestFileChange): number {
	if (file.status === 'deleted' || file.status === 'renamed') {
		return 0;
	}
	if (/\.(test|spec)\.[tj]sx?$/.test(file.path) || /(^|\/)(test|tests|__tests__)\//.test(file.path)) {
		return 1;
	}
	if (/\.(ts|tsx|js|jsx|py|go|java|kt|rs|cpp|c|h|cs|rb|php)$/.test(file.path)) {
		return 2;
	}
	if (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file.path)) {
		return 9;
	}
	return 5;
}

function compareDiffComments(a: PullRequestDiffComment, b: PullRequestDiffComment): number {
	const priority = diffCommentPriority(a) - diffCommentPriority(b);
	if (priority !== 0) {
		return priority;
	}
	return compareNewestFirst(a, b);
}

function diffCommentPriority(comment: PullRequestDiffComment): number {
	if (!comment.resolved && !comment.isOutdated) {
		return 0;
	}
	if (!comment.resolved && comment.isOutdated) {
		return 1;
	}
	if (comment.resolved && !comment.isOutdated) {
		return 2;
	}
	return 3;
}

function compareNewestFirst(a: PullRequestComment, b: PullRequestComment): number {
	return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function formatDiffLocation(comment: PullRequestDiffComment): string {
	const path = comment.location.path ?? comment.location.previousPath;
	const start = comment.location.startLine;
	const end = comment.location.endLine;
	if (!path || start <= 0 || end <= 0) {
		return 'unknown location';
	}
	return start === end ? `${path} line ${start}` : `${path} lines ${start}-${end}`;
}

function indent(value: string, prefix: string = '  '): string {
	return value.split(/\r?\n/).map((line) => `${prefix}${line}`).join('\n');
}

function fileStatusLabel(file: PullRequestFileChange): string {
	switch (file.status) {
		case 'added': return 'added';
		case 'modified': return 'modified';
		case 'deleted': return 'deleted';
		case 'renamed': return file.previousPath ? `renamed from ${file.previousPath}` : 'renamed';
		default: return file.status;
	}
}

async function toResult<T>(promise: Promise<T>): Promise<Result<T>> {
	try {
		return { ok: true, value: await promise };
	} catch (error) {
		return { ok: false, error };
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
