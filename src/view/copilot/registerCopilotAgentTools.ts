import * as vscode from 'vscode';
import { CopilotIssueContextBuilder } from './copilotIssueContextBuilder';
import { CopilotIssueContextStore, SelectedCopilotIssue } from './copilotIssueContextStore';
import { CopilotPullRequestContextBuilder } from './copilotPullRequestContextBuilder';
import { CopilotPullRequestContextStore, SelectedCopilotPullRequest } from './copilotPullRequestContextStore';
import { DEFAULT_COPILOT_PROMPT_BUDGET } from './copilotPromptBudget';
import { PullRequestService } from '../../gitcode/services/pullRequestService';
import { IssueService } from '../../gitcode/services/issueService';
import { CommentService } from '../../gitcode/services/commentService';
import { GitCodeRepositoryResolver } from '../../gitcode/resolver/gitcodeRepositoryResolver';
import { GitCodeRepository, PullRequestFileChange } from '../../common/models';

const AGENT_TOOL_NAME = {
	searchIssues: 'gitcode_search_issues',
	searchPullRequests: 'gitcode_search_pull_requests',
	getIssueContext: 'gitcode_get_issue_context',
	getPullRequestContext: 'gitcode_get_pull_request_context',
	listPullRequestFiles: 'gitcode_list_pull_request_files',
	getPullRequestFilePatch: 'gitcode_get_pull_request_file_patch',
	getPullRequestComments: 'gitcode_get_pull_request_comments',
	getSelectedIssue: 'gitcode_get_selected_issue',
	getSelectedPullRequest: 'gitcode_get_selected_pull_request',
} as const;

const SEARCH_SCAN_PAGE_SIZE = 50;
const MAX_SEARCH_SCAN_PAGES = 50;

// ---- Input types ----

interface SearchIssuesInput {
	repository?: string;
	query?: string;
	state?: 'open' | 'closed' | 'all';
	page?: number;
	page_size?: number;
}

interface SearchPullRequestsInput {
	repository?: string;
	query?: string;
	state?: 'open' | 'closed' | 'merged' | 'all';
	page?: number;
	page_size?: number;
}

interface GetIssueContextInput {
	repository?: string;
	issue_number?: number;
	comment_limit?: number;
}

interface GetPullRequestContextInput {
	repository?: string;
	pull_request_number?: number;
	include_patch_summary?: boolean;
	comment_limit?: number;
	file_limit?: number;
}

interface ListPullRequestFilesInput {
	repository?: string;
	pull_request_number?: number;
	path_filter?: string;
	status_filter?: 'added' | 'modified' | 'deleted' | 'renamed' | 'all';
	page?: number;
	page_size?: number;
}

interface GetPullRequestFilePatchInput {
	repository?: string;
	pull_request_number?: number;
	file_paths: string[];
	max_patch_lines_per_file?: number;
}

interface GetPullRequestCommentsInput {
	repository?: string;
	pull_request_number?: number;
	unresolved_only?: boolean;
	path_filter?: string;
	page?: number;
	page_size?: number;
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
	issueService: IssueService,
	commentService: CommentService,
	repositoryResolver: GitCodeRepositoryResolver,
): ReadonlyArray<RegisteredTool<object>> {
	return [
		{ name: AGENT_TOOL_NAME.searchIssues, tool: createSearchIssuesTool(issueService, repositoryResolver) },
		{ name: AGENT_TOOL_NAME.searchPullRequests, tool: createSearchPullRequestsTool(pullRequestService, repositoryResolver) },
		{ name: AGENT_TOOL_NAME.getIssueContext, tool: createGetIssueContextTool(issueStore, issueContextBuilder, repositoryResolver) },
		{ name: AGENT_TOOL_NAME.getPullRequestContext, tool: createGetPullRequestContextTool(prStore, prContextBuilder, repositoryResolver) },
		{ name: AGENT_TOOL_NAME.listPullRequestFiles, tool: createListPullRequestFilesTool(prStore, pullRequestService, repositoryResolver) },
		{ name: AGENT_TOOL_NAME.getPullRequestFilePatch, tool: createGetPullRequestFilePatchTool(prStore, pullRequestService, repositoryResolver) },
		{ name: AGENT_TOOL_NAME.getPullRequestComments, tool: createGetPullRequestCommentsTool(prStore, commentService, repositoryResolver) },
		{ name: AGENT_TOOL_NAME.getSelectedIssue, tool: createGetSelectedIssueTool(issueStore) },
		{ name: AGENT_TOOL_NAME.getSelectedPullRequest, tool: createGetSelectedPullRequestTool(prStore) },
	];
}

export function registerCopilotAgentTools(
	issueStore: CopilotIssueContextStore,
	prStore: CopilotPullRequestContextStore,
	issueContextBuilder: CopilotIssueContextBuilder,
	prContextBuilder: CopilotPullRequestContextBuilder,
	pullRequestService: PullRequestService,
	issueService: IssueService,
	commentService: CommentService,
	repositoryResolver: GitCodeRepositoryResolver,
): vscode.Disposable {
	const registrations = createCopilotAgentTools(
		issueStore,
		prStore,
		issueContextBuilder,
		prContextBuilder,
		pullRequestService,
		issueService,
		commentService,
		repositoryResolver,
	).map(({ name, tool }) => vscode.lm.registerTool(name, tool));

	// Legacy alias for gitcode_get_pull_request_files
	const legacyTool = createLegacyFilesAliasTool(prStore, pullRequestService, repositoryResolver);
	registrations.push(vscode.lm.registerTool('gitcode_get_pull_request_files', legacyTool));

	return vscode.Disposable.from(...registrations);
}

// ---- Shared context resolution ----

async function resolveRepository(
	explicitRepo: string | undefined,
	resolver: GitCodeRepositoryResolver,
): Promise<GitCodeRepository> {
	if (explicitRepo) {
		return parseRepository(explicitRepo);
	}
	return resolver.resolve();
}

function parseRepository(fullName: string): GitCodeRepository {
	const [owner, name, ...rest] = fullName.split('/');
	if (!owner || !name || rest.length > 0) {
		throw new Error(`Invalid repository format "${fullName}". Use "owner/repo".`);
	}
	return {
		remoteName: 'explicit',
		owner,
		name,
		fullName,
		webUrl: '',
	};
}

async function resolveIssueIdentity(
	input: GetIssueContextInput,
	issueStore: CopilotIssueContextStore,
	resolver: GitCodeRepositoryResolver,
): Promise<{ repository: GitCodeRepository; issueNumber: number }> {
	const explicitRepo = input.repository?.trim() || undefined;
	const explicitNumber = input.issue_number;

	if (explicitRepo && explicitNumber !== undefined) {
		return { repository: parseRepository(explicitRepo), issueNumber: explicitNumber };
	}
	if (explicitRepo) {
		throw new Error('Repository was provided but issue_number is missing. Provide both repository and issue_number, or select an issue and omit both.');
	}
	if (explicitNumber !== undefined) {
		const repository = await resolver.resolve();
		return { repository, issueNumber: explicitNumber };
	}

	const selected = issueStore.getSelected();
	if (selected) {
		return { repository: selected.repository, issueNumber: selected.issueNumber };
	}
	throw new Error('No GitCode issue could be resolved. Provide repository and issue_number, or select a GitCode issue first.');
}

async function resolvePullRequestIdentity(
	input: { repository?: string; pull_request_number?: number },
	prStore: CopilotPullRequestContextStore,
	resolver: GitCodeRepositoryResolver,
): Promise<{ repository: GitCodeRepository; pullRequestNumber: number }> {
	const explicitRepo = input.repository?.trim() || undefined;
	const explicitNumber = input.pull_request_number;

	if (explicitRepo && explicitNumber !== undefined) {
		return { repository: parseRepository(explicitRepo), pullRequestNumber: explicitNumber };
	}
	if (explicitRepo) {
		throw new Error('Repository was provided but pull_request_number is missing. Provide both repository and pull_request_number, or select a pull request and omit both.');
	}
	if (explicitNumber !== undefined) {
		const repository = await resolver.resolve();
		return { repository, pullRequestNumber: explicitNumber };
	}

	const selected = prStore.getSelected();
	if (selected) {
		return { repository: selected.repository, pullRequestNumber: selected.pullRequestNumber };
	}
	throw new Error('No GitCode pull request could be resolved. Provide repository and pull_request_number, or select a GitCode pull request first.');
}

// ---- Search Issues Tool ----

function createSearchIssuesTool(
	issueService: IssueService,
	resolver: GitCodeRepositoryResolver,
): vscode.LanguageModelTool<SearchIssuesInput> {
	return {
		prepareInvocation(options) {
			const query = options.input.query?.trim();
			const desc = query ? ` matching "${query}"` : '';
			return prepareReadInvocation(
				`Searching GitCode issues${desc}`,
				'Search GitCode issues?',
				`This searches GitCode issues${desc}. It returns compact identity rows and does not edit issues or files.`,
			);
		},
		async invoke(options) {
			const state = options.input.state ?? 'open';
			const page = clampPage(options.input.page ?? 1);
			const pageSize = clamp(options.input.page_size ?? 20, 1, 50);

			const repository = await resolveRepository(options.input.repository?.trim() || undefined, resolver);
			const query = options.input.query?.trim().toLowerCase();
			const pageResult = query
				? await collectFilteredSearchPage(
					page,
					pageSize,
					(scanPage) => issueService.listIssues(repository, {
						state,
						page: scanPage,
						perPage: SEARCH_SCAN_PAGE_SIZE,
					}),
					(issue) =>
						issue.title.toLowerCase().includes(query) ||
						issue.author.login.toLowerCase().includes(query) ||
						issue.labels.some((label) => label.name.toLowerCase().includes(query)),
				)
				: toDirectSearchPage(await issueService.listIssues(repository, {
					state,
					page,
					perPage: pageSize,
				}), pageSize);

			const lines: string[] = [];
			lines.push(`Repository: ${repository.fullName}`);
			lines.push(`State: ${state} | Returned: ${pageResult.items.length} issue(s)`);
			if (query) {
				lines.push(`Query: "${query}"`);
			}
			lines.push('');

			for (const issue of pageResult.items) {
				const labels = issue.labels.length > 0
					? issue.labels.map((l) => l.name).join(', ')
					: '';
				lines.push(`- #${issue.number} ${issue.title}`);
				lines.push(`  State: ${issue.state} | Author: ${issue.author.login} | Updated: ${issue.updatedAt}`);
				if (labels) {
					lines.push(`  Labels: ${labels}`);
				}
				if (issue.url) {
					lines.push(`  URL: ${issue.url}`);
				}
				lines.push('');
			}

			if (pageResult.items.length === 0) {
				lines.push('No issues matched the search criteria.');
			}
			appendSearchPagingHint(lines, pageResult, page);

			return textResult(lines.join('\n'));
		},
	};
}

// ---- Search Pull Requests Tool ----

function createSearchPullRequestsTool(
	pullRequestService: PullRequestService,
	resolver: GitCodeRepositoryResolver,
): vscode.LanguageModelTool<SearchPullRequestsInput> {
	return {
		prepareInvocation(options) {
			const query = options.input.query?.trim();
			const desc = query ? ` matching "${query}"` : '';
			return prepareReadInvocation(
				`Searching GitCode pull requests${desc}`,
				'Search GitCode pull requests?',
				`This searches GitCode pull requests${desc}. It returns compact identity rows and does not edit pull requests or files.`,
			);
		},
		async invoke(options) {
			const state = options.input.state ?? 'open';
			const page = clampPage(options.input.page ?? 1);
			const pageSize = clamp(options.input.page_size ?? 20, 1, 50);

			const repository = await resolveRepository(options.input.repository?.trim() || undefined, resolver);
			const query = options.input.query?.trim().toLowerCase();
			const shouldScan = Boolean(query) || state === 'merged';
			const pageResult = shouldScan
				? await collectFilteredSearchPage(
					page,
					pageSize,
					(scanPage) => pullRequestService.listPullRequests(repository, {
						state: state === 'merged' ? 'all' : state,
						page: scanPage,
						perPage: SEARCH_SCAN_PAGE_SIZE,
					}),
					(pr) => (!query ||
						pr.title.toLowerCase().includes(query) ||
						pr.author.toLowerCase().includes(query) ||
						Boolean(pr.sourceBranch && pr.sourceBranch.toLowerCase().includes(query)) ||
						Boolean(pr.targetBranch && pr.targetBranch.toLowerCase().includes(query))) &&
						(state !== 'merged' || pr.state === 'merged'),
				)
				: toDirectSearchPage(await pullRequestService.listPullRequests(repository, {
					state,
					page,
					perPage: pageSize,
				}), pageSize);

			const lines: string[] = [];
			lines.push(`Repository: ${repository.fullName}`);
			lines.push(`State: ${state} | Returned: ${pageResult.items.length} pull request(s)`);
			if (query) {
				lines.push(`Query: "${query}"`);
			}
			lines.push('');

			for (const pr of pageResult.items) {
				lines.push(`- #${pr.number} ${pr.title}`);
				const sourceBranch = pr.sourceBranch ? pr.sourceBranch : '';
				const targetBranch = pr.targetBranch ? pr.targetBranch : '';
				lines.push(`  State: ${pr.state} | ${sourceBranch} -> ${targetBranch} | Author: ${pr.author} | Updated: ${pr.updatedAt}`);
				if (pr.url) {
					lines.push(`  URL: ${pr.url}`);
				}
				lines.push('');
			}

			if (pageResult.items.length === 0) {
				lines.push('No pull requests matched the search criteria.');
			}
			appendSearchPagingHint(lines, pageResult, page);

			return textResult(lines.join('\n'));
		},
	};
}

// ---- Selected Issue Tool ----

function createGetSelectedIssueTool(
	issueStore: CopilotIssueContextStore,
): vscode.LanguageModelTool<object> {
	return {
		prepareInvocation() {
			return prepareReadInvocation(
				'Loading the selected GitCode issue identity',
				'Read selected GitCode issue identity?',
				'This reads the selected GitCode issue number, title, URL, and repository metadata from the extension context. It does not edit files or make GitCode changes.',
			);
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
			return prepareReadInvocation(
				'Loading the selected GitCode pull request identity',
				'Read selected GitCode pull request identity?',
				'This reads the selected GitCode pull request number, title, URL, and repository metadata from the extension context. It does not edit files or make GitCode changes.',
			);
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
	resolver: GitCodeRepositoryResolver,
): vscode.LanguageModelTool<GetIssueContextInput> {
	return {
		prepareInvocation() {
			return prepareReadInvocation(
				'Loading GitCode issue context',
				'Read GitCode issue context?',
				'This reads authenticated GitCode issue details, comments, related pull requests, and repository metadata. It does not edit files or make GitCode changes.',
			);
		},
		async invoke(options, token) {
			const { repository, issueNumber } = await resolveIssueIdentity(options.input, issueStore, resolver);
			const commentLimit = clamp(options.input.comment_limit ?? 20, 1, 50);

			const selected: SelectedCopilotIssue = {
				repository,
				issueNumber,
				title: '',
				url: `${repository.webUrl}/issues/${issueNumber}`,
			};

			const contextText = await contextBuilder.build(selected, token, DEFAULT_COPILOT_PROMPT_BUDGET, commentLimit);
			const output = [
				`Repository: ${repository.fullName}`,
				`Issue: #${issueNumber}`,
				'',
				'Issue context:',
				contextText,
			].join('\n');

			return textResult(output);
		},
	};
}

// ---- Pull Request Context Tool ----

function createGetPullRequestContextTool(
	prStore: CopilotPullRequestContextStore,
	contextBuilder: CopilotPullRequestContextBuilder,
	resolver: GitCodeRepositoryResolver,
): vscode.LanguageModelTool<GetPullRequestContextInput> {
	return {
		prepareInvocation(options) {
			const patches = options.input.include_patch_summary ? ' with patch summary' : '';
			return prepareReadInvocation(
				`Loading GitCode pull request context${patches}`,
				'Read GitCode pull request context?',
				`This reads authenticated GitCode pull request details, file summary, review summary, related issues, merge state, and repository metadata${patches}. It does not include full patches by default. It does not edit files or make GitCode changes.`,
			);
		},
		async invoke(options, token) {
			const { repository, pullRequestNumber } = await resolvePullRequestIdentity(options.input, prStore, resolver);
			const includePatchSummary = options.input.include_patch_summary ?? false;
			const fileLimit = clamp(options.input.file_limit ?? 50, 1, 100);
			const commentLimit = clamp(options.input.comment_limit ?? 20, 1, 50);

			const selected: SelectedCopilotPullRequest = {
				repository,
				pullRequestNumber,
				title: '',
				url: `${repository.webUrl}/pulls/${pullRequestNumber}`,
			};

			const contextText = await contextBuilder.build(
				selected,
				token,
				DEFAULT_COPILOT_PROMPT_BUDGET,
				includePatchSummary,
				fileLimit,
				commentLimit,
			);

			const output = [
				`Repository: ${repository.fullName}`,
				`Pull request: #${pullRequestNumber}`,
				'',
				'Pull request context:',
				contextText,
			].join('\n');

			return textResult(output);
		},
	};
}

// ---- List Pull Request Files Tool ----

function createListPullRequestFilesTool(
	prStore: CopilotPullRequestContextStore,
	pullRequestService: PullRequestService,
	resolver: GitCodeRepositoryResolver,
): vscode.LanguageModelTool<ListPullRequestFilesInput> {
	return {
		prepareInvocation(options) {
			const pathFilterInput = options.input.path_filter?.trim();
			const filter = pathFilterInput ? ` (filter: ${pathFilterInput})` : '';
			return prepareReadInvocation(
				`Listing pull request changed files${filter}`,
				'List GitCode pull request files?',
				`This lists changed-file summaries without patches for the GitCode pull request${filter}. It does not open or edit workspace files.`,
			);
		},
		async invoke(options, token) {
			const { repository, pullRequestNumber } = await resolvePullRequestIdentity(options.input, prStore, resolver);
			const page = clampPage(options.input.page ?? 1);
			const pageSize = clamp(options.input.page_size ?? 50, 1, 100);

			const files = await pullRequestService.listPullRequestFiles(repository, pullRequestNumber);

			if (token.isCancellationRequested) { return textResult(''); }

			const pathFilter = options.input.path_filter?.trim().toLowerCase();
			let filtered = pathFilter
				? files.filter((file) => file.path.toLowerCase().includes(pathFilter))
				: files;

			const statusFilter = options.input.status_filter ?? 'all';
			if (statusFilter !== 'all') {
				filtered = filtered.filter((file) => file.status === statusFilter);
			}

			const sorted = prioritizeFiles(filtered);
			const statusCounts = countStatuses(sorted);

			const totalCount = sorted.length;
			const totalPages = Math.ceil(totalCount / pageSize) || 1;
			const startIndex = (page - 1) * pageSize;
			const paged = sorted.slice(startIndex, startIndex + pageSize);

			const lines: string[] = [];
			lines.push(`Repository: ${repository.fullName}`);
			lines.push(`Pull request #${pullRequestNumber}: ${totalCount} changed file(s)`);
			lines.push(`Statuses: modified ${statusCounts.modified}, added ${statusCounts.added}, deleted ${statusCounts.deleted}, renamed ${statusCounts.renamed}`);
			if (pathFilter && files.length > 0) {
				lines.push(`Path filter "${pathFilter}": ${totalCount} of ${files.length} files`);
			}
			if (statusFilter !== 'all') {
				lines.push(`Status filter: ${statusFilter}`);
			}
			lines.push(`Page ${page} of ${totalPages} (${paged.length} files)`);
			lines.push('');

			for (const file of paged) {
				lines.push(`- \`${file.path}\` (${file.status}, +${file.additions} -${file.deletions})`);
				if (file.previousPath) {
					lines.push(`  (renamed from \`${file.previousPath}\`)`);
				}
			}

			if (totalPages > 1 && page < totalPages) {
				lines.push('');
				lines.push(`Use page: ${page + 1} to see the next page.`);
			}
			if (totalPages > 1) {
				lines.push(`[Page ${page} of ${totalPages}]`);
			}

			return textResult(lines.join('\n'));
		},
	};
}

// ---- Legacy alias for gitcode_get_pull_request_files ----

function createLegacyFilesAliasTool(
	prStore: CopilotPullRequestContextStore,
	pullRequestService: PullRequestService,
	resolver: GitCodeRepositoryResolver,
): vscode.LanguageModelTool<Record<string, unknown>> {
	const listTool = createListPullRequestFilesTool(prStore, pullRequestService, resolver);
	return {
		async invoke(_options, token) {
			const input: ListPullRequestFilesInput = {
				page: 1,
				page_size: 100,
			};
			return listTool.invoke(
				{ input, toolInvocationToken: undefined, token } as vscode.LanguageModelToolInvocationOptions<ListPullRequestFilesInput>,
				token,
			);
		},
	};
}

// ---- Get Pull Request File Patch Tool ----

function createGetPullRequestFilePatchTool(
	prStore: CopilotPullRequestContextStore,
	pullRequestService: PullRequestService,
	resolver: GitCodeRepositoryResolver,
): vscode.LanguageModelTool<GetPullRequestFilePatchInput> {
	return {
		prepareInvocation(options) {
			const paths = options.input.file_paths;
			const fileList = paths.length === 1 ? `\`${paths[0]}\`` : `${paths.length} files`;
			return prepareReadInvocation(
				`Loading patch for ${fileList}`,
				'Read GitCode pull request file patch?',
				`This reads bounded patch detail for ${fileList} in the GitCode pull request. It does not edit workspace files.`,
			);
		},
		async invoke(options, token) {
			const { repository, pullRequestNumber } = await resolvePullRequestIdentity(options.input, prStore, resolver);
			const filePaths = options.input.file_paths;
			const maxLines = clamp(options.input.max_patch_lines_per_file ?? 120, 1, 300);

			if (!filePaths || filePaths.length === 0) {
				throw new Error('file_paths is required. Provide at least one exact changed file path.');
			}
			if (filePaths.length > 10) {
				throw new Error(`Too many file paths (${filePaths.length}). Provide no more than 10 exact changed file paths.`);
			}

			const files = await pullRequestService.listPullRequestFiles(repository, pullRequestNumber);

			if (token.isCancellationRequested) { return textResult(''); }

			const pathSet = new Set(filePaths.map((p) => p.trim()));
			const matched = files.filter((file) => pathSet.has(file.path));

			if (matched.length === 0) {
				return textResult(`No matching files found in pull request #${pullRequestNumber} for the provided paths. Check that the paths exactly match changed file paths.`);
			}

			const lines: string[] = [];
			lines.push(`Repository: ${repository.fullName}`);
			lines.push(`Pull request #${pullRequestNumber}: patch for ${matched.length} file(s)`);
			lines.push(`Max ${maxLines} patch lines per file`);
			lines.push('');

			for (const file of matched) {
				lines.push(`### \`${file.path}\` (${file.status}, +${file.additions} -${file.deletions})`);
				if (file.previousPath) {
					lines.push(`(renamed from \`${file.previousPath}\`)`);
				}

				if (file.tooLarge) {
					lines.push(`[Patch omitted: file is too large]`);
				} else if (file.patch) {
					const patchLines = file.patch.split('\n');
					const bounded = patchLines.slice(0, maxLines);
					lines.push('```diff');
					for (const patchLine of bounded) {
						lines.push(patchLine);
					}
					lines.push('```');
					if (patchLines.length > maxLines) {
						lines.push(`[truncated: ${patchLines.length - maxLines} more patch lines not shown]`);
					}
				} else {
					lines.push(`[No patch content available]`);
				}
				lines.push('');
			}

			const matchedPaths = new Set(matched.map((file) => file.path));
			const missing = filePaths.filter((p) => !matchedPaths.has(p.trim()));
			if (missing.length > 0) {
				lines.push(`Note: ${missing.length} path(s) were not found in the changed files:`);
				for (const path of missing) {
					lines.push(`  - \`${path}\``);
				}
			}

			return textResult(lines.join('\n'));
		},
	};
}

// ---- Pull Request Comments Tool ----

function createGetPullRequestCommentsTool(
	prStore: CopilotPullRequestContextStore,
	commentService: CommentService,
	resolver: GitCodeRepositoryResolver,
): vscode.LanguageModelTool<GetPullRequestCommentsInput> {
	return {
		prepareInvocation(options) {
			const unresolved = options.input.unresolved_only ? ' (unresolved only)' : '';
			return prepareReadInvocation(
				`Loading pull request comments${unresolved}`,
				'Read GitCode pull request comments?',
				`This reads timeline comments and diff review discussions for the GitCode pull request${unresolved}. It does not create, resolve, edit, or delete comments.`,
			);
		},
		async invoke(options, token) {
			const { repository, pullRequestNumber } = await resolvePullRequestIdentity(options.input, prStore, resolver);
			const page = clampPage(options.input.page ?? 1);
			const pageSize = clamp(options.input.page_size ?? 30, 1, 50);

			const comments = await commentService.listPullRequestComments(repository, pullRequestNumber);

			if (token.isCancellationRequested) { return textResult(''); }

			const unresolvedOnly = options.input.unresolved_only ?? false;
			let filtered = unresolvedOnly
				? comments.filter((comment) => comment.kind === 'diff' && !comment.resolved)
				: comments;

			const pathFilter = options.input.path_filter?.trim().toLowerCase();
			if (pathFilter) {
				filtered = filtered.filter((comment) => {
					if (comment.kind === 'diff' && comment.location.path) {
						return comment.location.path.toLowerCase().includes(pathFilter);
					}
					return !unresolvedOnly;
				});
			}

			const sorted = [...filtered].sort((a, b) => {
				if (a.kind === 'diff' && b.kind !== 'diff') { return -1; }
				if (a.kind !== 'diff' && b.kind === 'diff') { return 1; }
				if (a.kind === 'diff' && b.kind === 'diff') {
					if (!a.resolved && b.resolved) { return -1; }
					if (a.resolved && !b.resolved) { return 1; }
				}
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			});

			const totalCount = sorted.length;
			const totalPages = Math.ceil(totalCount / pageSize) || 1;
			const startIndex = (page - 1) * pageSize;
			const paged = sorted.slice(startIndex, startIndex + pageSize);

			const lines: string[] = [];
			lines.push(`Repository: ${repository.fullName}`);
			lines.push(`Pull request #${pullRequestNumber}: ${totalCount} comment(s)`);
			if (unresolvedOnly) {
				lines.push('(showing unresolved diff comments only)');
			}
			if (pathFilter) {
				lines.push(`Path filter: "${pathFilter}"`);
			}
			lines.push(`Page ${page} of ${totalPages} (${paged.length} comments)`);
			lines.push('');

			for (const comment of paged) {
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
				if (comment.body.split('\n').length > 10) {
					lines.push(`  [comment body truncated]`);
				}
				for (const reply of comment.replies.slice(0, 5)) {
					lines.push(`  \u21B3 ${reply.author.login}: ${reply.body.split('\n')[0].slice(0, 100)}`);
				}
				if (comment.replies.length > 5) {
					lines.push(`  [${comment.replies.length - 5} more replies not shown]`);
				}
				lines.push('');
			}

			if (totalPages > 1 && page < totalPages) {
				lines.push(`Use page: ${page + 1} to see the next page.`);
			}
			if (totalPages > 1) {
				lines.push(`[Page ${page} of ${totalPages}]`);
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

function prepareReadInvocation(
	invocationMessage: string,
	title: string,
	message: string,
): vscode.PreparedToolInvocation {
	return { invocationMessage, confirmationMessages: { title, message } };
}

function textResult(value: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(value)]);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.trunc(value) || min));
}

function clampPage(value: number): number {
	return Math.max(1, Math.trunc(value) || 1);
}

interface SearchPageResult<T> {
	items: T[];
	hasNextPage: boolean;
	scanLimitReached: boolean;
}

async function collectFilteredSearchPage<T>(
	page: number,
	pageSize: number,
	loadPage: (page: number) => Promise<T[]>,
	matches: (item: T) => boolean,
): Promise<SearchPageResult<T>> {
	const startIndex = (page - 1) * pageSize;
	const endIndex = startIndex + pageSize;
	const matchesFound: T[] = [];
	let scanLimitReached = true;

	for (let scanPage = 1; scanPage <= MAX_SEARCH_SCAN_PAGES; scanPage++) {
		const records = await loadPage(scanPage);
		if (records.length === 0) {
			scanLimitReached = false;
			break;
		}

		for (const record of records) {
			if (matches(record)) {
				matchesFound.push(record);
			}
		}

		if (records.length < SEARCH_SCAN_PAGE_SIZE) {
			scanLimitReached = false;
			break;
		}
	}

	return {
		items: matchesFound.slice(startIndex, endIndex),
		hasNextPage: matchesFound.length > endIndex || (scanLimitReached && matchesFound.length >= endIndex),
		scanLimitReached,
	};
}

function toDirectSearchPage<T>(items: T[], pageSize: number): SearchPageResult<T> {
	return {
		items,
		hasNextPage: items.length === pageSize,
		scanLimitReached: false,
	};
}

function appendSearchPagingHint<T>(lines: string[], pageResult: SearchPageResult<T>, page: number): void {
	if (pageResult.hasNextPage) {
		lines.push('');
		lines.push(`Use page: ${page + 1} to see more matches.`);
	}
	if (pageResult.scanLimitReached) {
		lines.push('');
		lines.push(`Search stopped after scanning ${MAX_SEARCH_SCAN_PAGES} pages.`);
	}
}

function countStatuses(files: readonly PullRequestFileChange[]): { modified: number; added: number; deleted: number; renamed: number } {
	const counts = { modified: 0, added: 0, deleted: 0, renamed: 0 };
	for (const file of files) {
		switch (file.status) {
			case 'modified': counts.modified++; break;
			case 'added': counts.added++; break;
			case 'deleted': counts.deleted++; break;
			case 'renamed': counts.renamed++; break;
		}
	}
	return counts;
}

function prioritizeFiles(files: readonly PullRequestFileChange[]): PullRequestFileChange[] {
	const result = [...files];
	result.sort((a, b) => {
		const aIsSrc = a.path.startsWith('src/') || a.path.startsWith('lib/');
		const bIsSrc = b.path.startsWith('src/') || b.path.startsWith('lib/');
		if (aIsSrc && !bIsSrc) { return -1; }
		if (!aIsSrc && bIsSrc) { return 1; }

		const aIsTest = a.path.includes('.test.') || a.path.includes('.spec.') || a.path.includes('__tests__');
		const bIsTest = b.path.includes('.test.') || b.path.includes('.spec.') || b.path.includes('__tests__');
		if (aIsTest && !bIsTest) { return 1; }
		if (!aIsTest && bIsTest) { return -1; }

		return a.path.localeCompare(b.path);
	});
	return result;
}
