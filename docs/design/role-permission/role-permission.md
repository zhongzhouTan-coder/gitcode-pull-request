# Role Permission Design

## Goal

Add a role-permission design that complements the current repository permission
system described in [permission-control](../permission-control/design.md).

The current extension already makes authorization decisions from GitCode's
repository self-permission endpoint:

```text
GET /api/v5/repos/:owner/:repo/collaborators/self-permission
```

That endpoint returns concrete permission points such as `issue:create`,
`pr:update`, and `note:resolve`. Those permission points remain the source of
truth for UI gating and command enforcement.

For this design, role permission only covers the extension workflows around
issues and pull requests:

- issue create, update, close, and reopen
- issue comments used inside issue workflows
- pull request create, update, close, and reopen
- pull request review, approve, merge, and test capability display
- pull request comments, replies, and discussion resolution
- pull request related-issue updates

Role permission adds a higher-level layer for:

- explaining the user's effective role in the UI
- documenting default GitCode role capabilities for issue and pull request
  workflows
- centralizing role metadata and role ordering
- supporting future role-aware UX without coupling views to raw API DTOs

Role permission must not replace permission-point checks. A role is descriptive
and useful for defaults; the effective permission snapshot is authoritative.

## Design Principles

- Keep authorization decisions based on effective permission points.
- Treat roles as metadata and capability presets, not as a security boundary.
- Keep GitCode API DTOs inside `gitcode/services` and `gitcode/mappers`.
- Keep domain models in `common`.
- Keep UI-specific permission view models in `view/permissions`.
- Preserve unknown roles, scopes, and actions so the extension does not break
  when GitCode adds new permissions.
- Prefer additive behavior: new role support should extend the existing
  permission architecture rather than fork it.
- Keep the modeled permission surface limited to issue and pull request
  workflows. Other GitCode resources remain out of scope unless an issue or pull
  request feature directly depends on them.

## Relationship To Current Permission Control

The existing permission flow is:

```text
VS Code commands / panels / webviews
  -> PermissionStore
  -> PermissionService
  -> GitCodeClient
  -> GitCode self-permission API
```

Role permission extends the mapped snapshot:

```text
GitCode self-permission API
  -> role_info
  -> GitCodeRoleInfo
  -> RolePermissionProfile
  -> UI labels, role ordering, default capability documentation

GitCode self-permission API
  -> resource_trees[].actions[]
  -> GitCodePermissionSnapshot.has(scope, action)
  -> command and UI enforcement
```

The extension should answer "can the user do this?" with the effective
client-side authorization rule: action permission OR role default OR applicable
object ownership rule. It may answer "what role does the user appear to have?"
with `snapshot.role`.

## Role Model

GitCode exposes role metadata in `role_info`:

```ts
export interface GitCodeRoleInfo {
  roleUuid?: string;
  name?: string;
  displayName?: string;
  rolesType?: number;
  accessLevel?: number;
}
```

Add a normalized role key for extension code that needs stable role categories:

```ts
export type GitCodeRoleKey =
  | 'owner'
  | 'maintainer'
  | 'developer'
  | 'reporter'
  | 'guest'
  | 'unknown';

export interface RolePermissionProfile {
  key: GitCodeRoleKey;
  name: string;
  displayName: string;
  accessLevel?: number;
  rank: number;
  defaultPermissions: readonly PermissionRequirement[];
}
```

Suggested rank order:

| Role key | Rank | Typical access level | Description |
| --- | ---: | ---: | --- |
| `owner` | 50 | 50 | Repository or organization administrator with full management permissions. |
| `maintainer` | 40 | 40 | Maintains repository content, members, issues, pull requests, and release flow. |
| `developer` | 30 | 30 | Writes code, opens pull requests, reviews, and participates in development. |
| `reporter` | 20 | 20 | Reports issues, comments, tests, and participates in project discussion. |
| `guest` | 10 | 10 | Has minimal project participation permissions. |
| `unknown` | 0 | unknown | Fallback for missing or unrecognized role metadata. |

Normalization should prefer stable server fields when available:

1. Match `role_info.name` case-insensitively.
2. If name is missing or unknown, match `role_info.access_level`.
3. Otherwise return `unknown` and preserve the raw role fields.

## Issue And Pull Request Role Matrix

This matrix documents default role capabilities for issue and pull request
workflows only. It is not the enforcement source. GitCode's returned
`resource_trees[].actions[].selected` values are the effective permissions for
the current user and repository.

| Resource | Owner | Maintainer | Developer | Reporter | Guest |
| --- | --- | --- | --- | --- | --- |
| Issues | create, update, reopen, pin, lock | create, update, reopen, pin, lock | create, reopen | create, reopen | create |
| Pull Requests | create, update, review, approve, merge, close, reopen, test | create, update, review, approve, merge, close, reopen, test | create, review, merge, close, test | test | - |
| Issue and PR comments | create, resolve | create, resolve | create, resolve | create, resolve | create |

Action naming should follow the API action string where possible:

- issue close and reopen both use `issue:reopen` because the API labels this
  permission as close/reopen
- comment creation uses `note:create`
- comment resolution uses `note:resolve`
- pull request close and reopen use `pr:close` and `pr:reopen`

The following resources are intentionally not modeled here: organization,
repository settings, code push/download, members, labels, milestones, branches,
tags, discussions outside issue or pull request workflows, kanban boards, wiki,
releases, and pipelines.

## Effective Authorization Rule

For client-side gating, action permissions, role defaults, and object ownership
rules are complementary. They should be evaluated with OR semantics:

```text
allowed =
  snapshot.has(scope, action)
  || roleCanByDefault(snapshot.role, requirement)
  || objectRuleAllows(currentUser, targetObject, requirement)
```

Examples:

```text
can update own pull request =
  snapshot.has('pr', 'update')
  || roleCanByDefault(role, pr:update)
  || pullRequest.author.login === currentUser.login

can update own issue =
  snapshot.has('issue', 'update')
  || roleCanByDefault(role, issue:update)
  || issue.author.login === currentUser.login
```

This OR result is only a client-side decision to enable the UI or allow the
command to proceed. GitCode's write API remains the final authority and may
still reject the request.

## Common Object Rules

These rules are object-level rules, not role defaults. They should be applied
only when the relevant API or domain data is available:

- Issue and pull request creators may update their own title and description and
  may close or reopen their own issue or pull request when GitCode allows it.
- Comment authors may edit their own comments when GitCode allows it.
- Security issues are visible only to the issue author and project members.
- Resolving a comment means resolving a marked pull request review discussion.

These rules should live in shared permission helpers, not as one-off shortcuts
inside individual views. If the self-permission API does not expose an
object-specific rule, use the local object data to decide whether to enable the
client action, then let the write API remain authoritative and surface its
error.

## Architecture

Use clean architecture boundaries:

```text
common
  role and permission domain types

gitcode/services
  API access only

gitcode/mappers
  raw API DTO -> domain models

view/state
  repository-scoped permission snapshot cache

view/permissions
  permission checks, role helpers, UI permission view models, messages

views / commands / webviews
  consume view models and call permission helpers before write actions
```

Dependency rule:

```text
view -> common, view/state, view/permissions
view/state -> common, gitcode/services
gitcode/services -> common, gitcode/client, gitcode/mappers
gitcode/mappers -> common
common -> no project layer
```

No view, command, or webview should inspect `role_info` or
`resource_trees` directly.

## Proposed Files

Extend the existing permission implementation with role helpers:

```text
src/common/models.ts
  GitCodeRoleKey
  RolePermissionProfile
  existing GitCodeRoleInfo
  existing GitCodePermissionSnapshot

src/gitcode/mappers/permissionMapper.ts
  map role_info into GitCodeRoleInfo
  preserve unknown role fields

src/view/permissions/rolePermissionProfiles.ts
  static default role profiles and issue/pull request role matrix
  normalizeRoleKey(role)
  getRolePermissionProfile(role)

src/view/permissions/permissionHelpers.ts
  build UI permission view models from effective snapshots
  may include role display fields for UI context
```

Do not add ad hoc role checks to every command. Commands should call a shared
permission helper that applies the effective authorization rule consistently.

## Domain API

Role helper functions should be small and deterministic:

```ts
export function normalizeRoleKey(role: GitCodeRoleInfo | undefined): GitCodeRoleKey;

export function getRolePermissionProfile(
  role: GitCodeRoleInfo | undefined,
): RolePermissionProfile;

export function roleCanByDefault(
  role: GitCodeRoleInfo | undefined,
  requirement: PermissionRequirement,
): boolean;
```

Usage rule:

- `snapshot.has(scope, action)`, `roleCanByDefault`, and object ownership rules
  are combined with OR semantics for client-side command enforcement and
  disabled UI state.
- `roleCanByDefault` must not override server write responses.
- object ownership rules must be evaluated from trusted API/domain data, such
  as the issue author, pull request author, or comment author loaded from
  GitCode.

## UI Usage

Role metadata can improve user-facing context without changing authorization:

- show the current role name in repository details or diagnostics
- include role name in debug logs when permissions are loaded
- group future settings or diagnostics by role profile
- explain why a user may expect a default capability but does not have it when
  the effective permission snapshot denies it

Recommended display:

```text
Role: Maintainer
Permission source: GitCode repository permissions
```

Avoid messages like:

```text
Maintainers can merge pull requests, so this action is allowed.
```

Use:

```text
You do not have permission to merge pull requests in owner/repo.
```

This keeps user messaging aligned with effective permissions.

## Permission Evaluation

Authorization checks should follow this order:

1. Resolve the repository.
2. Load or refresh the repository permission snapshot from `PermissionStore`.
3. Check the required action permission with `snapshot.has(scope, action)`.
4. If the action permission is missing, check the role default with
   `roleCanByDefault(snapshot.role, requirement)`.
5. If the role default is missing, check object ownership rules when the target
   object is available.
6. If all checks deny the action, block the command or disable the control with
   a clear message.
7. If permission loading fails, allow the action to proceed and let GitCode's
   write API return the final result.
8. Surface server-side `401`, `403`, and `404` errors normally.

The final client-side result is the OR of action permission, role default, and
applicable object ownership rule. The server-side write response still wins.

## Caching

Role metadata should share the existing permission snapshot lifecycle:

- cache by repository `fullName`
- deduplicate concurrent permission requests
- clear on sign-out or authentication changes
- refresh on manual tree refresh
- do not persist across VS Code restarts in the first version

Do not create a separate role cache unless a future API returns role metadata
independently from permission points.

## Testing

Add focused unit tests for role normalization and preservation:

- maps `Owner`, `Maintainer`, `Developer`, `Reporter`, and `Guest` names
- maps known access levels when role name is missing
- returns `unknown` for unrecognized names and preserves raw role info
- keeps unknown permission scopes and actions in the permission snapshot
- verifies role defaults do not mutate `snapshot.has(scope, action)`
- verifies effective checks allow an action when action permission, role
  default, or object ownership allows it

Keep existing permission store and command tests focused on effective
permission checks.

## Migration Plan

1. Keep the existing permission-control behavior unchanged.
2. Add role domain types and role profile helpers.
3. Reuse `GitCodePermissionSnapshot.role` as the role metadata source.
4. Add tests for role normalization and role profile lookup.
5. Optionally expose role display text in repository diagnostics or overview UI.
6. Continue using `PermissionRequirement` for every write action, but evaluate
   it through the shared effective authorization helper.

## Non-Goals

- Editing roles or permission rules.
- Replacing the self-permission API.
- Inferring write access from role name alone.
- Modeling permissions for repository administration, members, labels,
  milestones, branches, tags, wiki, releases, discussions outside issue or pull
  request workflows, kanban boards, or pipelines.
- Modeling branch protection, merge rules, reviewer rules, or CI policies.
- Persisting role permission data independently from permission snapshots.
- Implementing organization-level role administration.
