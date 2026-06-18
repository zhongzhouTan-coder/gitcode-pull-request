# New Tree View Architecture for `gitcode-pull-request`

## Goal

Design a new `src/view` architecture for `gitcode-pull-request` using `vscode-pull-request-github` as reference, but without inheriting the current GitCode view structure.

The intent is:

- reuse the good architectural ideas from GitHub's extension
- avoid copying GitHub-only complexity
- define a clean structure for GitCode from scratch

## 1. What to Learn from `vscode-pull-request-github`

The GitHub extension's tree view is strong because it separates three concerns clearly:

1. state and refresh orchestration
2. VS Code tree binding
3. node rendering and lazy child loading

The core upstream pattern is:

```text
data/model layer
  -> tree provider layer
    -> node layer
```

In GitHub's implementation, these are mainly represented by:

- `src/view/prsTreeModel.ts`
- `src/view/prsTreeDataProvider.ts`
- `src/view/treeNodes/*`

That split is the right reference point for GitCode.

## 2. What Not to Copy from GitHub

GitHub's extension also contains complexity that should not be part of the first GitCode design:

- repository manager graphs
- copilot and notification state
- advanced review-mode checkout coupling
- query pagination and load-more behavior
- comment controller plumbing tied to active PR checkout
- multiple specialized tree providers for different review flows

Those solve GitHub extension-specific scale problems. They are not the right default for a clean GitCode architecture.

## 3. Design Principles for a New GitCode View Layer

The new GitCode structure should follow these rules:

### 3.1 One source of truth for tree state

Caching, refresh policy, expansion-aware loading, and API-backed state should live in one model layer.

### 3.2 Thin provider

The `TreeDataProvider` should mostly translate model output into VS Code tree behavior.

### 3.3 Node classes for UI semantics

Each tree node type should own:

- label
- icon
- tooltip
- context value
- child-loading behavior

### 3.4 Service isolation

The view layer should never call HTTP directly.

All GitCode API interaction should stay behind `gitcode/services/*`.

### 3.5 Lazy loading by depth

Load top-level PR lists first. Load files, comments, commits, and review metadata only when a PR subtree is expanded.

## 4. Recommended New `src/view` Structure

Recommended structure:

```text
src/view/
  index.ts
  viewController.ts
  commands/
    registerTreeCommands.ts
    registerReviewCommands.ts
  state/
    pullRequestTreeStore.ts
    pullRequestDetailsStore.ts
    viewState.ts
  tree/
    pullRequestTreeDataProvider.ts
    nodeFactory.ts
    nodes/
      baseNode.ts
      emptyStateNode.ts
      repositoryNode.ts
      inboxCategoryNode.ts
      authoredCategoryNode.ts
      allOpenCategoryNode.ts
      pullRequestNode.ts
      prSummaryNode.ts
      filesSectionNode.ts
      fileChangeNode.ts
      commitsSectionNode.ts
      commitNode.ts
      conversationSectionNode.ts
      commentThreadNode.ts
      commentNode.ts
  review/
    diffController.ts
    commentController.ts
  overview/
    prOverviewPanel.ts
    prOverviewSerializer.ts
  decorators/
    prStatusDecorationProvider.ts
```

This structure is intentionally larger than a single tree provider, but much smaller than the GitHub extension.

## 5. Responsibilities by Module

### 5.1 `viewController.ts`

This should be the composition root for the whole view layer.

Responsibilities:

- create stores
- create tree provider
- create tree view
- register commands
- register overview panel integration
- wire refresh events from auth and repository changes

`extension.ts` should stay minimal and delegate all view setup here.

### 5.2 `state/pullRequestTreeStore.ts`

This is the most important class in the new design.

It is the GitCode equivalent of the architectural role played by GitHub's `PrsTreeModel`.

Responsibilities:

- resolve repositories
- load top-level pull requests
- compute categories
- cache PR lists by repository
- cache file lists, commits, and comments by PR
- invalidate caches after review actions
- emit events for tree refresh

This store should know nothing about `TreeItem` rendering.

Suggested API:

```ts
export interface PullRequestTreeStore {
  readonly onDidChange: vscode.Event<TreeRefreshTarget | void>;

  getRepositories(): Promise<GitCodeRepository[]>;
  getCategoryItems(repository: GitCodeRepository): Promise<CategoryState[]>;
  getPullRequests(repository: GitCodeRepository, category: CategoryKey): Promise<PullRequestSummary[]>;
  getFiles(repository: GitCodeRepository, prNumber: number): Promise<PullRequestFileChange[]>;
  getCommits(repository: GitCodeRepository, prNumber: number): Promise<PullRequestCommit[]>;
  getComments(repository: GitCodeRepository, prNumber: number): Promise<PullRequestComment[]>;

  refreshAll(): Promise<void>;
  refreshRepository(repositoryKey: string): Promise<void>;
  refreshPullRequest(repositoryKey: string, prNumber: number): Promise<void>;
}
```

### 5.3 `state/pullRequestDetailsStore.ts`

This store should handle non-list detail state that may later be shared by:

- tree sections
- overview webview
- diff/review UI

Responsibilities:

- load PR detail body, labels, mergeability
- memoize detailed PR payloads
- expose targeted invalidation for a single PR

This separation avoids putting all detail and list state into one class.

### 5.4 `tree/pullRequestTreeDataProvider.ts`

Responsibilities:

- implement `vscode.TreeDataProvider<BaseNode>`
- subscribe to tree store changes
- delegate child construction to node classes or a node factory
- expose `refresh`, `getParent`, and reveal helpers

This class should not own API caches.

### 5.5 `tree/nodeFactory.ts`

This is optional but useful.

Responsibilities:

- centralize construction of node objects
- inject shared dependencies into nodes
- keep provider logic small

This is useful once the tree has more than a few node types.

### 5.6 `tree/nodes/*`

Nodes should be small and focused.

Recommended node groups:

- root and empty state nodes
- repository/category nodes
- PR nodes
- PR subsection nodes
- leaf data nodes

The tree shape should be:

```text
Repository
  Needs My Review
    Pull Request
      Summary
      Files
        File
      Commits
        Commit
      Conversation
        Thread
          Comment
  Authored By Me
    Pull Request
  All Open
    Pull Request
```

That is more explicit than the current simple structure and gives you room to grow.

## 6. Recommended Tree Semantics

### 6.1 Root level

Root nodes should be repository-scoped, not workspace-scoped UI wrappers.

Reason:

- the feature domain is remote PRs, not local folders
- repository identity is the stable domain object
- this maps more cleanly to GitCode API operations

### 6.2 Category level

Use fixed product categories instead of configurable query strings in the first version.

Recommended categories:

- `Needs My Review`
- `Authored By Me`
- `All Open`

This is simpler than GitHub's query-driven categories and better for a GitCode-first UX.

If custom queries are needed later, they can be added as another category strategy.

### 6.3 Pull request node

Each PR node should show:

- number
- title
- author
- branch direction
- review/status hint

The PR node should expand to logical sections, not directly to flat files/comments.

Recommended PR child sections:

- `Summary`
- `Files`
- `Commits`
- `Conversation`

This is a better long-term design than mixing metadata leaf nodes and content nodes directly.

## 7. New Architecture Data Flow

The new flow should be:

```text
VS Code events / commands
  -> ViewController
  -> PullRequestTreeStore / PullRequestDetailsStore
  -> PullRequestTreeDataProvider
  -> Node tree
  -> VS Code TreeView
```

Detailed flow:

1. auth changes, repo changes, or commands trigger refresh
2. `ViewController` tells the relevant store to refresh
3. store invalidates or updates cache
4. store emits change event
5. provider refreshes tree or subtree
6. when a node expands, the node asks the store for the needed children

This keeps the refresh path predictable.

## 8. Why This Is Better Than a Single Provider Design

If all logic lives in one provider, the provider ends up owning:

- auth state checks
- repo resolution
- category computation
- PR caching
- detail caching
- child branching
- command-specific refresh rules

That becomes hard to maintain quickly.

The proposed structure avoids that by making the tree provider mostly an adapter, not a controller.

## 9. Mapping to Existing Non-View Layers

This new view architecture should integrate with the rest of the repo like this:

```text
authentication/
  AuthService

common/
  models
  logger
  configuration
  repositoryContext

gitcode/
  services/pullRequestService.ts
  services/userService.ts
  resolver/gitcodeRepositoryResolver.ts

view/
  state/*
  tree/*
  review/*
  overview/*
```

Dependency direction should be one-way:

```text
view -> gitcode -> common
view -> authentication -> common
```

`gitcode` must not depend on `view`.

## 10. Suggested Class Boundaries

### `PullRequestTreeStore`

Owns:

- repository list
- categorized PR summaries
- file cache
- commit cache
- comment cache

Does not own:

- icon choice
- command objects
- markdown tooltip formatting

### `PullRequestDetailsStore`

Owns:

- detailed PR payload cache
- detail refresh policy

Does not own:

- tree grouping

### `PullRequestTreeDataProvider`

Owns:

- VS Code `EventEmitter`
- `getChildren`
- `getTreeItem`
- `getParent`
- reveal helpers

Does not own:

- API fetch strategy
- cache invalidation policy

### Node classes

Own:

- UI identity
- parent-child relation
- presentation
- requesting child data from stores

Do not own:

- global mutable cache

## 11. Suggested Implementation Phases

### Phase 1: foundation

Create:

- `src/view/viewController.ts`
- `src/view/state/pullRequestTreeStore.ts`
- `src/view/tree/pullRequestTreeDataProvider.ts`
- basic node classes

Support:

- repository root nodes
- category nodes
- PR nodes

### Phase 2: deeper PR sections

Add:

- `Files`
- `Commits`
- `Conversation`

with lazy loading from the store.

### Phase 3: review and overview integration

Add:

- diff controller
- overview webview
- targeted refresh after approve/comment actions

### Phase 4: polish

Add:

- decorations
- badges
- partial refresh targeting
- better error and empty states

## 12. Final Recommendation

For GitCode, the best reference from `vscode-pull-request-github` is not its exact folder layout. It is its separation of:

- model/store
- provider
- node hierarchy

The new `gitcode-pull-request/src/view` should be designed as a clean, GitCode-specific system with:

- repository-first roots
- fixed review-focused categories
- PR section nodes
- centralized stores
- a thin provider

That gives you a structure that is simpler than GitHub's extension, but still scales correctly as review, diff, and overview features grow.
