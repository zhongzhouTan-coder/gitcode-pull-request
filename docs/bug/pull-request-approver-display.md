# Pull Request Approver Display Rename

## Status

Fixed - 2026-07-05

## Summary

Pull request UI copy now displays `approver` where the product previously
showed `assignee`. This rename is intentionally limited to pull request
surfaces. Issue pages and issue creation continue to display `assignees`.

## Scope

The display rename applies to pull request-facing text only:

- command palette titles for adding or removing a pull request participant
- create pull request form labels
- pull request overview section headings, tooltips, confirmations, empty-state
  notices, and success or failure messages

The internal command ids, API payload fields, and state property names still
use `assignee` or `assignees` so behavior remains unchanged.

## Files Changed

- `package.json`
- `src/view/createPullRequest/createPullRequestHtml.ts`
- `src/view/overview/overviewHtml.ts`
- `src/view/overview/pullRequestOverviewPanel.ts`

## Notes

This update is PR-only by design. Issue UI terminology remains unchanged:

- issue create flow still displays `Assignees`
- issue overview still displays `Assignees`

## Verification

- `npm run compile-tests`
- `npm run lint`
