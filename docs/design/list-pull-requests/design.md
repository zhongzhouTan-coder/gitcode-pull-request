# List Pull Requests Design

## Goal

Implement the first pull request tree feature: list open GitCode pull requests for the current workspace repository.

The feature must:

- resolve GitCode repositories from the current git repository's `origin` and `upstream` remotes
- call the GitCode list pull requests API documented in [api.md](api.md)
- render the results in the `pr:gitcode` VS Code tree view
- follow the store/provider/node split described in [tree-view-architecture.md](../../tree-view-architecture.md)
- keep API access inside `gitcode/services/*`, not in the view layer

In the current local checkout only `origin` is configured:

```text
origin https://github.com/zhongzhouTan-coder/gitcode-pull-request.git
```

There is no local `upstream` remote at the time this design was written. The implementation should still support `upstream` because user workspaces may have both remotes.

## Scope

### In Scope

- Discover GitCode repositories from the active VS Code git repository.
- Prefer `origin`, then `upstream`, then other remotes.
- Deduplicate remotes that resolve to the same `owner/repo`.
- Show one repository root node per resolved GitCode repository.
- List open pull requests under each repository.
- Show empty, unauthenticated, unsupported repository, loading, and error states.
- Add a manual refresh command.
- Open a pull request detail view or web URL from a PR node using existing commands where available.

### Out of Scope

- Custom query categories.
- Pagination UI and load-more nodes.
- Checkout PR branch.
- Review actions beyond existing command hooks.
- Files, commits, comments, and conversation lazy-loading. Those belong to the next tree-view phases.
- OAuth changes.

## User Experience

The tree should be repository-first:

```text
Pull Requests
  owner/repo (origin)
    All Open
      #567 [Doc] Add unit testing guide
      #566 Fix request mapping
```

If both `origin` and `upstream` resolve to different GitCode repositories:

```text
Pull Requests
  owner/fork (origin)
    All Open
      #12 Local fork change
  org/project (upstream)
    All Open
      #567 Upstream change
```

If a category has no results:

```text
owner/repo (origin)
  All Open
    No open pull requests
```

The first feature should use a single fixed category, `All Open`. This keeps the data model compatible with the future category shape from `tree-view-architecture.md` without needing reviewer or author filters before the API behavior is confirmed.

## Remote Resolution

Repository resolution should use `GitCodeRepositoryResolver.resolveAll()`.

Resolution rules:

1. If `gitcode.repository` is configured, return only that repository with `remoteName: "override"`.
2. Read remotes from the active VS Code git repository.
3. Sort remotes by priority:
   - `origin`
   - `upstream`
   - all other remotes
4. Parse only GitCode remotes.
5. Deduplicate by `fullName`.
6. Return each repository with:
   - `remoteName`
   - `owner`
   - `name`
   - `fullName`
   - `webUrl`

Important behavior:

- A GitHub remote, such as the current checkout's `origin`, should not be treated as a GitCode repository.
- If no GitCode remote exists, show a tree empty state that explains the repository is not on GitCode and mentions the `gitcode.repository` override.
- If `origin` and `upstream` point to the same GitCode repository, show it once using the higher-priority remote.

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/:repo/pulls
```

The service call should be:

```ts
pullRequestService.listPullRequests(repository, {
  state: 'open',
  perPage: configuration.getPullRequestPageSize(),
});
```

The `GitCodeClient` remains responsible for authentication and base URL handling. The view layer must not pass `access_token` or construct raw URLs.

The list response should be mapped to `PullRequestSummary` using `mapPullRequest`.

Minimum fields needed by the tree:

- `number`
- `title`
- `state`
- `author`
- `updatedAt`
- `sourceBranch`
- `targetBranch`
- `url`
- `isDraft`
- `reviewers`
- `assignees`

## Architecture

Follow this flow:

```text
VS Code view / commands
  -> ViewController
  -> PullRequestTreeStore
  -> PullRequestService
  -> GitCodeClient
  -> PullRequestTreeDataProvider
  -> Tree nodes
```

Dependency rules:

- `view` may depend on `common`, `authentication`, and `gitcode/services`.
- `view` must not depend on GitCode DTOs.
- `gitcode` must not depend on `view`.
- Tree nodes should render domain models, not raw API responses.

## Proposed Files

Create or update:

```text
src/view/
  viewController.ts
  commands/
    registerTreeCommands.ts
  state/
    pullRequestTreeStore.ts
  tree/
    pullRequestTreeDataProvider.ts
    nodeFactory.ts
    nodes/
      baseNode.ts
      emptyStateNode.ts
      repositoryNode.ts
      pullRequestCategoryNode.ts
      pullRequestNode.ts
```

The current code has older view files under `src/view/tree` and `src/view/commands`. The new implementation should replace that shape with the architecture above rather than adding API and cache behavior to the tree provider.

## Store Design

`PullRequestTreeStore` is the source of truth for the list feature.

Suggested types:

```ts
export type PullRequestCategoryKey = 'allOpen';

export interface PullRequestCategoryState {
  key: PullRequestCategoryKey;
  label: string;
  repository: GitCodeRepository;
}

export type TreeRefreshTarget =
  | { type: 'all' }
  | { type: 'repository'; repositoryKey: string };
```

Suggested class surface:

```ts
export class PullRequestTreeStore {
  readonly onDidChange: vscode.Event<TreeRefreshTarget | void>;

  getRepositories(): Promise<GitCodeRepository[]>;
  getCategories(repository: GitCodeRepository): PullRequestCategoryState[];
  getPullRequests(
    repository: GitCodeRepository,
    category: PullRequestCategoryKey,
  ): Promise<PullRequestSummary[]>;

  refreshAll(): Promise<void>;
  refreshRepository(repositoryKey: string): Promise<void>;
}
```

Cache keys:

```text
repositoryKey = repository.fullName
categoryKey = allOpen
pullRequestListKey = ${repository.fullName}:allOpen
```

Cache policy:

- Cache repository resolution until `refreshAll`.
- Cache PR lists per repository and category.
- Clear all list caches on manual refresh.
- Clear only that repository's list cache on repository refresh.
- Do not cache failed requests as successful results.

Loading behavior:

- `getRepositories()` resolves remotes lazily when the root tree is requested.
- `getPullRequests()` loads from the API only when the category node expands.
- Multiple concurrent requests for the same list should share the same in-flight promise.

## Tree Provider Design

`PullRequestTreeDataProvider` should be a thin adapter.

Responsibilities:

- implement `vscode.TreeDataProvider<BaseNode>`
- subscribe to `PullRequestTreeStore.onDidChange`
- return root repository nodes when `element` is undefined
- delegate child generation to nodes or `nodeFactory`
- expose `refresh()` for commands

It should not:

- call `GitCodeClient`
- parse git remotes
- own API caches
- construct API request parameters

## Node Design

### Base Node

All nodes should expose:

- stable `id`
- optional `parent`
- `getTreeItem()`
- `getChildren()`

### Repository Node

Label:

```text
owner/repo (origin)
```

For `remoteName: "override"`:

```text
owner/repo
```

Context value:

```text
repository
```

Children:

- `All Open` category node

### Category Node

Label:

```text
All Open
```

Context value:

```text
pullRequestCategory
```

Children:

- PR nodes from `PullRequestTreeStore.getPullRequests(repository, 'allOpen')`
- empty state node if the list is empty
- error node if loading fails

### Pull Request Node

Label:

```text
#567 [Doc] Add unit testing guide
```

Description:

```text
author sourceBranch -> targetBranch
```

Context value:

```text
pullRequest
```

Command:

```text
gitcode.openPullRequest
```

Node payload should include both the `GitCodeRepository` and `PullRequestSummary` so commands do not need to resolve the repository again.

Tooltip should include:

- title
- author
- source branch
- target branch
- updated time
- web URL when present

### Empty State Node

Use this for:

- not signed in
- no active git repository
- repository not on GitCode
- no open pull requests
- API errors

Empty nodes should not be collapsible and should have no command unless there is an obvious action, such as `gitcode.signIn`.

## Commands

Initial command behavior:

### `gitcode.refreshPullRequests`

- Call `PullRequestTreeStore.refreshAll()`.
- Fire a full tree refresh.
- Keep the tree expanded state controlled by VS Code where possible.

### `gitcode.openPullRequest`

- Accept a pull request node payload.
- Open the existing PR overview/detail behavior if available.
- Fallback to opening the PR web URL if no detail view exists yet.

### `gitcode.openPullRequestOnWeb`

- Open `PullRequestSummary.url` when present.
- Fallback to `${repository.webUrl}/merge_requests/${number}`.

### `gitcode.copyPullRequestUrl`

- Copy the same URL used by `openPullRequestOnWeb`.

## Error Handling

Store-level errors should be converted into node states.

Recommended mapping:

| Error | Tree state |
| --- | --- |
| No auth session | `Sign in to GitCode` |
| No active git repository | `Open a git repository to list pull requests` |
| No GitCode remote | `No GitCode remote found` |
| 401/403 | `GitCode authentication failed` |
| Other API error | `Unable to load pull requests` |

Do not show a VS Code error notification for routine tree-render states. Use notifications for explicit user commands such as manual refresh when the command itself fails.

## Configuration

Use existing settings:

- `gitcode.baseUrl`
- `gitcode.webUrl`
- `gitcode.repository`
- `gitcode.pullRequests.pageSize`

`gitcode.pullRequests.pageSize` should be passed as `per_page`. The API allows up to 100; the current package setting already enforces a maximum of 100.

## Implementation Steps

1. Move view composition into `src/view/viewController.ts`.
2. Add `PullRequestTreeStore` with repository and PR list caching.
3. Add typed tree nodes and a small node factory.
4. Keep `PullRequestTreeDataProvider` focused on VS Code tree binding.
5. Wire `gitcode.refreshPullRequests` to the store.
6. Ensure PR node commands receive `{ repository, pullRequest }`.
7. Remove or adapt the older deleted `registerCommands.ts`, `nodes.ts`, and `pullRequestTreeDataProvider.ts` layout.

## Test Plan

Unit tests:

- remote priority: `origin` before `upstream`
- remote deduplication by `fullName`
- no GitCode remotes returns a tree empty state
- `PullRequestTreeStore.getPullRequests()` calls `listPullRequests()` with `state: 'open'`
- page size is passed as `perPage`
- category node returns an empty node for an empty list
- PR node builds stable IDs and command payloads

Manual verification:

1. Sign in with a GitCode token.
2. Open a workspace with a GitCode `origin`.
3. Run `GitCode: Refresh Pull Requests`.
4. Confirm the tree shows `owner/repo (origin)`.
5. Expand `All Open`.
6. Confirm open PRs match the GitCode web UI.
7. Add a different GitCode `upstream` remote.
8. Refresh and confirm both repository roots appear.
9. Open the current checkout, where `origin` is GitHub and no `upstream` exists, and confirm the tree shows the unsupported repository empty state instead of failing.

## Future Extensions

This design intentionally keeps the category layer even though the first feature has only `All Open`.

Later categories can be added without changing the provider shape:

- `Needs My Review`
- `Authored By Me`
- `Assigned To Me`
- `Merged`

Later PR child sections can be added under `PullRequestNode`:

- `Summary`
- `Files`
- `Commits`
- `Conversation`

Those extensions should continue to load lazily from store methods instead of making the initial PR list request heavier.
