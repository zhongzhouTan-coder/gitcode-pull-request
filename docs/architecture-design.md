# GitCode Pull Request VS Code Extension Architecture

## Goal

`gitcode-pull-request` is a VS Code extension for working with GitCode pull requests and issues from the editor. It follows the interaction model of `microsoft/vscode-pull-request-github`, but keeps the GitCode implementation smaller and organized around explicit service, store, and view boundaries.

The implemented feature set includes:

1. Personal access token sign-in.
2. GitCode repository discovery from VS Code git remotes, with an `owner/repo` override setting.
3. Pull request and issue tree views.
4. Pull request and issue overview webviews.
5. Pull request file browsing in tree or flat layout.
6. Virtual read-only PR file content and patch views.
7. Inline pull request diff comments with resolve/unresolve actions.
8. Create and edit pull request flows.
9. Create issue and create branch for issue flows.
10. Copilot chat participants for selected pull request and issue context.

## External Constraints

GitCode API details that shape the design:

- The REST API base path is `/api/v5`.
- The default API host is `https://api.gitcode.com`.
- The default web host is `https://gitcode.com`.
- Authentication uses a Personal Access Token stored in VS Code secret storage.
- Repository, pull request, issue, comment, operation log, branch, label, member, milestone, compare, and raw-content APIs are accessed through service classes.

The code keeps authentication and HTTP concerns behind facades so OAuth or alternate token flows can be added later without rewriting the view layer.

## High-Level Architecture

```text
VS Code Host
  |
  +-- extension.ts
        |
        +-- common
        |     +-- configuration and constants
        |     +-- typed domain models
        |     +-- error types
        |     +-- logging
        |     +-- git remote and repository context helpers
        |
        +-- authentication
        |     +-- session store
        |     +-- PAT provider
        |     +-- auth service facade
        |
        +-- gitcode
        |     +-- REST client and request helper
        |     +-- repository resolver
        |     +-- API services
        |     +-- DTO-to-domain mappers
        |
        +-- view
              +-- composition root
              +-- commands
              +-- pull request and issue trees
              +-- stores
              +-- overview webviews
              +-- create PR / create issue flows
              +-- diff and comment controllers
              +-- Copilot context providers
```

Dependency direction is one-way:

```text
view -> gitcode -> common
view -> authentication -> common
authentication -> common
```

`gitcode` and `common` must not depend on `view`.

## Package Responsibilities

### `authentication`

Purpose: isolate credential acquisition, validation, storage, and auth state notifications.

Current structure:

```text
src/authentication/
  authService.ts
  patAuthProvider.ts
  sessionStore.ts
  types.ts
```

Responsibilities:

- Prompt for a GitCode PAT.
- Store the serialized auth session in `context.secrets`.
- Validate the token through `UserService.getCurrentUser()`.
- Expose the current signed-in account.
- Emit auth state changes so stores and views can clear cached data.

`AuthService` is the only authentication entry point used by the rest of the extension. View code does not know how the session was created.

### `common`

Purpose: shared primitives with no GitCode API side effects.

Current structure:

```text
src/common/
  configuration.ts
  constants.ts
  errors.ts
  logger.ts
  models.ts
  git/
    gitTypes.ts
    localGitService.ts
    remoteParser.ts
    repositoryContext.ts
```

Responsibilities:

- Read extension settings such as `gitcode.baseUrl`, `gitcode.webUrl`, `gitcode.repository`, page sizes, trace mode, and pull request file layout.
- Define command IDs, view IDs, URI schemes, and storage keys.
- Parse GitCode remotes such as `git@gitcode.com:owner/repo.git` and `https://gitcode.com/owner/repo.git`.
- Resolve active VS Code git repositories.
- Provide domain models consumed by services and views.
- Provide typed error categories for auth, API, and repository resolution failures.

### `gitcode`

Purpose: all GitCode network communication and REST DTO mapping.

Current structure:

```text
src/gitcode/
  client/
    gitcodeClient.ts
    request.ts
  mappers/
  resolver/
    gitcodeRepositoryResolver.ts
  services/
```

Responsibilities:

- Build authenticated HTTP requests using the current session.
- Apply API base URL and pagination conventions.
- Centralize GitCode endpoint paths.
- Convert API DTOs into `common/models.ts` domain types.
- Resolve `owner/repo` targets from git remotes or `gitcode.repository`.

Service classes expose behavior-oriented operations:

- `UserService`
- `RepositoryService`
- `PullRequestService`
- `CommentService`
- `IssueService`
- `IssueCommentService`
- `IssueOperationLogService`
- `RawContentService`

Views must call services or stores. They must not issue HTTP requests directly.

### `view`

Purpose: all user-facing VS Code UI and command orchestration.

Current structure:

```text
src/view/
  viewController.ts
  commands/
  tree/
  state/
  overview/
  issueOverview/
  createPullRequest/
  createIssue/
  diff/
  comments/
  copilot/
  webview/
```

`ViewController` is the composition root. It creates stores, providers, tree views, overview stores, comment controllers, create-flow helpers, virtual file providers, chat participants, and command registrations.

`extension.ts` stays minimal: it creates infrastructure services, constructs `ViewController`, registers disposables, and calls `initialize()`.

## Contribution Points

The extension contributes one activity bar container:

```text
GitCode Pull Requests
```

Views:

- `pr:gitcode` - pull request tree.
- `gitcode:createPullRequestWebview` - create pull request webview.
- `issues:gitcode` - issue tree.

Chat participants:

- `gitcode-pull-request.context`
- `gitcode-issue.context`

Important URI schemes:

- `gitcode-pr-diff` for generated patch content.
- `gitcode-pr` for read-only PR file content.

## State and Refresh Flow

### State Sources

- VS Code secret storage for auth sessions.
- VS Code settings for API hosts, repository override, page sizes, trace mode, and PR file layout.
- In-memory stores for tree lists, overview details, comments, operation logs, diff snapshots, and Copilot context.

### Refresh Triggers

- Sign in or session change.
- Workspace folder change.
- Git repository open/close events from the VS Code git extension.
- Manual refresh commands.
- File layout setting changes.
- Targeted refresh after edit, create, comment, or resolve actions.

### Refresh Strategy

- Repository discovery waits briefly during startup so the git extension can finish initializing.
- PR and issue lists are cached by repository, category, and signed-in account.
- Pull request file lists are loaded lazily when the `Files` node is expanded.
- Detail, comment, operation-log, and related-resource stores are separate from tree list stores.
- Auth changes clear user-scoped caches and refresh both tree views.

## Pull Request Flow

```text
PullRequestTreeStore
  -> PullRequestTreeDataProvider
    -> RepositoryNode
      -> PullRequestCategoryNode
        -> PullRequestNode
          -> PullRequestFilesNode
            -> DirectoryNode / PullRequestFileNode
```

Implemented categories:

- `All Open`
- `Created By Me`

Opening a pull request uses `PullRequestOverviewStore` and `PullRequestOverviewPanel`. File actions use `PullRequestDiffStore`, `PullRequestDiffController`, `PullRequestPatchContentProvider`, and `GitCodePullRequestFileSystemProvider` to present changed content and patch context.

Diff comments are coordinated by:

- `PullRequestCommentsStore`
- `DiffCommentController`
- `CommentThreadFactory`

## Issue Flow

```text
IssueTreeStore
  -> IssueTreeDataProvider
    -> IssueRepositoryNode
      -> IssueCategoryNode
        -> IssueNode
```

Implemented categories:

- `My Issues`
- `Created Issues`
- `Recent Issues`

Opening an issue uses:

- `IssueOverviewStore`
- `IssueCommentsStore`
- `IssueOperationLogsStore`
- `IssueRelatedPullRequestsStore`
- `IssueOverviewPanel`

Issue commands include opening on GitCode, copying the URL, creating a branch, creating an issue, and using an issue as Copilot context.

## Configuration

Current contributed settings:

```json
{
  "gitcode.baseUrl": "https://api.gitcode.com",
  "gitcode.webUrl": "https://gitcode.com",
  "gitcode.repository": "",
  "gitcode.pullRequests.pageSize": 100,
  "gitcode.pullRequests.fileListLayout": "tree",
  "gitcode.issues.pageSize": 100,
  "gitcode.trace.server": "off"
}
```

`gitcode.repository` accepts `owner/repo` and is useful when the workspace remote is not hosted on `gitcode.com`.

## Error Handling

User-facing errors are normalized before they reach tree views and panels:

- `NotSignedInError`
- `AuthenticationFailedError`
- `RepositoryResolutionError`
- `RepositoryNotOnGitCodeError`
- `ApiRequestError`

Rules:

- `gitcode` services throw typed errors.
- Stores cache promises and clear failed promises so retry works.
- Tree providers and nodes turn known errors into empty-state nodes.
- Command handlers decide whether to show notifications, open panels, or refresh state.

## Testing Strategy

The test suite focuses on unit-level behavior with mocked services:

- remote parsing and repository context
- API mappers
- pagination
- tree stores and nodes
- overview stores and generated HTML
- create issue / create pull request data models
- comments, diff comment context, and comment status revision
- issue and pull request operation logs
- Copilot context stores

Run:

```sh
npm test
```

The `pretest` script compiles tests, builds the extension bundle, and runs ESLint before launching `vscode-test`.
