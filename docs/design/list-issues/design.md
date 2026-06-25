# List Issues Design

## Goal

Add an Issues section that lists GitCode issues for the current workspace
repository.

The feature must:

- resolve GitCode repositories from the current git repository using the same
  repository resolution rules as the pull request tree
- call the GitCode list issues API documented in [api.md](api.md)
- render issues in a VS Code tree view section
- follow the store/provider/node split already used by the pull request tree
- keep API access inside `gitcode/services/*`, not in the view layer
- use the GitHub extension's issue list behavior as the UX reference

The main reference from `vscode-pull-request-github` is
`src/issues/issuesView.ts`. That view uses repository roots, query nodes,
optional grouping nodes, and issue leaf nodes with an open-description command.
GitCode should keep the same structure where it is useful, but avoid importing
GitHub-specific query parsing, branch workflow, avatar caching, or GraphQL
behavior.

## Scope

### In Scope

- Add a new Issues tree section for GitCode repository issues.
- Discover repositories with `GitCodeRepositoryResolver.resolveAll()`.
- Show one repository root node per resolved GitCode repository when multiple
  repositories are available.
- Use one fixed query/category for the first version: `All Open`.
- List open issues under each repository.
- Show empty, unauthenticated, unsupported repository, loading, and error
  states.
- Add manual refresh, open-on-web, and copy-url commands for issue nodes.
- Keep the design compatible with future configurable queries and grouping.

### Out of Scope

- Creating, editing, closing, assigning, or labeling issues.
- Issue detail webview.
- Native markdown issue editor.
- Branch-from-issue workflow.
- Configurable GitHub-style search queries.
- Grouping by milestone, assignee, label, or repository in the first version.
- Pagination UI and load-more nodes.
- Issue comment display.

## User Experience

The first version should add an Issues section next to the existing Pull
Requests section in the GitCode activity view.

Recommended contribution shape:

```text
GitCode
  Pull Requests
  Issues
```

The Issues tree is repository-first when there is more than one resolved
GitCode repository:

```text
Issues
  owner/repo (origin)
    All Open
      #321 [Bug] Quantization fails on A5
      #320 Build script does not run tests
```

When there is only one resolved repository, GitHub's issue view skips the
repository node and shows query nodes directly. GitCode can do the same only if
it does not make the tree inconsistent with the pull request view. The safer
initial choice is to keep repository roots in both views:

```text
Issues
  owner/repo (origin)
    All Open
      #321 [Bug] Quantization fails on A5
```

If the category has no results:

```text
owner/repo (origin)
  All Open
    No open issues
```

Issue node rendering should follow the GitHub issue tree:

- label: `#321 [Bug] Quantization fails on A5`
- description: author plus lightweight metadata, for example
  `mominhua TODO bug, high-priority`
- icon: `$(issues)` for open issues and `$(issue-closed)` for closed issues
- command: open the issue on GitCode for the first version
- tooltip: title, author, state, issue state, labels, comment count, updated
  time, and URL

Avoid expensive avatar rendering in the first version. The GitHub extension has
avatar and state-icon settings, but GitCode should start with stable codicons.

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/:repo/issues
```

The service call should be:

```ts
issueService.listIssues(repository, {
  state: 'open',
  sort: 'updated',
  direction: 'desc',
  perPage: configuration.getIssuesPageSize(),
});
```

`GitCodeClient` remains responsible for authentication and base URL handling.
The view layer must not pass `access_token` or construct raw URLs.

The response should be mapped to a normalized `IssueSummary` domain model.
Minimum fields needed by the tree:

- `id`
- `number`
- `title`
- `state`
- `author`
- `updatedAt`
- `url`
- `labels`
- `assignees`
- `comments`
- `issueState`
- `issueType`
- `priority`
- `milestone`

The API sample returns `number` as a string. The mapper should normalize it to a
number and tolerate missing or malformed fields.

## Architecture

Follow the same dependency direction as the pull request tree:

```text
VS Code view / commands
  -> ViewController
  -> IssueTreeStore
  -> IssueService
  -> GitCodeClient
  -> IssueTreeDataProvider
  -> Issue tree nodes
```

Dependency rules:

- `view` may depend on `common`, `authentication`, and `gitcode/services`.
- `view` must not depend on GitCode issue DTOs.
- `gitcode` must not depend on `view`.
- Tree nodes should render domain models, not raw API responses.
- Issue service and mapper should be separate from pull request service and
  mapper.

## Proposed Files

Create or update:

```text
src/
  common/
    models.ts                         # IssueSummary and related issue types
    configuration.ts                  # optional issue page-size setting
    constants.ts                      # issue command IDs and view ID
  gitcode/
    services/issueService.ts          # list issues endpoint access
    mappers/issueMapper.ts            # DTO -> IssueSummary
  view/
    viewController.ts                 # construct issue store/provider/view
    commands/
      registerIssueCommands.ts
    state/
      issueTreeStore.ts
    tree/
      issueTreeDataProvider.ts
      issueNodeFactory.ts
      nodes/
        issueRepositoryNode.ts
        issueCategoryNode.ts
        issueNode.ts
```

The implementation can share `BaseNode` and `EmptyStateNode` with the pull
request tree if their names stay generic enough. Do not extend
`PullRequestTreeStore` to also own issue state; issue and pull request caches
should be independent.

## Domain Model

Suggested model additions:

```ts
export interface IssueUser {
  login: string;
  name?: string;
  avatarUrl?: string;
  htmlUrl?: string;
}

export interface IssueLabel {
  id: number;
  name: string;
  color?: string;
}

export interface IssueMilestone {
  number: number;
  title: string;
  state?: string;
  dueOn?: string;
  url?: string;
}

export interface IssueSummary {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: IssueUser;
  assignees: IssueUser[];
  labels: IssueLabel[];
  comments: number;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  url?: string;
  issueState?: string;
  issueType?: string;
  priority?: number;
  milestone?: IssueMilestone;
}
```

Mapper rules:

- `number`: `Number(dto.number ?? dto.iid ?? dto.id ?? 0)`
- `state`: only `open` and `closed`; unknown values should map to `open` and
  log at debug level if logging is available
- `author`: `dto.user`, falling back to `dto.author`
- `assignees`: use `dto.assignees`; if absent, include `dto.assignee` when
  present
- `labels`: map `id`, `name`, and `color`
- `url`: prefer `html_url`, then `web_url`, then `url`
- `finishedAt`: omit when the API returns an empty string

## Store Design

`IssueTreeStore` is the source of truth for issue lists.

Suggested types:

```ts
export type IssueCategoryKey = 'allOpen';

export interface IssueCategoryState {
  key: IssueCategoryKey;
  label: string;
  repository: GitCodeRepository;
}

export type IssueTreeRefreshTarget =
  | { type: 'all' }
  | { type: 'repository'; repositoryKey: string };
```

Suggested class surface:

```ts
export class IssueTreeStore {
  readonly onDidChange: vscode.Event<IssueTreeRefreshTarget | void>;

  getRepositories(): Promise<GitCodeRepository[]>;
  getCategories(repository: GitCodeRepository): IssueCategoryState[];
  getIssues(
    repository: GitCodeRepository,
    category: IssueCategoryKey,
  ): Promise<IssueSummary[]>;

  refreshAll(): Promise<void>;
  refreshRepository(repositoryKey: string): Promise<void>;
}
```

Cache keys:

```text
repositoryKey = repository.fullName
categoryKey = allOpen
issueListKey = ${repository.fullName}:allOpen
```

Cache policy:

- Cache repository resolution until `refreshAll`.
- Cache issue lists per repository and category.
- Share concurrent in-flight requests for the same issue list.
- Clear all issue list caches on manual refresh.
- Clear only that repository's issue list cache on repository refresh.
- Do not cache failed requests as successful results.

Loading behavior:

- `getRepositories()` resolves remotes lazily when the root tree is requested.
- `getIssues()` loads from the API only when the category node expands.
- Multiple concurrent requests for the same list should share the same in-flight
  promise.

## Tree Provider Design

`IssueTreeDataProvider` should be a thin adapter, matching
`PullRequestTreeDataProvider`.

Responsibilities:

- implement `vscode.TreeDataProvider<BaseNode>`
- subscribe to `IssueTreeStore.onDidChange`
- return root repository nodes when `element` is undefined
- delegate child generation to issue nodes or `IssueNodeFactory`
- expose `refresh()` for commands

It should not:

- call `GitCodeClient`
- parse git remotes
- own API caches
- construct API request parameters

## Node Design

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
issueRepository
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
issueCategory
```

Children:

- issue nodes from `IssueTreeStore.getIssues(repository, 'allOpen')`
- empty state node if the list is empty
- error node if loading fails

### Issue Node

Label:

```text
#321 [Bug] Quantization fails on A5
```

Description examples:

```text
mominhua TODO bug, high-priority
2 comments
```

Context value:

```text
issue
```

Command:

```text
gitcode.openIssue
```

Node payload should include both the `GitCodeRepository` and `IssueSummary` so
commands do not need to resolve the repository again.

Tooltip should include:

- title
- author
- state and GitCode issue state
- labels
- assignees
- comment count
- milestone
- updated time
- web URL when present

### Empty State Node

Use this for:

- not signed in
- no active git repository
- repository not on GitCode
- no open issues
- API errors

Empty nodes should not be collapsible and should have no command unless there
is an obvious action, such as `gitcode.signIn`.

## Commands

Initial command behavior:

### `gitcode.refreshIssues`

- Call `IssueTreeStore.refreshAll()`.
- Fire a full issue tree refresh.
- Keep tree expanded state controlled by VS Code where possible.

### `gitcode.openIssue`

- Accept an issue node payload.
- Open the issue web URL in the first version.
- Later, this can open a GitCode issue detail webview without changing the node
  payload.

### `gitcode.openIssueOnWeb`

- Open `IssueSummary.url` when present.
- Fallback to `${repository.webUrl}/issues/${number}`.

### `gitcode.copyIssueUrl`

- Copy the same URL used by `openIssueOnWeb`.

## View Contribution

Add a second view contribution under the existing GitCode view container:

```json
{
  "id": "issues:gitcode",
  "name": "Issues",
  "when": "gitcode:enabled"
}
```

Use separate menus from pull requests:

- view title: refresh issues
- issue item: open, open on GitCode, copy URL
- issue category or repository: refresh repository if implemented

Keep command IDs distinct from pull request commands to avoid context-menu
collisions.

## Error Handling

Store-level errors should be converted into node states.

Recommended mapping:

| Error | Tree state |
| --- | --- |
| No auth session | `Sign in to GitCode` |
| No active git repository | `Open a git repository to list issues` |
| No GitCode remote | `No GitCode remote found` |
| 401/403 | `GitCode authentication failed` |
| Other API error | `Unable to load issues` |

Do not show a VS Code error notification for routine tree-render states. Use
notifications for explicit user commands such as manual refresh when the command
itself fails.

## Configuration

Use existing settings:

- `gitcode.baseUrl`
- `gitcode.webUrl`
- `gitcode.repository`

Add an issue page-size setting if list issues should be configurable:

```text
gitcode.issues.pageSize
```

Default: `20`

Maximum: `100`

The setting should be passed as `per_page`.

The first version should hard-code these filters:

```text
state=open
sort=updated
direction=desc
```

These defaults make the list more useful for active work than the API default
of `sort=created`.

## Implementation Steps

1. Add issue domain types to `src/common/models.ts`.
2. Add `IssueService.listIssues()` using `/api/v5/repos/:owner/:repo/issues`.
3. Add `mapIssue()` and unit tests for the API sample shape.
4. Add `IssueTreeStore` with repository and issue list caching.
5. Add issue tree provider, node factory, repository node, category node, and
   issue node.
6. Add `issues:gitcode` to `package.json` views.
7. Add issue commands and context menu contributions.
8. Construct the issue store/provider/tree view in `ViewController`.
9. Refresh issue state on auth changes, workspace folder changes, and manual
   refresh.

## Test Plan

Unit tests:

- `IssueService.listIssues()` calls `/issues` with `state=open`, `sort=updated`,
  `direction=desc`, and `per_page`.
- `mapIssue()` normalizes string issue numbers to numbers.
- `mapIssue()` maps author, assignees, labels, milestone, comments, and URL.
- no GitCode remotes returns a tree empty state.
- `IssueTreeStore.getIssues()` shares concurrent in-flight requests.
- `IssueTreeStore.getIssues()` does not cache failed requests.
- category node returns `No open issues` for an empty list.
- issue node builds stable IDs and command payloads.

Manual verification:

1. Sign in with a GitCode token.
2. Open a workspace with a GitCode `origin`.
3. Run `GitCode: Refresh Issues`.
4. Confirm the Issues tree shows `owner/repo (origin)`.
5. Expand `All Open`.
6. Confirm open issues match the GitCode web UI, sorted by recently updated.
7. Open an issue node and confirm it opens the expected GitCode URL.
8. Copy an issue URL and confirm the clipboard value.
9. Open a workspace with no GitCode remote and confirm the unsupported
   repository empty state appears instead of an error notification.

## Future Extensions

The first version intentionally keeps the category layer even though it only has
`All Open`.

Later categories can be added without changing the provider shape:

- `Assigned To Me`
- `Created By Me`
- `Mentioning Me`
- `Recently Updated`
- `Closed`

Later grouping can follow the GitHub issue view's `IssueGroupNode` pattern:

- group by milestone
- group by repository
- group by assignee
- group by label

Later issue child sections can be added under `IssueNode`:

- `Description`
- `Comments`
- `Linked Pull Requests`

Those extensions should continue to load lazily from store methods instead of
making the initial issue list request heavier.
