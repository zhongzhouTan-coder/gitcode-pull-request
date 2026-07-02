# Diff Comment Context Missing When File Patch Is Unavailable

## Status

Fixed — 2026-07-02

## Symptom

Diff comments in the pull request overview could still render without file
context even though the comment had a path and line number. The card showed only
metadata such as:

```text
Code comment · src/example.ts · line 24
```

The expected focused diff hunk was missing, so users could not understand the
commented code from the overview.

## Root Cause

The overview context builder only understood unified patch text from
`PullRequestFileChange.patch`.

That works when `/pulls/:number/files` returns `patch.diff`, but it fails when
the file-list response has no usable patch for a comment. The extension already
downloads `/pulls/:number/files.json` for native diff support, and that response
contains structured diff rows under `diffs[].content.text`, but
`PullRequestDiffSnapshot` discarded those rows and kept only refs and file
types.

As a result, the overview had no fallback source for comment file context.

## Fix

### Preserve Structured Diff Rows

Extended `PullRequestDiffSnapshot` with lightweight per-file context data:

- file path
- previous path
- file type
- structured diff rows

`mapDiffSnapshot` now maps `files.json` rows into normalized line records with:

- row kind: context, add, or delete
- old line number
- new line number
- source text

Hunk header rows are skipped.

### Support Structured Context Extraction

Updated `src/view/overview/diffCommentContext.ts` so
`buildDiffCommentContexts` can consume either:

- unified patch text from `PullRequestFileChange.patch`
- structured rows from `PullRequestDiffSnapshot.files`

The rendered output remains the same: a focused snippet around the commented
line with the comment row highlighted.

### Add Overview Fallback

Updated `PullRequestOverviewPanel` to keep the existing fast path through
`PullRequestTreeStore.getPullRequestFiles()`. If any locatable diff comment
still has no context, the panel fetches `files.json`, builds contexts from the
structured rows, and merges only the missing snippets.

## Files Changed

- `src/common/models.ts`
- `src/gitcode/mappers/pullRequestDiffSnapshotMapper.ts`
- `src/view/overview/diffCommentContext.ts`
- `src/view/overview/pullRequestOverviewPanel.ts`
- `src/test/diffCommentContext.test.ts`
- `src/test/pullRequestDiff.test.ts`

## Behavior After Fix

| Scenario | Behavior |
| --- | --- |
| File list has `patch.diff` | Overview renders context from the unified patch. |
| File list has no usable patch, but `files.json` has rows | Overview renders context from structured rows. |
| Neither source has the target line | Overview falls back to metadata-only rendering. |
| Existing context already exists | No structured fallback overwrites it. |

## Verification

- `npm test` passes: 192 tests
- Added mapper coverage for structured `files.json` rows
- Added context-builder coverage for rendering snippets when patch text is
  unavailable
