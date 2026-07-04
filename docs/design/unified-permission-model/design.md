# Unified Permission Model Design

## Goal

Unify the extension's three permission patterns under one authorization model:

1. role-based permission
2. action-type permission
3. resource-creator permission

The model should support issue and pull request workflows without scattering
authorization logic across panels, commands, and UI helpers.

## Background

The current extension already has a repository-scoped permission system based on
GitCode's self-permission API:

```text
GET /api/v5/repos/:owner/:repo/collaborators/self-permission
```

It also has:

- role metadata from `role_info`
- action-level permission points such as `issue:create` and `pr:update`
- object-level exceptions for some issue and pull request authors

Those three sources exist today, but they are not modeled consistently.

## Current State

### What Already Works

- `PermissionService` fetches repository permission data from GitCode.
- `PermissionStore` caches permission snapshots by repository.
- `GitCodePermissionSnapshot.has(scope, action)` provides a simple action lookup.
- role normalization and role profiles exist for known GitCode roles.

These are good foundations and should remain.

### Current Weak Points

#### 1. Evaluation logic is too primitive

The current evaluation rule is effectively:

```text
allowed =
  snapshot.has(scope, action)
  || roleCanByDefault(role, requirement)
  || objectRuleAllows
```

This is easy to use, but it conflates:

- authoritative server permission points
- role metadata and presets
- object-level ownership rules

That works for a small feature set, but it becomes brittle as more workflows are
added.

#### 2. Role is treated as a direct allow source

The current implementation allows role defaults to grant permission directly.
That is too broad.

Role should not be the primary enforcement source when the repository
self-permission API already returns concrete permission points. At most, role
should be:

- descriptive metadata for the UI
- a fallback when permission-point data is incomplete or not exposed

If role remains a first-class allow source everywhere, the extension can drift
away from the effective repository permissions returned by GitCode.

#### 3. Resource-creator rules are duplicated in views

Issue author and pull request author rules are currently computed in overview
panels and then passed around as booleans.

That means:

- ownership rules are not centralized
- the same logic is duplicated across issue and pull request flows
- future rules for comment authors or other object owners will likely repeat the
  same pattern

This is the main gap in the current design.

#### 4. The system is centered on raw `scope/action`, not business operations

Most callers ask permission questions like:

- can edit pull request title/body?
- can close this issue?
- can update reviewers?

But the permission layer still exposes raw checks like:

```ts
{ scope: 'pr', action: 'update' }
```

This forces business rules into the UI layer.

## Design Decision

Refactor the permission evaluation layer, but keep the data-fetching and caching
layer.

### Keep As-Is

- `gitcode/services/permissionService.ts`
- `gitcode/mappers/permissionMapper.ts`
- `view/state/permissionStore.ts`
- `GitCodePermissionSnapshot` as the raw repository permission snapshot

### Refactor

- `view/permissions/permissionHelpers.ts`
- direct `scope/action` checks in commands, panels, and webviews
- ad hoc resource-owner logic in issue and pull request panels
- role-based direct authorization

## Proposed Model

Introduce a domain-level authorization evaluator built around business
operations instead of raw permission points.

### Core Types

```ts
export type PermissionOperation =
  | 'issue.create'
  | 'issue.editContent'
  | 'issue.changeState'
  | 'issue.comment.create'
  | 'pr.create'
  | 'pr.editContent'
  | 'pr.changeState'
  | 'pr.comment.create'
  | 'pr.comment.edit'
  | 'pr.comment.resolve'
  | 'pr.reviewers.update'
  | 'pr.testers.update'
  | 'pr.relatedIssues.update'
  | 'branch.create';

export interface PermissionContext {
  repository: GitCodeRepository;
  snapshot?: GitCodePermissionSnapshot;
  actor?: {
    login?: string;
    role?: GitCodeRoleKey;
  };
  resource?: {
    kind: 'issue' | 'pr' | 'comment';
    authorLogin?: string;
    creatorLogin?: string;
  };
}

export interface PermissionDecision {
  allowed: boolean;
  source:
    | 'permission-point'
    | 'ownership-rule'
    | 'role-fallback'
    | 'unknown';
  message: string;
}
```

## Evaluation Rules

Authorization should be expressed per operation, not per view.

### Rule Priority

Recommended evaluation order:

1. check explicit repository permission point
2. apply operation-specific ownership rule
3. apply role fallback only when the permission point is unavailable or not
   modeled
4. otherwise deny

### Important Constraint

If the repository permission snapshot explicitly denies an action, role should
not override that deny.

This keeps GitCode repository permissions authoritative.

### Examples

#### Edit pull request title/body

```text
allowed if:
  pr:update
  OR current user is the pull request creator
```

#### Close or reopen issue

```text
allowed if:
  issue:reopen
  OR current user is the issue creator
```

#### Update reviewers

```text
allowed if:
  pr:update
```

Resource ownership should not grant this operation.

#### Edit comment

```text
allowed if:
  comment update permission exists and is granted
  OR fallback mapping allows note:create for edit
  OR current user is the comment author when local ownership rules apply
```

This operation should be defined centrally, not as a special case in the panel.

## Source Semantics

The three permission sources should not have equal weight.

### 1. Action-Type Permission

This is the primary authorization source.

Examples:

- `issue:create`
- `issue:update`
- `issue:reopen`
- `pr:create`
- `pr:update`
- `pr:close`
- `pr:reopen`
- `note:create`
- `note:resolve`
- `branch:create`

### 2. Resource-Creator Permission

This is a business exception layer for specific operations on a specific object.

Examples:

- issue creator can edit issue title/body
- issue creator can close or reopen own issue
- pull request creator can edit title/body
- pull request creator can close or reopen own pull request
- comment creator can edit own comment

This source should be operation-specific. It must not become a broad bypass.

### 3. Role-Based Permission

This is the weakest source.

It should be used for:

- UI explanation
- role badges or labels
- documented default capability profiles
- limited fallback behavior when GitCode does not expose a concrete action point

It should not broadly override repository action permissions.

## Architecture

### Data Layer

No major changes:

```text
GitCode API
  -> PermissionService
  -> permissionMapper
  -> GitCodePermissionSnapshot
  -> PermissionStore
```

### Evaluation Layer

Add a dedicated evaluator:

```text
PermissionStore
  -> PermissionEvaluator
  -> PermissionDecision
```

Suggested files:

```text
src/view/permissions/
  permissionEvaluator.ts
  permissionOperations.ts
  ownershipRules.ts
  permissionMessages.ts
```

### UI and Command Layer

Callers should ask:

```ts
evaluatePermission('pr.editContent', context)
```

instead of:

```ts
checkPermission(store, repository, { scope: 'pr', action: 'update', ... })
```

This moves operation policy out of view code.

## Ownership Rules

Ownership rules should be centralized in one helper.

Examples:

```ts
canEditOwnIssue(actor, issue)
canChangeOwnIssueState(actor, issue)
canEditOwnPullRequest(actor, pr)
canChangeOwnPullRequestState(actor, pr)
canEditOwnComment(actor, comment)
```

The helper should normalize logins once and keep the matching logic out of the
panels.

## Migration Plan

### Step 1

Add operation-level permission types and a new evaluator without removing the
existing snapshot model.

### Step 2

Move issue and pull request author rules out of overview panels into shared
ownership helpers.

### Step 3

Replace direct `scope/action` checks in commands and views with
`PermissionOperation` checks.

### Step 4

Limit role-based direct allow behavior so role becomes metadata plus controlled
fallback, not a blanket grant source.

### Step 5

Add unit tests for the operation matrix:

- issue create
- issue edit by owner
- issue state change by owner
- pull request create
- pull request edit by owner
- pull request state change by owner
- reviewer/tester/related-issue updates
- comment create/edit/resolve
- unknown permission snapshot behavior

## Non-Goals

- changing the GitCode API contract
- organization-level authorization
- branch protection or merge-rule modeling
- server-side enforcement changes
- replacing API `403` handling with client-only authorization

## Recommendation

Yes, the current design should be refactored, but only at the evaluation layer.

Do not replace the repository permission service or store. Instead, build a
unified authorization model on top of them with:

- operation-level policy
- centralized ownership rules
- repository permission points as the primary authority
- role as metadata and controlled fallback

That gives one model that can express all three permission patterns without
continuing to spread authorization logic through the UI.
