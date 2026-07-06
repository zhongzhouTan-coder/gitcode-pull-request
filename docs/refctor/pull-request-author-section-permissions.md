# Pull Request Author Section Permissions Refactor

## Summary

The pull request overview permission model previously exposed three separate
flags for author-editable sections:

- `canEditPullRequestTitleAndBody`
- `canEditPullRequestDraft`
- `canEditPullRequestOptions`

These flags all mapped to the same effective permission rule:

- backend scope: `pr`
- backend action: `update`
- object-level override: current user is the pull request author

The implementation now replaces them with a single shared flag:

- `canEditPullRequestAuthorSections`

## What Changed

- Collapsed the three duplicated author-editable overview permission flags into
  `canEditPullRequestAuthorSections`.
- Updated the pull request overview webview so `title`, `body`, `draft`,
  `pruneBranch`, `squashMerge`, and `closeRelatedIssue` all resolve to the same
  permission key.
- Kept section-specific denied messages in the UI so the behavior stays
  readable even though the permission source is shared.

## Why Close And Reopen Stay Separate

`close` and `reopen` also allow the pull request author, but they were not
merged into `canEditPullRequestAuthorSections` because they are distinct backend
actions:

- `pr:update`
- `pr:close`
- `pr:reopen`

Keeping those permissions separate preserves correct UI gating if GitCode ever
returns different values for update, close, or reopen.

## Result

This refactor removes duplicated permission wiring without weakening the
permission model:

- author-editable pull request sections now share one permission flag
- pull request state changes still use their own action-specific permissions
