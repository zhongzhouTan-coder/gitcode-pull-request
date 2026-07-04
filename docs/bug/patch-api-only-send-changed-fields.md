# Patch API Sends Unchanged Fields

## Status

Fixed - 2026-07-04

## Symptom

Editing a single pull request or issue field could still send additional
unchanged fields in the PATCH request body.

The most visible case was `title`: section-specific saves and state changes sent
the current title back to GitCode even when the user only changed labels,
milestone, draft state, security flag, or open/close state.

## Root Cause

The PATCH payload mappers already skipped `undefined` fields, but the overview
webviews and panel handlers always constructed edit inputs with `title`
included.

That made sparse UI edits look like full updates:

- pull request section saves always started from `{ title: currentTitle }`
- issue section saves always started from `{ title: detailSnapshot.title }`
- issue and pull request state changes also injected the current title

Because `title` was mandatory in `EditPullRequestInput` and `EditIssueInput`,
the edit flow was biased toward full payloads instead of field-level patches.

## Fix

The edit flow now treats PATCH updates as sparse payloads:

- `EditPullRequestInput` and `EditIssueInput` now allow `title` to be omitted
- the PATCH mappers only include `title` when it was actually provided
- overview webviews now build per-section payloads that only include the field
  being edited
- issue and pull request state changes now send only `state`
- issue validation now requires `title` only when the title section itself is
  being saved

## Files Changed

- `src/common/models.ts`
- `src/gitcode/mappers/pullRequestMapper.ts`
- `src/gitcode/mappers/issueMapper.ts`
- `src/view/overview/overviewHtml.ts`
- `src/view/overview/pullRequestOverviewPanel.ts`
- `src/view/issueOverview/issueOverviewHtml.ts`
- `src/view/issueOverview/issueOverviewPanel.ts`

## Behavior After Fix

| Scenario | Before Fix | After Fix |
| --- | --- | --- |
| Save pull request labels only | PATCH body also included current `title` | PATCH body includes only `labels` |
| Close or reopen a pull request | PATCH body included `title` and `state` | PATCH body includes only `state` |
| Save issue milestone only | PATCH body also included current `title` | PATCH body includes only `milestone` |
| Close or reopen an issue | PATCH body included `title` and `state` | PATCH body includes only `state` |

## Verification

- `npm run compile-tests`
- `npm run lint`
