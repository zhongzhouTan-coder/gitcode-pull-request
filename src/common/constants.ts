export const EXTENSION_ID = {
	self: 'gitcode-pull-request',
	git: 'vscode.git',
};

export const COMMAND_ID = {
	signIn: 'gitcode.signIn',
	refreshPullRequests: 'gitcode.refreshPullRequests',
	openPullRequest: 'gitcode.openPullRequest',
	openPullRequestOnWeb: 'gitcode.openPullRequestOnWeb',
	refreshPullRequest: 'gitcode.refreshPullRequest',
	openPullRequestFile: 'gitcode.openPullRequestFile',
	openPullRequestFileOnWeb: 'gitcode.openPullRequestFileOnWeb',
	refreshPullRequestFiles: 'gitcode.refreshPullRequestFiles',
	setPullRequestFilesLayoutTree: 'gitcode.setPullRequestFilesLayoutTree',
	setPullRequestFilesLayoutFlat: 'gitcode.setPullRequestFilesLayoutFlat',
	refreshIssues: 'gitcode.refreshIssues',
	openIssue: 'gitcode.openIssue',
	openIssueOnWeb: 'gitcode.openIssueOnWeb',
	copyIssueUrl: 'gitcode.copyIssueUrl',
};

export const VIEW_CONTAINER_ID = 'gitcode-pull-requests';
export const VIEW_ID_PULL_REQUESTS = 'pr:gitcode';
export const VIEW_ID_ISSUES = 'issues:gitcode';

export const SECRET_STORAGE_KEY = 'gitcode.auth.session';

export const DEFAULT_PAGE_SIZE = 20;

export const PR_DIFF_SCHEME = 'gitcode-pr-diff';

/** Scheme for the virtual read-only filesystem that serves raw PR content. */
export const GITCODE_PR_SCHEME = 'gitcode-pr';

export const CONTEXT_KEY_FILE_LIST_LAYOUT = 'gitcodePullRequestFilesLayout';
