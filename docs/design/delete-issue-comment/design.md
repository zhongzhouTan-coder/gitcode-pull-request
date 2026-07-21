# Delete Issue Comment Design

## Goal

Allow users to delete an existing comment from the issue overview timeline.

The feature must:

- use the delete issue comment API documented in [api.md](api.md)
- keep GitCode API access inside `gitcode/services/*`, not in the view layer
- keep `IssueCommentsStore` as the source of truth for issue comments
- refresh issue comments after a successful delete
- require explicit user confirmation before deleting
- apply permission control before rendering enabled actions and before calling
  the write API
- preserve the existing issue timeline behavior for operation logs and related
  pull requests

This design extends the issue comment list and create flows from
[../get-issue-comments/design.md](../get-issue-comments/design.md) and
[../create-issue-comment/design.md](../create-issue-comment/design.md). The
delete API response is treated as an acknowledgement. After deletion, the
extension reloads comments through the existing list-comments path so sorting,
mapping, and timeline rendering remain centralized.

## Scope

### In Scope

- Add a delete action to issue comment timeline entries.
- Render the delete action as a compact trash icon in the issue comment header
  action area.
- Show a confirmation prompt before sending the delete request.
- Delete comments by `commentId`.
- Disable delete controls while the request is in flight.
- Refresh `IssueCommentsStore` after a successful delete.
- Show API errors near the initiating comment.
- Re-check permission in the extension-host handler before calling the service.

### Out of Scope

- Deleting issues.
- Deleting pull request comments or pull request diff comments.
- Batch deleting multiple comments.
- Editing issue comments.
- Replying to issue comments. GitCode issue comments are flat in the current
  API.
- Optimistically removing comments before the API confirms success.
- Restoring deleted comments.
- Removing issue operation logs that reference the deleted comment.

## User Experience

Issue comments render in the issue overview timeline. Each deletable issue
comment should show a compact delete action in the top-right comment controls:

```text
@octocat                                      Jul 12, 10:24   [trash]
I can reproduce this on the latest build.
```

Rules:

- The delete action is an icon-only button.
- Use a trash icon and an accessible label such as `Delete comment`.
- Place it beside any future comment header actions.
- Use the existing subtle action styling used by issue and pull request
  overview controls.
- Keep the hit target large enough for pointer use even when the icon is
  visually compact.
- Do not enable the action when local permission and ownership data determine
  the current user cannot delete the comment.
- Prefer the existing disabled-control-with-tooltip pattern for
  permission-gated actions. If the local renderer already hides unavailable
  per-comment actions, hiding is acceptable only when the tooltip pattern would
  create noisy repeated disabled controls.

Activating the trash icon must ask for confirmation before posting the delete
message:

```text
Delete this comment?

[Delete] [Cancel]
```

Rules:

- The confirmation can be an inline confirmation row near the comment, a
  lightweight webview dialog, or an extension-host `showWarningMessage`
  confirmation.
- The destructive action label must be `Delete`.
- `Cancel` leaves the comment and cached state unchanged.
- While deletion is pending, disable the trash action and confirmation buttons
  for that `commentId`.
- On success, close confirmation UI and refresh `IssueCommentsStore`.
- On failure, keep the comment visible and show the error near the comment
  action area.
- If refresh fails after a successful delete, show that the comment was deleted
  but comments could not be reloaded, then allow manual refresh.

The webview should post a command message to the extension host instead of
calling GitCode directly:

```ts
{
  command: 'deleteIssueComment',
  commentId: string
}
```

The extension host should reply with one of:

```ts
{
  command: 'issueCommentDeletePending',
  commentId: string
}

{
  command: 'issueCommentDeleted',
  commentId: string
}

{
  command: 'issueCommentDeleteError',
  commentId: string,
  message: string
}
```

The canonical comment list remains owned by `IssueCommentsStore`. Webview
script state is only for confirmation, pending state, and inline errors.

## API Contract

Use the endpoint from [api.md](api.md):

```text
DELETE /api/v5/repos/:owner/:repo/issues/comments/:id
```

Path variables:

- `owner`: repository owner path
- `repo`: repository path
- `id`: issue comment id

The documented response is `200 OK`. The endpoint identifies the target comment
entirely by path, so the service should not send a request body.

Suggested service surface:

```ts
export interface DeleteIssueCommentInput {
  commentId: string;
}

issueCommentService.deleteIssueComment(
  repository: GitCodeRepository,
  input: DeleteIssueCommentInput,
): Promise<void>;
```

The service should:

- reject a missing `commentId` before issuing the request
- construct the API path with the comment id as `:id`
- encode owner, repo, and comment id consistently with existing service methods
- send no request payload
- keep authentication and request formatting inside `GitCodeClient`
- return `void` on `200 OK`

## Permission Control

Deleting comments is destructive, so permission control must be applied in both
the UI and extension-host handler. UI gating prevents accidental actions; the
GitCode API remains the final authority.

### Permission Operation

Add a business-level operation:

```ts
export type PermissionOperation =
  | ...
  | 'issue.comment.delete';
```

Use this mapping:

```text
primary permission point: note:delete, when present in the snapshot
fallback permission point: none unless GitCode explicitly documents one
ownership rule: current user is the comment author
server authority: DELETE API response
```

If the permission snapshot contains `note:delete`, it should grant delete for
users with repository-level comment deletion rights. If the snapshot does not
contain `note:delete`, do not infer broad delete permission from `note:create`.
`note:create` allows comment creation and is currently used for comment edit
fallbacks, but it is too broad for destructive deletion unless GitCode confirms
that mapping.

Reuse the centralized ownership helper already used by pull request comments:

```ts
canDeleteOwnComment(currentUserLogin, comment.author.login)
```

The rule should use case-insensitive login comparison.

### UI Gating

Issue comment delete capability is object-specific because comment ownership is
per comment. Add `canDeleteComment` to `IssueOverviewPermissions` for the
repository-level permission point, then combine it with the ownership rule when
rendering each comment.

Recommended rule:

```ts
const canDelete =
  permissions.canDeleteComment
  || canDeleteOwnComment(currentUserLogin, comment.author.login);
```

Rules:

- Enable delete when `note:delete` is present and selected.
- Enable delete for the current user's own comments when ownership can be
  determined locally.
- Disable or hide delete when neither permission nor ownership grants it.
- Keep delete disabled when current user identity is unavailable and no
  permission point grants the operation.
- Show a permission tooltip such as
  `You do not have permission to delete this comment.`
- Do not rely on webview gating as the only enforcement.

When the permission endpoint fails and the issue overview uses unknown
permissions, keep write controls available only when the existing unknown
permission policy does so. The handler must still check ownership before
calling the API when permission state is unavailable.

### Handler Enforcement

The `deleteIssueComment` message handler must re-check permission before
calling the service:

- find the target comment in the current `IssueCommentsStore` snapshot
- compare current user login to the target comment author login
- evaluate `issue.comment.delete`
- stop before the API call when permission is known denied
- if permission state is unavailable because the permission endpoint failed,
  allow the request only for own comments when ownership is known; otherwise
  show the permission message

If the delete API returns `403` or `404`, show the API error and refresh the
repository permission snapshot in the background when possible.

## State Model

The canonical comment objects remain owned by `IssueCommentsStore`. Deletion
adds transient operation state outside the comment object:

```ts
export interface DeleteIssueCommentInput {
  commentId: string;
}

export interface IssueCommentDeleteOperation {
  commentId: string;
  status: 'confirming' | 'pending' | 'failed';
  error?: string;
}
```

The operation state must not remove the comment from the canonical comments
snapshot before the delete API succeeds and the store refresh returns updated
data.

## Architecture

```text
Issue overview trash action
        |
        v
Issue overview confirmation UI
        |
        v
IssueOverviewPanel permission check
        |
        v
IssueCommentsStore.deleteComment()
        |
        v
IssueCommentService.deleteIssueComment()
        |
        v
IssueCommentsStore.refresh()
        |
        v
Issue overview timeline rerenders
```

Dependency rules:

- The webview sends command messages to the extension host; it does not call
  GitCode directly.
- The store serializes concurrent delete operations per `commentId`.
- The service owns API path construction and request formatting.
- UI projections render pending/error state but do not mutate cached comments.
- Permission evaluation lives in `view/permissions/*`, not in ad hoc webview
  conditionals.
- Issue comments stay separate from pull request comments because issue
  comments have no diff location, discussion state, or native editor
  projection.

## Store Design

Extend `IssueCommentsStore`:

```ts
async deleteComment(
  repository: GitCodeRepository,
  issueNumber: number,
  input: DeleteIssueCommentInput,
): Promise<void>;
```

Rules:

- Check `AuthService.getSession()` before calling the service.
- Reject missing `commentId`.
- Avoid sending duplicate concurrent delete requests for the same comment.
- Call `IssueCommentService.deleteIssueComment`.
- On success, call `refresh(repository, issueNumber)`.
- On failure, leave the cached comment snapshot unchanged and rethrow the error
  for the panel to render.

## Proposed Files

Update:

```text
src/common/models.ts
src/gitcode/services/issueCommentService.ts
src/view/issueOverview/issueCommentsStore.ts
src/view/issueOverview/issueOverviewHtml.ts
src/view/issueOverview/issueOverviewPanel.ts
src/view/permissions/permissionOperations.ts
src/view/permissions/permissionEvaluator.ts
src/view/permissions/permissionHelpers.ts
```

Add or update tests near the existing issue comment and permission tests:

```text
src/test/issueCommentsStore.test.ts
src/test/issueOverviewHtml.test.ts
src/test/issueOverviewPanel.test.ts
src/test/issueCommentService.test.ts
src/test/permissionEvaluator.test.ts
```

## Validation and Errors

- Reject missing `commentId` before calling the service.
- Reject deletion when the target comment does not exist in the current
  comments snapshot.
- Require confirmation before the write API call.
- If an operation is already pending for the same `commentId`, ignore or block
  duplicate submissions.
- Show permission failures before API failures when local permission is known
  denied.
- Show API failures beside the delete action in the issue overview.
- Keep the comment visible after failure.
- If refresh fails after a successful delete, show that deletion succeeded but
  comments could not be reloaded.

## Testing

- `IssueCommentService.deleteIssueComment` validates missing `commentId`.
- The service sends `DELETE` to
  `/api/v5/repos/:owner/:repo/issues/comments/:id` with no request body.
- The store calls the delete service, then refreshes the same issue comments
  snapshot.
- Duplicate pending deletes for the same `commentId` do not send duplicate API
  requests.
- The overview renders delete only for comments the current user can delete, or
  renders disabled permission-tooltipped controls if that pattern is used.
- The overview requires confirmation before posting `deleteIssueComment`.
- The overview disables delete controls while deletion is pending.
- The overview keeps the comment visible and shows an error when deletion
  fails.
- The overview rerenders from refreshed state after successful deletion.
- Permission tests cover `issue.comment.delete` with `note:delete` present,
  own-comment ownership, missing current user, unknown permission state, and
  known-denied permissions.
