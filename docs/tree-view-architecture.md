# Tree View Architecture for `gitcode-pull-request`

## Goal

The tree view layer provides repository-scoped navigation for GitCode pull requests and issues. It follows the useful separation from `vscode-pull-request-github`:

```text
store/model layer
  -> VS Code tree provider layer
    -> node presentation layer
```

The implementation is GitCode-specific and intentionally smaller than the GitHub extension. Stores own remote state and caching, providers adapt that state to VS Code, and nodes own UI labels, icons, commands, and lazy child loading.

## Design Principles

### One source of truth per tree

Pull request list state lives in `PullRequestTreeStore`. Issue list state lives in `IssueTreeStore`. These stores own repository resolution, category filters, list caches, startup repository readiness, and refresh events.

### Thin providers

`PullRequestTreeDataProvider` and `IssueTreeDataProvider` implement `vscode.TreeDataProvider<BaseNode>`, subscribe to store changes, load root nodes, translate known failures into empty states, and delegate child loading to node objects.

### Node classes own UI semantics

Each node type owns:

- stable `id`
- label and description
- tooltip
- icon
- context value for menus
- command arguments
- child-loading behavior

### Service isolation

Tree code never calls HTTP directly. Stores call GitCode services, and services use `GitCodeClientImpl`.

### Lazy loading

Repository and category nodes load first. Pull request and issue lists load when categories expand. Pull request files load only when the `Files` node expands.

## Current Structure

```text
src/view/
  state/
    pullRequestTreeStore.ts
    issueTreeStore.ts
  tree/
    pullRequestTreeDataProvider.ts
    issueTreeDataProvider.ts
    nodeFactory.ts
    nodes/
      baseNode.ts
      emptyStateNode.ts
      repositoryNode.ts
      pullRequestCategoryNode.ts
      pullRequestNode.ts
      pullRequestFilesNode.ts
      pullRequestFileNode.ts
      directoryNode.ts
      issueRepositoryNode.ts
      issueCategoryNode.ts
      issueNode.ts
```

`NodeFactory` currently constructs pull request root and empty-state nodes. Issue tree nodes are built directly by `IssueTreeDataProvider` and the issue node classes.

## Pull Request Tree

### Shape

```text
Repository
  All Open
    #123 Pull request title
      Files
        src
          view
            file.ts
        README.md
  Created By Me
    #124 Another pull request
      Files
```

When `gitcode.pullRequests.fileListLayout` is `flat`, the `Files` node renders file paths directly:

```text
Files
  src/view/file.ts
  README.md
```

### Store

`PullRequestTreeStore` owns:

- repository discovery through `GitCodeRepositoryResolver`
- repository startup retry while the VS Code git extension initializes
- pull request categories
- PR list cache keyed by repository, category, and account name
- changed-file cache keyed by repository and PR number
- refresh events for all data, repository data, and PR file data

Implemented categories:

- `allOpen` -> `All Open`
- `createdByMe` -> `Created By Me`

The store applies these default list filters:

```text
state=open
sort=updated
direction=desc
perPage=gitcode.pullRequests.pageSize
```

For `Created By Me`, it also sets `author` to the signed-in account name.

### Provider

`PullRequestTreeDataProvider` owns:

- `onDidChangeTreeData`
- `getTreeItem`
- `getChildren`
- `getParent`
- full refresh delegation to `PullRequestTreeStore.refreshAll()`
- root-level empty states and root-level error states

It does not own API caches or category filtering.

### Nodes

Pull request node responsibilities:

- `RepositoryNode` renders a GitCode repository and creates category nodes.
- `PullRequestCategoryNode` loads PR summaries for one category.
- `PullRequestNode` renders PR number, title, author, branch direction, draft icon, and open command.
- `PullRequestFilesNode` lazily loads changed files and chooses tree or flat layout.
- `DirectoryNode` renders compacted folder paths in tree layout.
- `PullRequestFileNode` renders file status, additions/deletions, tooltip, and file-open commands.
- `EmptyStateNode` renders loading, empty, and error messages.

## Issue Tree

### Shape

```text
Repository
  My Issues
    #12 [Bug] Issue title
  Created Issues
    #13 Issue title
  Recent Issues
    #14 Issue title
```

### Store

`IssueTreeStore` mirrors the pull request store pattern for issues. It owns:

- repository discovery
- repository startup retry
- issue categories
- issue list cache keyed by repository, category, and account name
- full and repository refresh events

Implemented categories:

- `myIssues` -> `My Issues`
- `createdIssues` -> `Created Issues`
- `recentIssues` -> `Recent Issues`

The store applies these default list filters:

```text
state=open
sort=updated
direction=desc
perPage=gitcode.issues.pageSize
```

`My Issues` adds `assignee=<accountName>`. `Created Issues` adds `creator=<accountName>`.

### Provider and Nodes

`IssueTreeDataProvider` follows the same adapter role as the pull request provider.

Issue node responsibilities:

- `IssueRepositoryNode` renders the repository and creates issue category nodes.
- `IssueCategoryNode` loads issue summaries for one category.
- `IssueNode` renders number, issue type, title, author, labels, comment count, tooltip, and open command.
- `EmptyStateNode` renders loading, empty, and error messages.

## Repository Discovery and Startup Readiness

Both tree stores use the same startup approach:

1. If `gitcode.repository` is set, resolve that override immediately.
2. Otherwise, ask `GitCodeRepositoryResolver` to inspect VS Code git repositories and remotes.
3. During startup, retry briefly because the VS Code git extension may not have opened repositories yet.
4. If no repository is available after the initial window, return an empty root and keep waiting for git repository readiness.
5. Fire a full refresh when a repository becomes available or the wait completes.

This avoids showing a permanent "No GitCode remote found" state just because the extension activated before the git extension finished initialization.

## Refresh Flow

```text
VS Code event or command
  -> ViewController / command handler
  -> tree store refresh method
  -> store clears affected cache entries
  -> store emits a refresh target
  -> provider fires onDidChangeTreeData
  -> VS Code asks nodes for children again
```

Common refresh triggers:

- `gitcode.refreshPullRequests`
- `gitcode.refreshIssues`
- `gitcode.refreshPullRequestFiles`
- sign-in or auth session changes
- workspace folder changes
- git repository open/close events
- `gitcode.pullRequests.fileListLayout` changes
- create or edit operations that affect list or detail state

## Error and Empty States

Providers handle root errors. Category and section nodes handle their own child-loading errors.

Known errors are converted to actionable empty-state nodes:

- not signed in -> `Sign in to GitCode`
- authentication failure -> `GitCode authentication failed`
- repository resolution failure -> open or configure a GitCode repository
- API failure -> `Unable to load ...` with HTTP status where useful

Failed list and file promises are removed from caches so subsequent refreshes can retry.

## Context Values and Commands

Tree nodes set context values consumed by `package.json` menus:

- `pullRequest`
- `pullRequestFiles`
- `pullRequestFile:<status>`
- `pullRequestFile:<status>:tooLarge`
- `issue`
- `repository`
- `issueRepository`
- `pullRequestCategory`
- `issueCategory`
- `directory`
- `emptyState`

Important commands:

- `gitcode.openPullRequest`
- `gitcode.openPullRequestOnWeb`
- `gitcode.openPullRequestFile`
- `gitcode.openPullRequestFileOnWeb`
- `gitcode.refreshPullRequestFiles`
- `gitcode.setPullRequestFilesLayoutTree`
- `gitcode.setPullRequestFilesLayoutFlat`
- `gitcode.openIssue`
- `gitcode.openIssueOnWeb`
- `gitcode.copyIssueUrl`
- `gitcode.createBranchForIssue`
- `gitcode.usePullRequestAsCopilotContext`
- `gitcode.useIssueAsCopilotContext`

## Extension Points for Future Work

The current tree architecture can support additional sections without changing the provider/store boundary:

- pull request conversations under `PullRequestNode`
- commits or checks under `PullRequestNode`
- review-request categories
- configurable PR or issue queries
- targeted subtree refresh by node
- decorations and badges

New behavior should preserve the existing direction:

```text
commands/events -> stores -> providers -> nodes -> VS Code
```

Avoid putting API calls, cache invalidation policy, or repository resolution into node classes or tree providers.
