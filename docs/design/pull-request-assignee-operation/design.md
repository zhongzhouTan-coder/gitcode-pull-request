# Pull Request Assignee Operation Design

## Goal

Add assignee management to the pull request overview so users can:

- list assignees that are eligible for selection
- assign one or more assignees to the active pull request
- cancel one or more existing assignees from the active pull request

This design covers assignee operations, which are the APIs documented in this
directory. The request wording says "approvers", but the available API
references here are for pull request assignees, not approval-rule approvers.

The feature must keep GitCode API access in `gitcode/services/*`, reuse the
existing pull request overview architecture, and refresh the overview after
assignee mutations succeed.

## Scope

### In Scope

- Add assignee actions to the pull request overview sidebar.
- Add command-palette commands for assign/remove assignee on the active
  overview.
- Use repository collaborators as the selectable assignee source.
- Use VS Code quick pick for assignee selection.
- Refresh pull request detail and operation logs after successful mutations.
- Show permission, loading, empty, and API error states.

### Out of Scope

- Approval-rule approver management.
- Editing reviewers or testers as part of this work.
- Replacing the entire assignee list from a free-form text field.
- Assignee actions from the tree view or issue overview.

## API Contract

Use the documented APIs in this directory:

- [assign-assignee-api.md](./assign-assignee-api.md)
  - `POST /api/v5/repos/:owner/:repo/pulls/:number/assignees`
- [cancel-assignee-api.md](./cancel-assignee-api.md)
  - `DELETE /api/v5/repos/:owner/:repo/pulls/:number/assignees`

Request shapes:

```json
{
  "assignees": "alice,bob"
}
```

```text
DELETE /api/v5/repos/:owner/:repo/pulls/:number/assignees?assignees=alice,bob
```

Design choices:

- There is no documented assignee-options endpoint, so selectable assignees
  should come from `RepositoryService.listMembers()` against
  `GET /api/v5/repos/:owner/:repo/collaborators`.
- The assign API does not document an additive `add: true` flag like the
  reviewer/tester APIs do. The client should therefore treat POST as
  "set current assignees to this list" and preserve existing assignees by
  sending the union of current and newly selected logins.
- The cancel flow uses the dedicated DELETE API with only the logins being
  removed.
- Login payloads should be trimmed, deduplicated, and rejected when empty.
- The pull request author should be excluded from the add picker because the
  creator cannot approve the same pull request.

## User Experience

The pull request overview sidebar `Assignees` section becomes actionable:

```text
Assignees                                              [+]
  Carol @carol                                       [-]
  Dan @dan                                           [-]
```

Behavior:

- `Add assignee` opens a multi-select quick pick populated from repository
  collaborators.
- Already assigned assignees are excluded from the add picker.
- The pull request author is excluded from the add picker.
- If no additional assignees are available, show
  `No additional assignees are available for this pull request.`
- Row-level remove buttons remove a single assignee directly from the sidebar.
- Command-palette remove uses a multi-select quick pick over currently assigned
  assignees.
- Remove actions require confirmation.

Success messages:

- `Assignee added to pull request #123`
- `Assignees added to pull request #123`
- `Assignee removed from pull request #123`
- `Assignees removed from pull request #123`

## Architecture

Flow:

```text
PullRequestOverviewPanel
  -> quick pick / row action
  -> PullRequestOverviewStore
  -> PullRequestService
  -> RepositoryService (selection source only)
  -> GitCodeClient
  -> invalidate PR detail cache
  -> reload overview
```

Responsibilities:

- `PullRequestService`
  - normalize assignee login payloads
  - assign assignees using the POST API
  - remove assignees using the DELETE API
- `PullRequestOverviewStore`
  - enforce authentication
  - list selectable assignees from repository collaborators
  - invalidate cached PR detail after assignee mutations
- `PullRequestOverviewPanel`
  - command routing
  - quick pick selection
  - union current assignees with newly selected logins before POST
  - confirmation UX
  - in-progress sidebar state
  - operation-log refresh
- `overviewHtml.ts`
  - render assignee action buttons
  - permission tooltips
  - webview message wiring

Implementation notes:

- Add a dedicated overview permission such as `canUpdateAssignees` even if it
  currently maps to the same `pr:update` capability as reviewers, testers, and
  related issues.
- Prefer extracting shared participant-action helpers in
  `pullRequestOverviewPanel.ts` and `overviewHtml.ts` where practical. Assignee
  support otherwise becomes a third near-copy of reviewer/tester logic.
- `PullRequestOverviewStore` already accepts an optional `RepositoryService`.
  If that service is unavailable, assignee selection should fail gracefully with
  a user-facing error instead of rendering a broken picker.

## Files

Updated:

```text
src/common/constants.ts
src/common/models.ts
src/gitcode/services/pullRequestService.ts
src/view/commands/registerOverviewCommands.ts
src/view/overview/overviewHtml.ts
src/view/overview/pullRequestOverviewPanel.ts
src/view/overview/pullRequestOverviewStore.ts
src/view/permissions/permissionHelpers.ts
src/test/overviewHtml.test.ts
src/test/pullRequestOverviewPanel.test.ts
src/test/pullRequestOverviewStore.test.ts
src/test/pullRequestService.test.ts
package.json
```

Added:

```text
docs/design/pull-request-assignee-operation/design.md
```

## Validation

Covered by tests:

- store authentication, collaborator-backed assignee listing, and cache
  invalidation
- assignee login normalization and POST/DELETE request shaping
- assignee quick-pick filtering helpers, including author exclusion
- overview HTML action rendering and permission guards
- add/remove assignee panel flows, including success and error messages
- full extension test suite via `npm test`
