# Permission Control Design

## Goal

Add repository-scoped permission control to the GitCode VS Code extension using
the self-permission API documented in [api.md](api.md).

The feature must:

- fetch the current member's repository permission points from GitCode
- expose a typed permission snapshot to stores, commands, webviews, and panels
- disable UI actions the current user is not allowed to perform and explain the
  missing permission with a consistent tooltip pattern
- block protected commands before issuing write API requests
- keep API access inside `gitcode/services/*`, not in the view layer
- preserve read-only behavior for users without write permissions
- avoid treating permission checks as a security boundary because GitCode remains
  the final authority

The first version should focus on the extension's current write flows:

- create issue
- edit issue
- create issue comment
- create issue branch
- create pull request
- edit pull request
- close or reopen pull request
- create pull request comments and replies
- edit pull request comments
- resolve or unresolve pull request diff discussions
- add or remove issues related to a pull request
- create branch from the create pull request flow

## Scope

### In Scope

- Add a `PermissionService` backed by:

```text
GET /api/v5/repos/:owner/:repo/collaborators/self-permission
```

- Add typed permission models in `src/common/models.ts`.
- Map API `resource_trees[].scope`, `actions[].action`, and
  `actions[].selected` into a lookup keyed by `scope:action`.
- Cache permission snapshots per repository for the current session.
- Expose a repository-scoped `PermissionStore` for view-layer consumers.
- Load permissions after repository resolution for issue and pull request trees.
- Refresh permissions on manual tree refresh and after sign-in changes.
- Gate command entry points before opening forms, panels, or making write
  requests where the target repository is already known.
- Pass permission snapshots into webview HTML so controls can render disabled
  states and permission tooltips consistently.
- Show clear messages when an action is unavailable due to missing permission.
- Continue to handle server-side `403` or `404` responses as the source of truth
  when cached permissions are stale or incomplete.

### Out of Scope

- Editing repository roles or permission rules.
- Organization-level permission management.
- Branch protection, merge rule, reviewer rule, or CI policy modeling.
- Fine-grained object ownership checks not present in the self-permission API.
- Offline permission persistence across VS Code restarts.
- Replacing API error handling with client-side checks.
- Permission control for features not currently implemented in the extension,
  such as wiki, pipeline, tag, member, or repository settings actions.

## User Experience

Read operations remain available when the user is authenticated and the API
allows the read. Permission control only affects actions that mutate repository
state or open a mutation UI.

Examples:

```text
Issues
  + Create issue        disabled when issue:create is missing
```

```text
Pull Request #123
  [Refresh] [Open on GitCode] [Close pull request]
                              disabled when pr:close is missing
```

```text
Conversation
  Add comment textarea disabled when note:create is missing
```

When a command is invoked from the command palette or via keyboard shortcut and
the user does not have permission, show a warning:

```text
You do not have permission to create issues in owner/repo.
```

For actions inside webviews, render the action control in a disabled state with
a tooltip that explains the missing permission. Use a wrapper element around
natively disabled controls when the tooltip must still respond to hover or
focus. This includes icon-only buttons, row actions, edit pencils,
comment/reply controls, state buttons, related issue add/remove actions, and
the final create pull request submit button. Do not hide permission-gated
controls unless the feature is not available for reasons unrelated to
permission, such as missing data or an unsupported object state.

Recommended messages:

| Action | Message |
| --- | --- |
| Create issue | `You do not have permission to create issues in owner/repo.` |
| Edit issue | `You do not have permission to update issues in owner/repo.` |
| Create pull request | `You do not have permission to create pull requests in owner/repo.` |
| Edit pull request | `You do not have permission to update pull requests in owner/repo.` |
| Close pull request | `You do not have permission to close pull requests in owner/repo.` |
| Reopen pull request | `You do not have permission to reopen pull requests in owner/repo.` |
| Add comment | `You do not have permission to comment in owner/repo.` |
| Resolve discussion | `You do not have permission to resolve comments in owner/repo.` |
| Create branch | `You do not have permission to create branches in owner/repo.` |

If the permission API fails, the extension should not permanently disable every
write feature. Instead:

- command handlers should allow the action to continue when permission cannot
  be verified and let the write API remain the final authority
- already-visible read views should keep rendering
- overview webviews should keep write controls available when permission state
  is unknown
- server-side write failures should still surface their normal API error
  messages

This keeps the extension usable if the permission endpoint has temporary
availability issues while still preventing accidental writes when permissions
are known.

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/:repo/collaborators/self-permission
```

The service call should be:

```ts
permissionService.getRepositoryPermissions(repository);
```

Suggested domain types:

```ts
export type PermissionScope =
  | 'repo'
  | 'code'
  | 'wiki'
  | 'member'
  | 'issue'
  | 'label'
  | 'milestone'
  | 'branch'
  | 'tag'
  | 'pr'
  | 'note'
  | 'pipeline'
  | 'discussion'
  | 'kanban'
  | string;

export type PermissionAction = string;

export interface GitCodePermissionPoint {
  scope: PermissionScope;
  action: PermissionAction;
  selected: boolean;
  permissionId?: number;
  name?: string;
  displayName?: string;
}

export interface GitCodeRoleInfo {
  roleUuid?: string;
  name?: string;
  displayName?: string;
  rolesType?: number;
  accessLevel?: number;
}

export interface GitCodePermissionSnapshot {
  repository: GitCodeRepository;
  role?: GitCodeRoleInfo;
  permissions: readonly GitCodePermissionPoint[];
  loadedAt: number;
  has(scope: PermissionScope, action: PermissionAction): boolean;
}
```

The mapper should accept unknown or new scopes and actions without throwing. New
server-side permissions should be preserved in the snapshot even if the current
extension does not use them yet.

Mapping rules:

- `role_info.role_uuid` -> `role.roleUuid`
- `role_info.cn_name` -> `role.displayName`
- `role_info.access_level` -> `role.accessLevel`
- each `resource_trees[]` item contributes its `scope`
- each action contributes `action`, `selected`, `permission_id`, `name`, and
  `cn_name`
- `has(scope, action)` returns `true` only when a matching action exists with
  `selected === true`
- missing action means denied, not allowed

## Permission Mapping

Map the current extension's write features to GitCode permission points:

| Feature | Required permission |
| --- | --- |
| Create issue | `issue:create` |
| Edit issue title, body, labels, milestone, state | `issue:update` |
| Close issue | `issue:reopen` |
| Reopen issue | `issue:reopen` |
| Create issue comment | `note:create` |
| Create branch for issue | `branch:create` |
| Create pull request | `pr:create` |
| Edit pull request title, body, labels, milestone, draft, close-related-issue | `pr:update` |
| Close pull request | `pr:close` |
| Reopen pull request | `pr:reopen` |
| Create pull request general or diff comment | `note:create` |
| Reply to pull request discussion | `note:create` |
| Edit pull request comment | `note:create` |
| Resolve or unresolve pull request discussion | `note:resolve` |
| Add related issues to pull request | `pr:update` |
| Remove related issues from pull request | `pr:update` |
| Create branch in create pull request flow | `branch:create` |

Notes:

- The API exposes `pr:review`, `pr:approve`, `pr:merge`, and `pr:test`, but the
  current extension does not yet implement those actions.
- The API exposes `code:push`, but local git push is not currently owned by this
  extension. Do not gate local git commands with `code:push` in this feature.
- Comment editing is mapped to `note:create` because the documented permission
  API does not expose a separate `note:update` action. If GitCode later adds
  `note:update`, switch edit-comment gating to that permission.
- Issue close and reopen are mapped to `issue:reopen` because the API labels the
  action as `关闭/重开`. Use the same permission for both state transitions.

## Architecture

Follow this flow:

```text
VS Code commands / panels / webviews
  -> PermissionStore
  -> PermissionService
  -> GitCodeClient
  -> GitCode permission API
```

Dependency rules:

- `gitcode/services` owns the API call and response mapping.
- `view` can depend on a view-layer permission store and common permission
  models.
- `view` must not inspect raw permission API DTOs.
- `gitcode` must not depend on `view`.
- Permission checks should happen at command and UI boundaries. Service methods
  should remain focused on GitCode API calls and should still expect API-level
  authorization failures.

## Proposed Files

Create or update:

```text
src/common/
  models.ts

src/gitcode/
  services/
    permissionService.ts
  mappers/
    permissionMapper.ts

src/view/
  state/
    permissionStore.ts
  permissions/
    permissionChecks.ts
    permissionMessages.ts
```

Update existing files:

```text
src/view/viewController.ts
src/view/commands/registerIssueCommands.ts
src/view/commands/registerOverviewCommands.ts
src/view/commands/registerTreeCommands.ts
src/view/commands/registerCreatePullRequestCommands.ts
src/view/createIssue/createIssueHelper.ts
src/view/createPullRequest/createPullRequestHelper.ts
src/view/createPullRequest/createPullRequestViewProvider.ts
src/view/issueOverview/issueOverviewPanel.ts
src/view/issueOverview/issueOverviewHtml.ts
src/view/overview/pullRequestOverviewPanel.ts
src/view/overview/overviewHtml.ts
src/view/comments/diffCommentController.ts
src/view/tree/nodeFactory.ts
```

## Permission Service

`PermissionService` should be a thin API wrapper:

```ts
export class PermissionService {
  constructor(private readonly client: GitCodeClient) {}

  async getRepositoryPermissions(
    repository: GitCodeRepository,
  ): Promise<GitCodePermissionSnapshot> {
    const response = await this.client.get<any>(
      `/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/collaborators/self-permission`,
    );
    return mapPermissionSnapshot(repository, response);
  }
}
```

The mapper should build both:

- an ordered list for debugging or future display
- an internal lookup for fast `has(scope, action)` checks

Implementation detail:

```ts
const key = `${scope}:${action}`;
```

The key builder should be centralized so callers do not repeat string
concatenation.

## Permission Store

`PermissionStore` should cache by repository `fullName`:

```ts
export class PermissionStore {
  get(repository: GitCodeRepository): Promise<GitCodePermissionSnapshot>;
  peek(repository: GitCodeRepository): GitCodePermissionSnapshot | undefined;
  refresh(repository: GitCodeRepository): Promise<GitCodePermissionSnapshot>;
  refreshAll(repositories: readonly GitCodeRepository[]): Promise<void>;
  clear(): void;
}
```

Behavior:

- `get` returns the cached snapshot when present.
- `refresh` always calls the API and replaces the cached snapshot.
- concurrent calls for the same repository should share one in-flight request.
- `clear` runs on sign-out or authentication session changes.
- manual tree refresh should refresh repository permissions so UI action
  availability can be recomputed from fresh snapshots.

The store should not apply a long time-based TTL in the first version. Manual
refresh and auth changes are enough for current usage, and server-side `403`
handling remains the fallback for stale permissions.

## Command Enforcement

Add a helper that checks permission before write commands proceed:

```ts
async function requirePermission(
  permissionStore: PermissionStore,
  repository: GitCodeRepository,
  requirement: PermissionRequirement,
): Promise<boolean>;
```

Suggested requirement type:

```ts
export interface PermissionRequirement {
  scope: PermissionScope;
  action: PermissionAction;
  message: (repository: GitCodeRepository) => string;
}
```

Command handlers should call this before opening mutation UI or calling mutation
services:

- `CreateIssueHelper.create()` checks `issue:create` after repository selection
  and before opening the form.
- `createBranchForIssue` checks `branch:create` before prompting for branch
  name.
- pull request overview state actions check `pr:close` or `pr:reopen` before
  submitting.
- pull request and issue edit submissions check their relevant update
  permissions before calling services.
- comment submission, reply, edit, and resolve commands check `note:create` or
  `note:resolve`.

If a permission check fails, stop before any write API call.

## UI Gating

### Trees

Tree view title actions should reflect the selected or active repository when
that can be determined. Because VS Code view title command enablement is global,
do not rely only on `when` clauses for repository-specific permissions.

Command handlers still perform the final check.

For context menus on repository or issue nodes:

- disable create branch with a permission tooltip when the node repository lacks
  `branch:create`, when the VS Code contribution point can express that state
- disable edit or state actions with permission tooltips when the repository has
  the corresponding permission state available
- keep open/view/copy actions available

### Create Issue

Before opening the create issue panel:

- resolve repositories
- choose the target repository when multiple are available
- load `issue:create`
- if denied, show the warning and do not open the form

The create issue webview does not need to render a disabled submit button for
known-denied permissions because it should not open in that state. If permission
loading fails after the form is open, submission should re-check and surface the
failure.

### Create Pull Request

Before initializing `CreatePullRequestViewProvider`:

- resolve all candidate repositories
- refresh permission snapshots for those repositories
- allow the form to open even if the selected target repository does not grant
  `pr:create`, because cross-repository pull request creation can still be
  valid when the selected source repository grants that permission

The provider should receive a small permission view model:

```ts
interface CreatePullRequestPermissions {
  canCreatePullRequest: boolean;
  canCreateBranch: boolean;
}
```

Behavior:

- `canCreatePullRequest` and `canCreateBranch` are computed from the current
  source repository, not the target repository
- the final submit button in the create pull request page is disabled when
  `canCreatePullRequest` is false and uses the same wrapper-based permission
  tooltip pattern as overview pages
- changing the source repository recomputes the permission view model and
  updates the submit button and branch-creation affordances
- branch creation remains optional inside the flow and is disabled only when
  the source repository lacks `branch:create`
- submit handlers still re-check `pr:create` on the current source repository
  before calling the create pull request API

### Pull Request Overview

Pass an `OverviewPermissions` object into `overviewHtml`:

```ts
interface PullRequestOverviewPermissions {
  canEditPullRequest: boolean;
  canClosePullRequest: boolean;
  canReopenPullRequest: boolean;
  canCreateComment: boolean;
  canEditComment: boolean;
  canResolveComment: boolean;
  canUpdateRelatedIssues: boolean;
}
```

UI behavior:

- disable section edit icons with a tooltip when `canEditPullRequest` is false
- disable draft and close-related-issue toggles with the same tooltip when
  `canEditPullRequest` is false
- disable close/reopen action based on current state and permission
- disable comment composer input and submit button when `canCreateComment` is
  false
- disable reply buttons and reply composer submit controls when
  `canCreateComment` is false
- disable edit-comment buttons when `canEditComment` is false
- disable resolve toggles when `canResolveComment` is false
- disable related issue add/remove controls when `canUpdateRelatedIssues` is
  false

Every webview message handler must re-check permission before calling a write
service because the DOM can be modified by users.

### Issue Overview

Pass an `IssueOverviewPermissions` object into `issueOverviewHtml`:

```ts
interface IssueOverviewPermissions {
  canEditIssue: boolean;
  canCloseIssue: boolean;
  canReopenIssue: boolean;
  canCreateComment: boolean;
}
```

UI behavior:

- disable issue edit controls with a tooltip when `canEditIssue` is false
- disable close/reopen based on current state and permission
- disable comment composer input and submit button when `canCreateComment` is
  false

As with pull requests, webview message handlers must re-check permissions before
write service calls.

## Error Handling

Permission API failure states:

- unauthenticated: existing auth flow should surface `Sign in to GitCode first.`
- `403`: log the failure and fall back to server-side write enforcement
- `404`: treat as repository inaccessible and keep existing repository error
  behavior
- network or malformed response: log debug details and fall back to cached or
  optimistic UI behavior

Write API failure states:

- if a write call still returns `403`, show the API error and refresh the
  permission snapshot for that repository in the background
- if a write call succeeds despite a stale denied snapshot, refresh permissions
  on the next manual refresh rather than forcing an immediate UI rebuild

The mapper should tolerate missing `resource_trees` by returning a valid empty
permission snapshot. Empty means no write permissions.

## Refresh and Authentication

Hook cache invalidation into existing lifecycle points:

- sign-out: `permissionStore.clear()`
- sign-in session change: `permissionStore.clear()`
- pull request tree refresh: refresh permissions for resolved repositories
- issue tree refresh: refresh permissions for resolved repositories
- create pull request command open: refresh permissions for resolved candidate
  repositories before initializing the provider
- after a server-side `403` on a write API: refresh that repository permission
  snapshot

If both issue and pull request trees resolve the same repository, they should
share the same `PermissionStore` instance from `ViewController`.

## Testing

Add focused unit tests:

```text
src/test/permissionMapper.test.ts
src/test/permissionStore.test.ts
```

Mapper tests:

- maps `role_info` fields
- maps selected and unselected actions
- `has(scope, action)` is true only for selected actions
- unknown scopes and actions are preserved
- missing or malformed `resource_trees` returns an empty snapshot

Store tests:

- caches snapshots by repository full name
- `refresh` replaces stale data
- concurrent `get` calls share one in-flight service call
- `clear` removes cached snapshots
- API failures do not poison the cache permanently

Update existing webview and command tests where permissions affect rendering:

- create issue command does not open form without `issue:create`
- create pull request submit checks `pr:create` against the current source
  repository
- create pull request branch creation checks `branch:create` against the
  current source repository
- pull request overview disables edit controls without `pr:update`
- pull request overview disables close or reopen without `pr:close` or
  `pr:reopen`
- comment composer is disabled without `note:create`
- resolve toggles are disabled without `note:resolve`
- issue overview edit and comment controls follow `issue:update` and
  `note:create`
- permission-tooltipped disabled controls use the wrapper-based custom tooltip
  pattern consistently across create pull request, issue overview, and pull
  request overview

Use test snapshots or lightweight fake stores instead of calling the GitCode
permission API.

## Rollout Plan

1. Add permission domain models, mapper, service, and unit tests.
2. Add shared `PermissionStore` in `ViewController` and cache invalidation on
   auth changes.
3. Gate top-level create commands: create issue and create branch for issue.
4. Pass permission view models into issue and pull request overview panels.
5. Gate webview rendering and webview message handlers.
6. Gate create pull request submit and branch helper controls from the current
   source repository permission model.
7. Add tests for command blocking and overview rendering.
8. Manually verify with accounts that have Owner, Developer, Reporter, and
   guest/read-only style roles.

## Open Questions

- Does GitCode expose separate ownership-sensitive permissions for editing or
  deleting a user's own comments? The current API only documents `note:create`
  and `note:resolve`.
- Should `pr:review` or `pr:approve` be required for creating diff comments, or
  is `note:create` sufficient? The current extension treats comments as notes,
  so the first version should use `note:create`.
- Does `issue:reopen` intentionally cover both close and reopen? The API
  Chinese name says `关闭/重开`, so the first version should use it for both
  transitions.
- Should manual refresh always call the permission endpoint before list APIs, or
  should it run in parallel to keep trees responsive? The safer first version is
  parallel loading with command-level checks as the final gate.
