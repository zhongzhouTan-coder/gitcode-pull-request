# Issue Author Section Permissions Refactor

## Summary

The issue overview permission model previously used the name
`canEditIssueTitleAndBody` for the flag that controls whether the current user
(as the issue author) can edit the issue title and description. The equivalent
pull request permission was already named `canEditPullRequestAuthorSections`.

The refactor renames the issue flag to `canEditIssueAuthorSections` so both
issue and pull request overview permissions follow the same `AuthorSections`
naming convention.

## What Changed

- Renamed `canEditIssueTitleAndBody` to `canEditIssueAuthorSections` in:

  | File | Occurrence |
  |---|---|
  | `src/common/models.ts` | `IssueOverviewPermissions` interface property |
  | `src/view/issueOverview/issueOverviewHtml.ts` | JS mapping for `title` / `body` edit sections |
  | `src/view/issueOverview/issueOverviewPanel.ts` | Default permissions object |
  | `src/view/permissions/permissionHelpers.ts` | `buildIssueOverviewPermissions` (null, normal, unknown) |
  | `src/test/rolePermissionProfiles.test.ts` | Test assertion |

- No behavioral change — the permission still uses the same effective rule
  (backend scope `issue`, action `update`, with author override).

## Why `AuthorSections` Instead Of `TitleAndBody`

`canEditPullRequestAuthorSections` covers title, body, draft, pruneBranch,
squashMerge, and closeRelatedIssue — well beyond title and body. Using
`AuthorSections` for the issue flag aligns the two overviews and leaves room
for future author-editable issue sections without another rename.

## Result

Issue and pull request overview permissions now share a consistent naming
convention:

- `canEditIssueAuthorSections` — author-editable issue sections (title, body)
- `canEditPullRequestAuthorSections` — author-editable pull request sections (title, body, draft, options)
