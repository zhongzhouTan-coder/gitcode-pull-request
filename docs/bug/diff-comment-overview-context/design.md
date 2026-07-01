# Diff Comment Overview Context

## Status

Fixed — 2026-07-01

## Symptom

Diff comments in the pull request overview only displayed comment metadata:

```text
Code comment · path/to/file.ts · line 24
```

Users could not inspect the surrounding diff from the overview, and the file
path was not actionable. To understand the comment, users had to manually find
the changed file and line in the pull request file tree.

## Root Cause

The pull request comment model had normalized file and line information after
comment-detail enrichment, but the overview renderer only used that data as
plain text metadata.

The existing pull request files API already exposes per-file patch text. The
overview did not combine that patch data with diff comment locations, so it had
no hunk to render and no path-to-diff navigation from comment cards.

## Fix

### Diff Context Extraction

Added `src/view/overview/diffCommentContext.ts`.

It maps each locatable diff comment to its matching `PullRequestFileChange`
patch and extracts a focused hunk around `comment.location.startLine`.

The extracted context keeps:

- old line number
- new line number
- row kind: context, add, or delete
- source text
- whether the row is the commented line/range

If patch data is missing or the target line cannot be found, the overview falls
back to the existing metadata-only rendering.

### Overview Rendering

Updated `src/view/overview/overviewHtml.ts` so diff comment cards render:

- the existing author, status, path, and line metadata
- a small read-only diff context block when patch context is available
- highlighted rows for the commented line/range

The file path is now rendered as a button instead of inert text.

### Diff Navigation

Clicking a diff comment file path posts an `openDiffComment` webview message
with:

- `path`
- `line`

`PullRequestOverviewPanel` resolves the path against the pull request file list
and calls `PullRequestDiffController.openDiff(..., { line })`.

`PullRequestDiffController` opens the existing native VS Code diff view and
reveals the one-based target line on the head side.

## Files Changed

- `src/view/overview/diffCommentContext.ts`
- `src/view/overview/overviewHtml.ts`
- `src/view/overview/pullRequestOverviewPanel.ts`
- `src/view/diff/pullRequestDiffController.ts`
- `src/view/viewController.ts`
- `src/test/diffCommentContext.test.ts`
- `src/test/overviewHtml.test.ts`

## Behavior After Fix

| Scenario | Behavior |
| --- | --- |
| Comment has path, line, and patch | Overview shows a focused diff hunk and highlights the commented line. |
| User clicks comment file path | Native PR diff opens and reveals the comment line. |
| Patch data is unavailable | Overview still shows the path and line metadata. |
| File cannot be found in PR file list | User sees a warning instead of a failed navigation. |

## Verification

- `npm run compile-tests` passes
- `npm run lint` passes
- Overview HTML tests cover the clickable file path payload
- Diff context tests cover hunk extraction around the comment line

`npm test` still reports unrelated existing failures in:

- `PullRequestCommentsStore — reviseCommentStatus`
- `CommentThreadFactory`
