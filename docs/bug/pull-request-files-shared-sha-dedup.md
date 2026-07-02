# Pull Request File List Shows Only Partial Files

## Status

Fixed — 2026-07-02

## Symptom

The pull request file tree could show only part of the changed files returned by
GitCode. This was most visible when a pull request changed multiple files at the
same head commit: the API returned all file records, but the extension displayed
only one of the records that shared the same `sha`.

## Root Cause

`listPagedRecords` deduplicated paginated API records using the first available
field from a generic key list. The list checked `sha` before any file path
fields.

For `/pulls/:number/files`, `sha` represents the pull request head commit in
GitCode responses, not a unique file identity. Multiple changed files can
therefore have the same `sha`, so the pagination helper treated later files as
duplicates and dropped them.

## Fix

Updated the pagination record key selection to prefer file-specific paths before
falling back to `sha`:

- `path`
- `filename`
- `patch.new_path`
- `patch.old_path`

This keeps all changed-file records distinct while preserving the existing
dedupe behavior for records that only expose IDs, names, logins, or SHAs.

## Files Changed

- `src/gitcode/services/pagination.ts`
- `src/test/pagination.test.ts`

## Behavior After Fix

| Scenario | Before Fix | After Fix |
| --- | --- | --- |
| Two PR file records share the same `sha` but have different `filename` values | Only the first file was kept. | Both files are displayed. |
| File path is available only under `patch.new_path` or `patch.old_path` | Records could fall back to shared `sha`. | Path is used as the dedupe key. |
| Non-file paginated records with stable `id` or `number` fields | Deduped by those fields. | Unchanged. |

## Verification

- Added regression coverage for multiple pull request file records sharing the
  same `sha`
- `npm test` passes: 193 tests
