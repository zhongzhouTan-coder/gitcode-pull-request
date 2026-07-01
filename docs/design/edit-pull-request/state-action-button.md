# Pull Request State Action Button

## Status

Implemented — 2026-06-30

Updated — 2026-07-01

## Context

The pull request overview previously managed PR state as an editable sidebar
section. Users clicked the state pencil icon, selected `Open` or `Closed`, and
then saved the section.

The issue overview already uses a clearer state management pattern: a primary
action button in the overview action row (`Close issue` or `Reopen issue`).
Pull request state management should follow that same interaction model.

## Change

Pull request state is now managed by a dedicated action button in the PR overview
header:

- open PRs show `Close pull request`
- closed PRs show `Reopen pull request`
- merged PRs show the reopen action disabled

The sidebar no longer renders a pull request state card. State remains visible in
the header badge, and state changes remain available through the dedicated
header action button. This avoids showing duplicate state controls in the
overview.

## Implementation

- `src/view/overview/overviewHtml.ts`
  - renders `#state-action-button`
  - posts `changePullRequestState` with `state: 'closed'` or `state: 'open'`
  - disables the button while the state update is pending
  - restores the button and shows an action error on
    `pullRequestStateChangeError`
- `src/view/overview/pullRequestOverviewPanel.ts`
  - handles `changePullRequestState`
  - validates allowed transitions
  - calls `editPullRequest` with the current title and requested state
  - refreshes comments, the overview, and the PR tree after success

## Validation

- requested state must be `open` or `closed`
- only open pull requests can be closed
- only closed pull requests can be reopened
- merged pull requests cannot be reopened or closed from the overview

## Verification

- `npm test`
