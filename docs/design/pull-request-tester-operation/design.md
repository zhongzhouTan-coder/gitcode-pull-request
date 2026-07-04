# Pull Request Tester Operation Design

## Goal

Add tester management to the pull request overview so users can:

- list testers that are eligible for selection
- add one or more testers to the active pull request
- remove one or more existing testers from the active pull request

The feature must keep GitCode API access in `gitcode/services/*`, reuse the
existing pull request overview architecture, and refresh the overview after
tester mutations succeed.

## Scope

### In Scope

- Load selectable testers from the documented tester options API.
- Add an `Add tester` action in the pull request overview sidebar.
- Add a `Remove tester` action for each assigned tester row.
- Add command-palette commands for add/remove tester on the active overview.
- Use VS Code quick pick for tester selection.
- Refresh pull request detail and operation logs after successful mutations.
- Show permission, loading, empty, and API error states.

### Out of Scope

- Editing assignees or reviewers.
- Replacing the full tester list in one submit from the UI.
- Manual free-text tester entry.
- Tester actions from the tree view or issue overview.

## API Contract

Use the documented APIs in this directory:

- [list testers API](./list-testers-api.md)
  - `GET /api/v5/repos/:owner/:repo/pulls/option_testers`
- [assign testers API](./assign-tester-api.md)
  - `POST /api/v5/repos/:owner/:repo/pulls/:number/testers`
- [cancel testers API](./cancel-tester-api.md)
  - `DELETE /api/v5/repos/:owner/:repo/pulls/:number/testers`

Request shapes:

```json
{
  "testers": "alice,bob",
  "add": true
}
```

```json
{
  "testers": "alice,bob"
}
```

Design choices:

- the list endpoint is repository-scoped, so the client must filter out users
  already assigned in `PullRequestDetail.testers`
- the client must also filter out `PullRequestDetail.author.login` from the add
  picker because merge request authors cannot operate their own merge request
- the add flow should use additive semantics and preserve existing testers;
  implementation should send `add: true`, matching the reviewer workflow
- the remove flow uses the dedicated `DELETE` API
- login payloads should be trimmed, deduplicated, and rejected when empty

## User Experience

The pull request overview sidebar `Testers` section becomes actionable:

```text
Testers                                                [+]
  Carol @carol                                       [-]
  Dan @dan                                           [-]
```

Behavior:

- `Add tester` opens a multi-select quick pick populated from
  `option_testers`.
- Already assigned testers are excluded from the add picker.
- The pull request author is excluded from the add picker.
- If no additional testers are available, show
  `No additional testers are available for this pull request.`
- Row-level remove buttons remove a single tester directly from the sidebar.
- Command-palette remove uses a multi-select quick pick over currently assigned
  testers.
- Remove actions require confirmation.

Success messages:

- `Tester added to pull request #123`
- `Testers added to pull request #123`
- `Tester removed from pull request #123`
- `Testers removed from pull request #123`

## Architecture

Flow:

```text
PullRequestOverviewPanel
  -> quick pick / row action
  -> PullRequestOverviewStore
  -> PullRequestService
  -> GitCodeClient
  -> invalidate PR detail cache
  -> reload overview
```

Responsibilities:

- `PullRequestService`
  - list selectable testers
  - add testers
  - remove testers
  - normalize tester login payloads
- `PullRequestOverviewStore`
  - enforce authentication
  - invalidate cached PR detail after tester mutations
- `PullRequestOverviewPanel`
  - command routing
  - quick pick selection
  - add-tester filtering for assigned testers and the pull request author
  - confirmation UX
  - in-progress sidebar state
  - operation-log refresh
- `overviewHtml.ts`
  - render tester action buttons
  - permission tooltips
  - webview message wiring

Implementation notes:

- The current `Testers` block in `overviewHtml.ts` is read-only and uses
  `renderParticipants(detail.testers)`. This design changes it to a tester
  section with the same interaction pattern already used for reviewers.
- To avoid parallel-but-divergent sidebar logic, reviewer and tester section
  helpers should be generalized where practical instead of duplicated.
- Introduce a dedicated overview permission such as `canUpdateTesters` even if
  it currently maps to the same `pr:update` capability as reviewers. This keeps
  the UI contract explicit and avoids coupling tester actions to reviewer-only
  naming.

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
package.json
```

Added:

```text
docs/design/pull-request-tester-operation/design.md
```

## Validation

Covered by tests:

- store authentication and cache invalidation
- tester quick-pick filtering helpers, including author exclusion
- overview HTML action rendering and permission guards
- add/remove tester panel flows, including success and error messages
- full extension test suite via `npm test`
