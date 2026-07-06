# Pull Request Close Related Issue Checkbox State

## Status

Fixed - 2026-07-06

## Symptom

The pull request overview option `Close related issues after merge` could show
as unchecked even when the underlying pull request setting was already enabled.

The incorrect state appeared on initial overview render and after the section
UI reset path reused the cached detail snapshot.

## Root Cause

The pull request detail mapper did not preserve GitCode's
`close_related_issue` field when converting API responses into the extension's
`PullRequestDetail` model.

Because the overview renderer only had access to `detail.isDraft` and not the
close-related-issue flag, the checkbox markup defaulted to unchecked and the
reset handler also forced it back to `false`.

## Fix

The fix keeps the close-related-issue flag intact end to end:

- `PullRequestDetail` now includes `closeRelatedIssue`
- the detail mapper now reads `close_related_issue` from the API response and
  normalizes boolean, numeric, or string boolean-like values
- the overview HTML now renders the checkbox as checked when the detail says it
  is enabled
- the overview section reset logic now restores the checkbox from the detail
  snapshot instead of hardcoding `false`

## Files Changed

- `src/common/models.ts`
- `src/gitcode/mappers/pullRequestDetailMapper.ts`
- `src/view/overview/overviewHtml.ts`

## Verification

- `npm run lint`
- `npm run compile`
