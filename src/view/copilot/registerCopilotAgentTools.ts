import * as vscode from 'vscode';
import { CopilotIssueContextBuilder } from './copilotIssueContextBuilder';
import { CopilotIssueContextStore, SelectedCopilotIssue } from './copilotIssueContextStore';
import { CopilotPullRequestContextBuilder } from './copilotPullRequestContextBuilder';
import { CopilotPullRequestContextStore, SelectedCopilotPullRequest } from './copilotPullRequestContextStore';
import { DEFAULT_COPILOT_PROMPT_BUDGET } from './copilotPromptBudget';
import { PullRequestService } from '../../gitcode/services/pullRequestService';
import { CommentService } from '../../gitcode/services/commentService';

const AGENT_TOOL_NAME = {
	getSelectedIssue: 'gitcode_get_selected_issue',
	getSelectedPullRequest: 'gitcode_get_selected_pull_request',
	getIssueContext: 'gitcode_get_issue_context',
	getPullRequestContext: 'gitcode_get_pull_request_context',
	getPullRequestFiles: 'gitcode_get_pull_request_files',
	getPullRequestComments: 'gitcode_get_pull_request_comments',
} as const;

interface GetPullRequestContextInput {
	includePatches?: boolean;
}

interface GetPullRequestFilesInput {
	includePatches?: boolean;
	pathFilter?: string;
}

interface GetPullRequestCommentsInput {
	unresolvedOnly?: boolean;
}

interface RegisteredTool<TInput> {
	name: string;
	tool: vscode.LanguageModelTool<TInput>;
}

export function createCopilotAgentTools(
	issueStore: CopilotIssueContextStore,
	prStore: CopilotPullRequestContextStore,
	issueContextBuilder: CopilotIssueContextBuilder,
	prContextBuilder: CopilotPullRequestContextBuilder,
	pullRequestService: PullRequestService,
	commentService: CommentService,
): ReadonlyArray<RegisteredTool<object>> {
	return [
		{ name: AGENT_TOOL_NAME.getSelectedIssue, tool: createGetSelectedIssueTool(issueStore) },
		{ name: AGENT_TOOL_NAME.getSelectedPullRequest, tool: createGetSelectedPullRequestTool(prStore) },
		{ name: AGENT_TOOL_NAME.getIssueContext, tool: createGetIssueContextTool(issueStore, issueContextBuilder) },
		{ name: AGENT_TOOL_NAME.getPullRequestContext, tool: createGetPullRequestContextTool(prStore, prContextBuilder) },
		{ name: AGENT_TOOL_NAME.getPullRequestFiles, tool: createGetPullRequestFilesTool(prStore, pullRequestService) },
		{ name: AGENT_TOOL_NAME.getPullRequestComments, tool: createGetPullRequestCommentsTool(prStore, commentService) },
	];
}

export function registerCopilotAgentTools(
	issueStore: CopilotIssueContextStore,
	prStore: CopilotPullRequestContextStore,
	issueContextBuilder: CopilotIssueContextBuilder,
	prContextBuilder: CopilotPullRequestContextBuilder,
	pullRequestService: PullRequestService,
	commentService: CommentService,
): vscode.Disposable {
	const registrations = createCopilotAgentTools(
		issueStore,
		prStore,
		issueContextBuilder,
		prContextBuilder,
		pullRequestService,
		commentService,
	).map(({ name, tool }) => vscode.lm.registerTool(name, tool));
	return vscode.Disposable.from(...registrations);
}

// ---- Selected Issue Tool ----

function createGetSelectedIssueTool(
	issueStore: CopilotIssueContextStore,
): vscode.LanguageModelTool<object> {
	return {
		prepareInvocation() {
			return { invocationMessage: 'Loading the selected GitCode issue identity' };
		},
		invoke() {
			const selected = getSelectedIssue(issueStore);
			return textResult(formatSelectedIssue(selected));
		},
	};
}

// ---- Selected Pull Request Tool ----

function createGetSelectedPullRequestTool(
	prStore: CopilotPullRequestContextStore,
): vscode.LanguageModelTool<object> {
	return {
		prepareInvocation() {
			return { invocationMessage: 'Loading the selected GitCode pull request identity' };
		},
		invoke() {
			const selected = getSelectedPullRequest(prStore);
			return textResult(formatSelectedPullRequest(selected));
		},
	};
}

// ---- Issue Context Tool ----

function createGetIssueContextTool(
	issueStore: CopilotIssueContextStore,
	contextBuilder: CopilotIssueContextBuilder,
): vscode.LanguageModelTool<object> {
	return {
		prepareInvocation() {
			return { invocationMessage: 'Loading the selected GitCode issue context' };
		},
		async invoke(_options, token) {
			const selected = getSelectedIssue(issueStore);
			const contextText = await contextBuilder.build(selected, token, DEFAULT_COPILOT_PROMPT_BUDGET);
			const output = [
				formatSelectedIssue(selected),
				'Issue context:',
				contextText,
			].filter((value) => value && value.trim().length > 0).join('\n\n');

			return textResult(output);
		},
	};
}

// ---- Pull Request Context Tool ----

function createGetPullRequestContextTool(
	prStore: CopilotPullRequestContextStore,
	contextBuilder: CopilotPullRequestContextBuilder,
): vscode.LanguageModelTool<GetPullRequestContextInput> {
	return {
		prepareInvocation(options) {
			const patches = options.input.includePatches ? ' with patches' : '';
			return { invocationMessage: `Loading the selected GitCode pull request context${patches}` };
		},
		async invoke(options, token) {
			const selected = getSelectedPullRequest(prStore);
			const contextText = await contextBuilder.build(selected, token, DEFAULT_COPILOT_PROMPT_BUDGET);
			return textResult(contextText);
		},
	};
}

// ---- Pull Request Files Tool ----

function createGetPullRequestFilesTool(
	prStore: CopilotPullRequestContextStore,
	pullRequestService: PullRequestService,
): vscode.LanguageModelTool<GetPullRequestFilesInput> {
	return {
		prepareInvocation(options) {
			const patches = options.input.includePatches ? ' with patches' : '';
			const filter = options.input.pathFilter ? ` (filter: ${options.input.pathFilter})` : '';
			return { invocationMessage: `Loading pull request changed files${patches}${filter}` };
		},
		async invoke(options, token) {
			const selected = getSelectedPullRequest(prStore);
			const files = await pullRequestService.listPullRequestFiles(
				selected.repository,
				selected.pullRequestNumber,
			);

			if (token.isCancellationRequested) { return textResult(''); }

			const pathFilter = options.input.pathFilter?.toLowerCase();
			let filtered = pathFilter
				? files.filter((file) => file.path.toLowerCase().includes(pathFilter))
				: files;

			const lines: string[] = [];
			lines.push(`Pull request #${selected.pullRequestNumber}: ${files.length} changed file(s)`);
			if (pathFilter && filtered.length < files.length) {
				lines.push(`Filtered by "${pathFilter}": ${filtered.length} of ${files.length} files`);
			}
			lines.push('');

			for (const file of filtered.slice(0, 100)) {
				lines.push(`- \`${file.path}\` (${file.status}, +${file.additions} -${file.deletions})`);
				if (file.previousPath) {
					lines.push(`  (renamed from \`${file.previousPath}\`)`);
				}
				if (options.input.includePatches && file.patch && !file.tooLarge) {
					lines.push('  ```diff');
					for (const patchLine of file.patch.split('\n').slice(0, 50)) {
						lines.push(`  ${patchLine}`);
					}
					lines.push('  ```');
				}
			}

			if (filtered.length > 100) {
				lines.push(`[truncated: ${filtered.length - 100} more files not shown]`);
			}

			return textResult(lines.join('\n'));
		},
	};
}

// ---- Pull Request Comments Tool ----

function createGetPullRequestCommentsTool(
	prStore: CopilotPullRequestContextStore,
	commentService: CommentService,
): vscode.LanguageModelTool<GetPullRequestCommentsInput> {
	return {
		prepareInvocation(options) {
			const unresolved = options.input.unresolvedOnly ? ' (unresolved only)' : '';
			return { invocationMessage: `Loading pull request comments${unresolved}` };
		},
		async invoke(options, token) {
			const selected = getSelectedPullRequest(prStore);
			const comments = await commentService.listPullRequestComments(
				selected.repository,
				selected.pullRequestNumber,
			);

			if (token.isCancellationRequested) { return textResult(''); }

			let filtered = options.input.unresolvedOnly
				? comments.filter((comment) => comment.kind === 'diff' && !comment.resolved)
				: comments;

			// Sort: unresolved diff comments first, then by newest
			const sorted = [...filtered].sort((a, b) => {
				if (a.kind === 'diff' && b.kind !== 'diff') { return -1; }
				if (a.kind !== 'diff' && b.kind === 'diff') { return 1; }
				if (a.kind === 'diff' && b.kind === 'diff') {
					if (!a.resolved && b.resolved) { return -1; }
					if (a.resolved && !b.resolved) { return 1; }
				}
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			});

			const lines: string[] = [];
			lines.push(`Pull request #${selected.pullRequestNumber}: ${sorted.length} comment(s)`);
			if (options.input.unresolvedOnly) {
				lines.push('(showing unresolved diff comments only)');
			}
			lines.push('');

			for (const comment of sorted.slice(0, 50)) {
				if (comment.kind === 'diff') {
					const status = comment.resolved ? 'resolved' : 'unresolved';
					const outdated = comment.isOutdated ? ', outdated' : '';
					lines.push(`- [${status}${outdated}] \`${comment.location.path ?? ''}:${comment.location.startLine}\` by ${comment.author.login} at ${comment.createdAt}`);
				} else {
					lines.push(`- General comment by ${comment.author.login} at ${comment.createdAt}`);
				}
				for (const line of comment.body.split('\n').slice(0, 10)) {
					lines.push(`  ${line}`);
				}
				for (const reply of comment.replies.slice(0, 5)) {
					lines.push(`  ↳ ${reply.author.login}: ${reply.body.split('\n')[0].slice(0, 100)}`);
				}
				lines.push('');
			}

			if (sorted.length > 50) {
				lines.push(`[truncated: ${sorted.length - 50} more comments not shown]`);
			}

			return textResult(lines.join('\n'));
		},
	};
}

// ---- Helpers ----

function getSelectedIssue(store: CopilotIssueContextStore): SelectedCopilotIssue {
	const selected = store.getSelected();
	if (!selected) {
		throw new Error('No GitCode issue is selected. Use GitCode: Use Issue as Copilot Context first.');
	}
	return selected;
}

function getSelectedPullRequest(store: CopilotPullRequestContextStore): SelectedCopilotPullRequest {
	const selected = store.getSelected();
	if (!selected) {
		throw new Error('No GitCode pull request is selected. Use GitCode: Use Pull Request as Copilot Context first.');
	}
	return selected;
}

function formatSelectedIssue(selected: SelectedCopilotIssue): string {
	return [
		'Selected issue:',
		`Repository: ${selected.repository.fullName}`,
		`Issue: #${selected.issueNumber} ${selected.title}`,
		`URL: ${selected.url ?? `${selected.repository.webUrl}/issues/${selected.issueNumber}`}`,
	].join('\n');
}

function formatSelectedPullRequest(selected: SelectedCopilotPullRequest): string {
	return [
		'Selected pull request:',
		`Repository: ${selected.repository.fullName}`,
		`Pull request: #${selected.pullRequestNumber} ${selected.title}`,
		`URL: ${selected.url ?? `${selected.repository.webUrl}/pulls/${selected.pullRequestNumber}`}`,
	].join('\n');
}

function textResult(value: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(value),
	]);
}
