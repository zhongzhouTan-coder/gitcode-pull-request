# Merge Pull Request Design

## Goal

Add a merge action to the existing pull request overview page.

The feature must:

- use the merge API documented in [api.md](./api.md)
- only allow merge when the pull request is actually mergeable
- respect repository permission points and the current role-permission model
- fit the current PR overview architecture instead of introducing a separate flow

## Scope

### In Scope

- Add a merge action to the pull request overview webview.
- Call:

```text
PUT /api/v5/repos/:owner/:repo/pulls/:number/merge
```

- Gate the merge action on pull request state, mergeability, and permission.
- Refresh the overview, activity, comments, and PR tree after a successful merge.
- Show clear disabled reasons and failure messages.

### Out of Scope

- Auto-merge or merge queue.
- Force merge.
- Merge method picker (`merge`, `squash`, `rebase`) in the first version.
- Branch deletion after merge.
- Local git operations after merge.
- Review submission, approval, or CI rerun actions.

The first version should keep the UX narrow: a standard merge using the server
default merge method.

## User Experience

The merge action belongs in the existing pull request overview action row,
alongside the current state action (`Close pull request` / `Reopen pull request`)
and comment composer controls.

Recommended behavior:

- Open PR and mergeable: show enabled `Merge pull request` button.
- Open PR but not mergeable: show disabled `Merge pull request` button with the
  blocking reason.
- Closed PR: keep merge disabled because only open PRs may be merged.
- Merged PR: keep merge disabled because the action is no longer valid.

On click:

1. Ask for confirmation.
2. Call the merge API.
3. On success, show a confirmation message and refresh the overview so the PR
   state becomes `merged`.
4. On failure, keep the overview open and surface the API error message.

The action should not be hidden when unavailable. It should remain visible but
disabled so users can understand why merge is blocked.

## Merge Availability Rules

Merge is available only when all of the following are true:

1. The pull request state is `open`.
2. The current user is authenticated.
3. The user is allowed to merge the PR by the permission system.
4. The PR is mergeable according to the detail data already loaded by the
   overview.

Use the existing `PullRequestDetail.mergeability` model from the get-request
design as the mergeability source of truth.

The client should treat the PR as mergeable only when:

- `mergeability.mergeable === true`
- `mergeability.canMergeCheck !== false`
- `mergeability.hasConflicts !== true`
- `mergeability.ciPassed !== false`
- `mergeability.reviewPassed !== false`
- `mergeability.reasons.length === 0`

This is intentionally stricter than checking only one field. The overview
already renders these merge blockers individually, so the action should follow
the same interpretation.

### Disabled Reasons

Use concise user-facing messages:

- closed PR: `Only open pull requests can be merged.`
- merged PR: `This pull request has already been merged.`
- missing permission: `You do not have permission to merge pull requests in owner/repo.`
- mergeable flag false: `GitCode reports this pull request is not mergeable.`
- merge check false: `GitCode merge checks are blocking this pull request.`
- conflicts: `This pull request has merge conflicts.`
- CI false: `Required CI checks have not passed.`
- review false: `Required reviews or approvals are not complete.`
- explicit reasons from API: surface the first reason in the disabled tooltip
  and preserve the full reason list in the status card

## Permission And Role Rules

The extension already has a two-layer permission model:

1. repository permission points from the self-permission API
2. role-based fallback from the role permission profiles

Merge should follow the same model.

Required permission point:

```text
pr:merge
```

Role fallback should align with the existing role matrix:

- `owner`: allowed by default
- `maintainer`: allowed by default
- `developer`: allowed by default
- `reporter`: not allowed by default
- `guest`: not allowed by default

Important rules:

- Do not add an ownership shortcut for merge. Being the PR author does not
  imply merge permission.
- Effective permission remains the OR result already used elsewhere in the
  extension:

```text
snapshot.has('pr', 'merge') || roleCanByDefault(role, pr:merge)
```

- GitCode remains the final authority. Even when the client enables merge, the
  server may still reject the request.

## API Contract

Use the endpoint from [api.md](./api.md):

```text
PUT /api/v5/repos/:owner/:repo/pulls/:number/merge
```

Initial request body for v1:

```json
{
  "merge_method": "merge"
}
```

Optional fields from the API doc should stay available in the service layer for
future expansion, but the first UI version does not need to expose custom title,
description, or `force_merge`.

Expected success response:

```json
{
  "sha": "67b4cfaf49d7b26c6a97601df156c66afbfc19e3",
  "merged": true,
  "message": "Pull Request 已成功合并"
}
```

The client should treat `merged !== true` as a failed merge even if the request
returns HTTP 200.

## Architecture

Follow the existing PR overview flow:

```text
merge button in PR overview webview
  -> PullRequestOverviewPanel
  -> PullRequestOverviewStore
  -> PullRequestService
  -> GitCodeClient
  -> GitCode merge API
```

Recommended responsibilities:

- `src/gitcode/services/pullRequestService.ts`
  - add `mergePullRequest(...)`
  - keep request/response DTO handling in the service and mapper layer
- `src/view/overview/pullRequestOverviewStore.ts`
  - expose a merge method that verifies session state and invalidates PR detail cache
- `src/view/overview/pullRequestOverviewPanel.ts`
  - validate merge availability
  - check permission before sending the request
  - handle confirmation, success message, error message, and refresh
- `src/view/overview/overviewHtml.ts`
  - render the merge button
  - render disabled state and tooltip reason
  - post `mergePullRequest` message to the extension host
- `src/view/permissions/*`
  - reuse the existing permission snapshot and role fallback design
  - add `pr:merge` to any overview permission view model needed by the webview

## Validation

Before calling the API, the panel should validate:

- PR detail exists
- PR state is `open`
- merge permission is granted
- mergeability checks pass

If validation fails, do not send the request. Show the user the specific reason.

After a successful merge:

- invalidate cached PR detail
- refresh related comments and operation logs
- refresh the PR tree repository node so the PR moves out of the open list if needed

## Error Handling

The merge action should preserve current extension behavior:

- permission known and denied: block immediately with a warning or disabled UI
- permission unavailable due to API failure: allow the action to proceed and let
  the merge API remain authoritative
- merge API failure: show the returned API error without closing the overview

Examples:

- `403`: user lacks merge permission or branch rules still block merge
- `409`: merge conflict or server-side mergeability changed after the page loaded
- `422`: invalid merge request body or merge rule violation

## Verification

Manual verification should cover:

- open a mergeable PR as a maintainer or developer and merge successfully
- open a PR with conflicts and confirm merge stays disabled
- open a PR with failed or pending CI and confirm merge stays disabled
- open a PR lacking required reviewers/approvers and confirm merge stays disabled
- open the same PR as a reporter or guest and confirm permission blocks merge
- merge a PR successfully and confirm the overview refreshes to `merged`
- trigger a server-side merge failure and confirm the error stays visible in the overview

## Future Extensions

- merge method picker
- custom merge title and description
- force merge when repository settings and admin permission allow it
- post-merge branch cleanup actions
- merge from PR tree context menus or command palette
