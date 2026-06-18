# GitCode Pull Request VS Code Extension Architecture

## Goal

Build a VS Code extension for GitCode pull requests with a UX close to `microsoft/vscode-pull-request-github`, while keeping the codebase split into four main packages:

- `authentication`
- `common`
- `gitcode`
- `view`

The first deliverable should support:

1. Sign in to GitCode
2. Discover the current repository's GitCode remote
3. List and open pull requests
4. Show a tree view similar to the GitHub Pull Requests extension
5. Show PR details, changed files, and comments
6. Allow basic review actions and commenting

## External Constraints

GitCode API details that shape the design:

- The REST API base path is `/api/v5`.
- GitCode supports Personal Access Token authentication with `Authorization: Bearer <token>` or `PRIVATE-TOKEN`.
- GitCode also exposes OAuth with:
  - `GET https://gitcode.com/oauth/authorize`
  - `POST https://gitcode.com/oauth/token`
  - `GET https://api.gitcode.com/api/v5/user`
- Pull request APIs exist for:
  - PR list: `/api/v5/repos/:owner/:repo/pulls`
  - PR detail: `/api/v5/repos/:owner/:repo/pulls/:number`
  - PR comments: `/api/v5/repos/:owner/:repo/pulls/:number/comments`
  - PR files: `/api/v5/repos/:owner/:repo/pulls/:number/files`
  - PR review handling: `/api/v5/repos/:owner/:repo/pulls/:number/review`

Implication:

- The extension should start with PAT authentication because it is simpler and lower risk.
- The architecture should still keep an OAuth provider abstraction so OAuth can be added without rewriting the rest of the system.

## High-Level Architecture

```text
VS Code Host
  |
  +-- extension.ts
        |
        +-- common
        |     +-- configuration
        |     +-- logging
        |     +-- models
        |     +-- git remote parsing
        |     +-- errors / telemetry contracts
        |
        +-- authentication
        |     +-- session store
        |     +-- PAT provider
        |     +-- OAuth provider
        |     +-- auth service facade
        |
        +-- gitcode
        |     +-- REST client
        |     +-- API resources
        |     |     +-- user
        |     |     +-- repos
        |     |     +-- pull requests
        |     |     +-- comments
        |     |     +-- reviews
        |     +-- repository resolver
        |     +-- DTO -> domain mappers
        |
        +-- view
              +-- tree views
              +-- webview/detail panels
              +-- commands
              +-- state/store
```

## Package Responsibilities

### `authentication`

Purpose: isolate all credential acquisition and storage.

Recommended structure:

```text
src/authentication/
  authService.ts
  authProvider.ts
  patAuthProvider.ts
  oauthProvider.ts
  sessionStore.ts
  authCommands.ts
  types.ts
```

Responsibilities:

- Prompt for PAT and store it in `context.secrets`
- Validate token via `GET /api/v5/user`
- Expose current signed-in account
- Later support OAuth device/browser flow through the same facade
- Notify listeners when auth state changes

Key interfaces:

```ts
export interface AuthSession {
  accessToken: string;
  accountName: string;
  authType: 'pat' | 'oauth';
  expiresAt?: number;
  refreshToken?: string;
}

export interface AuthProvider {
  signIn(): Promise<AuthSession>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | undefined>;
}
```

Design choice:

- `AuthService` should be the only entry point used by `gitcode` and `view`.
- `view` must not know whether the session came from PAT or OAuth.

### `common`

Purpose: shared primitives with no GitCode API side effects.

Recommended structure:

```text
src/common/
  constants.ts
  configuration.ts
  errors.ts
  logger.ts
  models/
  git/
    remoteParser.ts
    repositoryContext.ts
  utils/
```

Responsibilities:

- Extension constants and setting keys
- Domain models shared across packages
- Parse git remotes such as:
  - `git@gitcode.com:owner/repo.git`
  - `https://gitcode.com/owner/repo.git`
- Resolve active repository from the VS Code Git extension
- Shared error types:
  - auth errors
  - API errors
  - repository resolution errors
- Logging and optional telemetry abstraction

Important rule:

- `common` must not depend on `view`.
- `common` should avoid depending on raw API DTO shapes from `gitcode`.

### `gitcode`

Purpose: everything related to GitCode network communication and remote-to-resource mapping.

Recommended structure:

```text
src/gitcode/
  client/
    gitcodeClient.ts
    request.ts
    pagination.ts
  services/
    userService.ts
    repositoryService.ts
    pullRequestService.ts
    commentService.ts
    reviewService.ts
  mappers/
    pullRequestMapper.ts
    commentMapper.ts
    repositoryMapper.ts
  resolver/
    gitcodeRepositoryResolver.ts
  dto/
```

Responsibilities:

- Build authenticated HTTP requests
- Apply API version and pagination rules
- Convert API DTOs into extension domain models
- Centralize GitCode endpoint paths
- Resolve owner/repo from the active git remote

Core client contract:

```ts
export interface GitCodeClient {
  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T>;
  post<T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T>;
  put<T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T>;
}
```

Initial service surface:

- `UserService.getCurrentUser()`
- `RepositoryService.getRepository(owner, repo)`
- `PullRequestService.listPullRequests(owner, repo, filters)`
- `PullRequestService.getPullRequest(owner, repo, number)`
- `PullRequestService.getFiles(owner, repo, number)`
- `CommentService.listPullRequestComments(owner, repo, number)`
- `CommentService.createPullRequestComment(owner, repo, number, input)`
- `ReviewService.submitReview(owner, repo, number, input)`

Design choice:

- Keep raw REST calling in `client/`.
- Keep behavior-oriented operations in `services/`.
- Never call HTTP directly from `view`.

### `view`

Purpose: all user-facing VS Code UI, especially the PR tree view.

Recommended structure:

```text
src/view/
  commands/
  tree/
    pullRequestTreeDataProvider.ts
    nodes/
      workspaceNode.ts
      categoryNode.ts
      pullRequestNode.ts
      filesNode.ts
      fileChangeNode.ts
      commentsNode.ts
      reviewStatusNode.ts
  panels/
    pullRequestDetailPanel.ts
  state/
    pullRequestViewState.ts
```

Responsibilities:

- Register tree views and commands
- Render pull request lists grouped by query/category
- Open PR detail views
- Refresh on auth change, repo change, and manual refresh
- Coordinate user actions like checkout, comment, approve, refresh

## Tree View Design

The target UX should be close to GitHub Pull Requests:

- A dedicated activity bar container, for example `GitCode`
- A primary tree view for pull requests
- Optional secondary views later:
  - reviewers
  - issues
  - notifications

### Proposed Tree Structure

```text
GitCode
  Pull Requests
    Local Repository: owner/repo
      Waiting for my review
        PR #102 Add auth service
        PR #98 Refactor repo resolver
      Assigned to me
      Created by me
      All Open
      Merged
```

When a PR expands:

```text
PR #102 Add auth service
  Summary
  Checks
  Reviewers
  Changed Files
    src/authentication/authService.ts
    src/gitcode/client/gitcodeClient.ts
  Conversation
    General comments
    File comments
```

### Node Model

Use typed tree nodes instead of loosely shaped objects:

```ts
type TreeNodeKind =
  | 'workspace'
  | 'category'
  | 'pullRequest'
  | 'section'
  | 'fileChange'
  | 'comment';
```

Each node should provide:

- stable `id`
- `TreeItemCollapsibleState`
- command
- context value for menus
- lazy child loading

### Why This Matches the GitHub Extension Style

The GitHub PR extension uses tree navigation as the entry point for:

- query-based PR grouping
- repository-aware context
- quick actions from context menus
- expansion into review-relevant child nodes

We should keep the same interaction model, but avoid copying its internals directly. The point is UX parity, not code parity.

## Extension Activation Model

Recommended activation events:

- on view open
- on command execution
- on Git repository availability

Suggested contributions:

```json
{
  "activationEvents": [
    "onView:gitcodePullRequests",
    "onCommand:gitcode.signIn",
    "onCommand:gitcode.refreshPullRequests"
  ]
}
```

`extension.ts` should compose services in this order:

1. `common` infrastructure
2. `authentication` service
3. `gitcode` client/services
4. `view` registrations

This keeps startup deterministic and testable.

## State and Refresh Flow

### State Sources

- VS Code secret storage for credentials
- VS Code workspace state for lightweight UI preferences
- In-memory cache for current repo, PR list, and expanded PR details

### Refresh Triggers

- sign in / sign out
- branch or repository change
- explicit refresh command
- PR detail panel opened

### Refresh Strategy

- PR list can use short-lived cache
- PR detail, files, and comments load lazily on expand/open
- Avoid fetching comments/files for every PR in the list

This matters because tree views degrade quickly if all PR children are eagerly loaded.

## Proposed Domain Models

Keep domain models minimal and UI-oriented.

```ts
export interface GitCodeRepository {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch?: string;
  htmlUrl?: string;
}

export interface PullRequestSummary {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  createdAt: string;
  updatedAt: string;
  sourceBranch: string;
  targetBranch: string;
  isDraft?: boolean;
}

export interface PullRequestFileChange {
  path: string;
  status: string;
  additions?: number;
  deletions?: number;
}

export interface PullRequestComment {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  filePath?: string;
  line?: number;
  resolved?: boolean;
}
```

The `view` package should consume these models rather than raw REST response objects.

## Commands

Initial commands:

- `gitcode.signIn`
- `gitcode.signOut`
- `gitcode.refreshPullRequests`
- `gitcode.openPullRequest`
- `gitcode.openPullRequestOnWeb`
- `gitcode.copyPullRequestUrl`
- `gitcode.approvePullRequest`
- `gitcode.commentOnPullRequest`

Later commands:

- `gitcode.checkoutPullRequest`
- `gitcode.mergePullRequest`
- `gitcode.requestReview`
- `gitcode.resolveCommentThread`

## Configuration

Recommended settings:

```json
{
  "gitcode.baseUrl": "https://api.gitcode.com",
  "gitcode.webUrl": "https://gitcode.com",
  "gitcode.pullRequests.queries": [],
  "gitcode.pullRequests.pageSize": 20,
  "gitcode.trace.server": "off"
}
```

Notes:

- `gitcode.pullRequests.queries` should mirror the GitHub extension concept so users can customize tree sections later.
- `baseUrl` and `webUrl` should stay configurable in case enterprise/self-hosted variants appear later.

## Error Handling

Centralize user-facing error categories:

- `NotSignedIn`
- `RepositoryNotOnGitCode`
- `AuthenticationFailed`
- `RateLimited`
- `PermissionDenied`
- `PullRequestNotFound`
- `UnknownApiError`

Rules:

- `gitcode` throws typed errors
- `view` decides whether to show notification, status item, or silent retry
- auth failures should offer re-login actions

## Testing Strategy

### Unit Tests

- remote parsing
- repository resolution
- auth session storage
- API response mapping
- tree node generation

### Integration Tests

- mocked GitCode client for PR listing
- tree expansion behavior
- auth change refresh behavior

### Manual Verification

- PAT sign-in
- open workspace with GitCode remote
- PR list renders in tree
- expand PR to load files/comments
- approve/comment action calls the correct API

## Suggested Initial Folder Layout

```text
src/
  extension.ts
  authentication/
  common/
  gitcode/
  view/
  test/
```

More detailed shape:

```text
src/
  extension.ts
  authentication/
    authService.ts
    patAuthProvider.ts
    oauthProvider.ts
    sessionStore.ts
  common/
    configuration.ts
    constants.ts
    errors.ts
    logger.ts
    models/
    git/
      remoteParser.ts
      repositoryContext.ts
  gitcode/
    client/
      gitcodeClient.ts
      request.ts
    services/
      pullRequestService.ts
      repositoryService.ts
      commentService.ts
      reviewService.ts
      userService.ts
    resolver/
      gitcodeRepositoryResolver.ts
    mappers/
  view/
    commands/
    tree/
      pullRequestTreeDataProvider.ts
      nodes/
    panels/
    state/
  test/
```

## Implementation Phases

### Phase 1: Foundation

- Replace the scaffold command-only extension
- Add settings, logging, error model
- Add PAT sign-in and token validation
- Detect GitCode repository from git remote

### Phase 2: PR Tree View

- Add activity bar container and `Pull Requests` tree view
- Implement category nodes:
  - created by me
  - assigned to me
  - all open
- Load PR list from active repository

### Phase 3: PR Detail Expansion

- Expand PR nodes into summary, files, and conversation
- Add commands for open in web and refresh
- Add comments display

### Phase 4: Review Actions

- submit comment
- approve/review action
- basic state refresh after actions

### Phase 5: Advanced UX

- checkout PR branch
- notifications
- reviewers view
- custom query definitions
- richer review panel/webview

## Key Design Decisions

1. Start with PAT, not OAuth-first.
   PAT is directly documented and simpler for the first milestone. OAuth stays behind the same provider abstraction.

2. Keep `gitcode` separate from `view`.
   This prevents UI code from becoming the de facto API layer.

3. Model tree nodes explicitly.
   A PR-centered tree view becomes hard to maintain if nodes are ad hoc objects.

4. Resolve repository context once, then reuse it.
   Most extension actions depend on `owner/repo`; this should be a first-class object, not repeatedly parsed from remotes.

5. Load PR children lazily.
   Files and comments should not block the main PR list.

## Open Questions

These should be confirmed before implementation of later phases:

- Does GitCode expose a complete reviewer-assignment API equivalent to GitHub's PR reviewer flows?
- Is there a dedicated mergeability/checks endpoint needed for richer status nodes?
- Are there enterprise/self-hosted GitCode deployments that require different base URLs or auth rules?
- Does GitCode provide enough diff metadata to support inline review decorations in editors, or should that wait until a later phase?

## Recommendation

Use this architecture for the first implementation:

- `authentication` for PAT-first sign-in with future OAuth compatibility
- `common` for models, errors, config, and git remote resolution
- `gitcode` for all REST API integration
- `view` for tree views, commands, and detail presentation

That gives a clean path to build a GitHub-PR-style tree view now without locking the extension into a fragile UI-driven design.
