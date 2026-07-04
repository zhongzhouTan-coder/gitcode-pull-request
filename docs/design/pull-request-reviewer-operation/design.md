# Pull Request Reviewer Operation Design

## Goal

Add reviewer management to the pull request overview so users can:

- list reviewers that are eligible for selection
- add one or more reviewers to the active pull request
- remove one or more existing reviewers from the active pull request

The feature must keep GitCode API access in `gitcode/services/*`, reuse the
existing pull request overview architecture, and refresh the overview after
reviewer mutations succeed.

## Scope

### In Scope

- Load selectable reviewers from the documented reviewer options API.
- Add an `Add reviewer` action in the pull request overview sidebar.
- Add a `Remove reviewer` action for each assigned reviewer row.
- Add command-palette commands for add/remove reviewer on the active overview.
- Use VS Code quick pick for reviewer selection.
- Refresh pull request detail and operation logs after successful mutations.
- Show permission, loading, empty, and API error states.

### Out of Scope

- Editing assignees or testers.
- Replacing the full reviewer list in one submit.
- Manual free-text reviewer entry.
- Reviewer actions from the tree view or issue overview.

## API Contract

Use the documented APIs in this directory:

- [list-reviewers-api.md](./list-reviewers-api.md)
  - `GET /api/v5/repos/:owner/:repo/pulls/:number/option_reviewers`
- [assign-reviewer-api.md](./assign-reviewer-api.md)
  - `POST /api/v5/repos/:owner/:repo/pulls/:number/reviewers`
- [cancel-review-api.md](./cancel-review-api.md)
  - `DELETE /api/v5/repos/:owner/:repo/pulls/:number/reviewers`

Request shapes:

```json
{
  "reviewers": "alice,bob",
  "add": true
}
```

```json
{
  "reviewers": "alice,bob"
}
```

Design choice:

- add flow uses `add: true` so the POST appends reviewers instead of replacing
  the current reviewer set
- remove flow uses the dedicated DELETE API
- selectable reviewers come from `option_reviewers`, then the UI filters out
  reviewers already assigned in `PullRequestDetail.reviewers`

## User Experience

The pull request overview sidebar `Reviewers` section becomes actionable:

```text
Reviewers                                              [+]
  Carol @carol                                      [-]
  Dan @dan                                          [-]
```

Behavior:

- `Add reviewer` opens a multi-select quick pick populated from
  `option_reviewers`.
- Already assigned reviewers are excluded from the add picker.
- If no additional reviewers are available, show
  `No additional reviewers are available for this pull request.`
- Row-level remove buttons remove a single reviewer directly from the sidebar.
- Command-palette remove uses a multi-select quick pick over currently assigned
  reviewers.
- Remove actions require confirmation.

Success messages:

- `Reviewer added to pull request #123`
- `Reviewers added to pull request #123`
- `Reviewer removed from pull request #123`
- `Reviewers removed from pull request #123`

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
  - list selectable reviewers
  - add reviewers
  - remove reviewers
  - normalize reviewer login payloads
- `PullRequestOverviewStore`
  - enforce authentication
  - invalidate cached PR detail after reviewer mutations
- `PullRequestOverviewPanel`
  - command routing
  - quick pick selection
  - confirmation UX
  - in-progress sidebar state
  - operation-log refresh
- `overviewHtml.ts`
  - render reviewer action buttons
  - permission tooltips
  - webview message wiring

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
docs/design/pull-request-reviewer-operation/design.md
```

## Validation

Covered by tests:

- store authentication and cache invalidation
- reviewer quick-pick filtering helpers
- overview HTML action rendering and permission guards
- full extension test suite via `npm test`
