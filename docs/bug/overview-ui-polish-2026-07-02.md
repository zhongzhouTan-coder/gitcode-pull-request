# Pull Request And Issue Overview UI Polish

## Status

Fixed - 2026-07-02

## Summary

This records a follow-up polish pass for the pull request and issue overview
webviews. The changes keep the two overview surfaces visually consistent while
reducing oversized controls when repository metadata lists are large.

## Changes

- Changed the PR and issue `Refresh` action from an icon-only button to a text
  button.
- Moved PR and issue close or reopen actions out of the header action cluster
  and into the bottom-right of the main content column.
- Made PR and issue close or reopen actions use primary blue button styling.
- Added an inline two-click confirmation for close actions:
  - first click changes the button to `Confirm close ...`
  - second click sends the close message
  - reopen remains a single-click action
- Merged PR `Draft` and `Close related issues after merge` controls into one
  `Pull Request Options` sidebar card.
- Removed explicit Save buttons from those PR checkbox controls. Each checkbox
  now auto-saves on change and shows its own saving/error state.
- Added fixed-height scroll windows for long issue option lists:
  - assignees
  - labels
  - milestones
- Scrolled the selected issue option into view when an edit section opens.
- Capped the PR selected-label chip area so many selected labels do not stretch
  the sidebar.

## Affected Files

| File | Change |
|------|--------|
| `src/view/overview/overviewHtml.ts` | PR overview button placement, close confirmation, option card, auto-save checkboxes, and long label picker handling |
| `src/view/issueOverview/issueOverviewHtml.ts` | issue overview refresh text button, close placement/style/confirmation, and scrollable option lists |
| `src/test/overviewHtml.test.ts` | regression coverage for PR button placement, confirmation behavior, option card, and scroll caps |
| `src/test/issueOverviewHtml.test.ts` | regression coverage for issue button placement, confirmation behavior, and scrollable option lists |

## Verification

- `npm test`
- 194 tests passing
