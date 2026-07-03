# Pull Request And Issue Overview Action Layout Follow-up

## Status

Fixed - 2026-07-03

## Summary

This follow-up adjusts the overview footer layout after the previous polish pass
gave the close or reopen action too much visual emphasis and placed related
issues too low in the pull request page flow.

The changes keep the issue and pull request overviews aligned while making the
state-changing action available without encouraging accidental closure.

## Problem

Two UX problems remained after the 2026-07-02 overview polish update:

- the pull request `Related Issues` section appeared below the timeline instead
  of near the top of the main content, unlike the issue page's related pull
  request placement
- the issue and pull request close or reopen actions sat at the bottom-right of
  the main column and used primary styling, which over-emphasized a destructive
  state transition

The comment submit action was also left-aligned, which made the composer footer
feel visually unbalanced once the state action moved into the content area.

## Fix

The overview renderers were updated to use the same footer action pattern on
both surfaces:

- the state action button now lives on the left side of the composer footer
- the `Comment` submit button now lives on the right side of the same row
- the state action button now uses transparent secondary styling instead of the
  primary treatment
- pull request `Related Issues` now render above the timeline section

The existing two-click close confirmation remains in place. Only the placement
and visual emphasis changed.

## Affected Files

| File | Change |
|------|--------|
| `src/view/overview/overviewHtml.ts` | moved PR related issues above the timeline and relocated the state action into the composer footer with secondary styling |
| `src/view/issueOverview/issueOverviewHtml.ts` | relocated the issue state action into the composer footer and changed it to secondary styling |
| `src/test/overviewHtml.test.ts` | added regression coverage for PR related issue order and composer footer action alignment |
| `src/test/issueOverviewHtml.test.ts` | added regression coverage for issue composer footer action alignment |

## Notes

This follow-up intentionally supersedes part of
`docs/bug/overview-ui-polish-2026-07-02.md`:

- close or reopen actions are no longer positioned at the bottom-right of the
  main content column
- close or reopen actions are no longer rendered with primary emphasis

## Verification

- `npm run compile-tests`
- `npm run lint`
- `npm test`
