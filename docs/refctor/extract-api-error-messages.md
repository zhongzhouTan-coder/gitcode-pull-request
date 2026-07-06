# Extract API Error Messages Refactor

## Summary

The GitCode API returns structured error responses where the meaningful message
is inside an `error_message` field:

```json
{ "error_code": 400, "error_message": "Merge request author cannot operate their own merge request" }
```

Previously, all error-display code used `error instanceof Error ? error.message :
'Fallback text'`, which for `ApiRequestError` would show the generic constructor
message ("GitCode API request failed with status 400") instead of the
human-readable `error_message`.

## What Changed

- Added `getApiRequestErrorMessage()` utility in `src/common/errors.ts` that
  extracts `error_message` from `ApiRequestError.details` JSON, falling back to
  the base error message when details are absent or not structured JSON.

- Replaced all `error instanceof Error ? error.message` patterns across 5
  production files with `getApiRequestErrorMessage(error)`:

  | File | Call Sites |
  |---|---|
  | `src/view/overview/pullRequestOverviewPanel.ts` | 29 |
  | `src/view/issueOverview/issueOverviewPanel.ts` | 7 |
  | `src/view/comments/diffCommentController.ts` | 5 |
  | `src/view/createPullRequest/createPullRequestViewProvider.ts` | 4 |
  | `src/view/createIssue/createIssuePanel.ts` | 3 |

- For **log messages**, the pattern is a direct replacement:
  `getApiRequestErrorMessage(error)` since it always returns a string.

- For **user-facing messages** (shown via `vscode.window.showErrorMessage` or
  webview `postMessage`), the pattern is:
  `getApiRequestErrorMessage(error) || 'Fallback text'` to preserve the
  fallback when the API message is empty.

- Updated `renderError()` in both `pullRequestOverviewPanel.ts` and
  `issueOverviewPanel.ts` to use `getApiRequestErrorMessage` instead of
  `` `GitCode returned HTTP ${error.statusCode}.` ``.

## Result

Users now see actionable API error messages (e.g., "Merge request author cannot
operate their own merge request") instead of the generic HTTP status
descriptions. The fallback behavior for non-`ApiRequestError` errors is
unchanged.
