# Delete Pull Request Comment Design

## Goal

Allow users to delete an existing pull request comment.

The feature must:

- use the delete comment API documented in [api.md](api.md)
- support deleting pull request conversation comments
- support deleting pull request diff comments and replies when the API accepts
  the comment id
- keep API access inside `gitcode/services/*`, not in the view layer
- keep `PullRequestCommentsStore` as the source of truth
- refresh comments after a successful delete
- require an explicit user confirmation before deleting
- apply permission control before rendering enabled actions and before calling
  the write API

This design extends the normalized comments architecture from
[../list-comments/design.md](../list-comments/design.md) and should share the
same service, store, overview, and native diff comment paths used by create,
reply, edit, and resolve operations.

## Scope

### In Scope

- Add a delete action to deletable comments in the pull request overview
  conversation.
- Render the delete action as a compact trash icon in the comment header action
  area.
- Show a confirmation prompt before submitting the delete request.
- Delete comments by `commentId`.
- Disable delete controls while the request is in flight.
- Refresh `PullRequestCommentsStore` after a successful delete.
- Show API errors near the initiating comment in the overview.
- Support native VS Code comment actions for locatable diff comments when the
  current user can delete the comment.
- Re-check permission in extension-host handlers before calling the service.

### Out of Scope

- Deleting pull requests.
- Deleting issues or issue comments.
- Batch deleting multiple comments.
- Deleting an entire discussion by `discussionId`.
- Optimistically removing cached comments before the API confirms success.
- Restoring deleted comments.
- Editing, replying, creating, resolving, or reopening comments.
- Deleting historical or outdated diff snapshot metadata.

## User Experience

### Pull Request Overview

Each deletable comment card should show a compact delete action in the
top-right comment header controls:

```text
@octocat                                      Jun 17, 16:13   [trash]
Looks good to me.
```

Rules:

- The delete action is an icon-only button.
- Use a trash icon.
- Place it beside existing comment actions such as edit and reply.
- Provide an accessible label such as `Delete comment`.
- Use the existing subtle action color for comment header controls.
- On hover and focus, increase contrast and show a visible focus outline.
- Keep the hit target large enough for pointer use even though the icon is
  visually compact.
- Do not show or enable the action for comments the current user cannot delete
  when local permission and ownership data can determine that.
- If the design system prefers visible disabled controls for permission-gated
  actions, render the button disabled with a tooltip instead of hiding it.

Activating the trash icon must ask for confirmation before sending the webview
command:

```text
Delete this comment?

[Delete] [Cancel]
```

Rules:

- The confirmation can be a small inline confirmation row, a lightweight
  webview dialog, or an extension-host `showWarningMessage` confirmation.
- The destructive action label must be `Delete`.
- `Cancel` leaves the comment and cached state unchanged.
- While deletion is pending, disable the trash action and any confirmation
  buttons for that `commentId`.
- On success, close confirmation UI and refresh `PullRequestCommentsStore`.
- On failure, keep the comment visible and show the error near the comment
  action area.
- If refresh fails after a successful delete, show that the comment was deleted
  but comments could not be reloaded, then allow manual refresh.

The webview should post a command message to the extension host instead of
calling GitCode directly:

```ts
{
  command: 'deletePullRequestComment',
  commentId: string
}
```

### Native Diff Editor

For locatable diff comments projected into VS Code's Comments API, expose the
same operation through a comment action when the user can delete the comment:

```text
Comment action: Delete
```

Rules:

- Confirm the delete action before calling the API.
- Submit the selected persisted comment id through the same store operation
  used by the overview.
- Refresh `PullRequestCommentsStore` after success so overview and native
  threads rerender from the same API state.
- Show failures through `vscode.window.showErrorMessage` and leave the previous
  thread state intact.
- Do not expose delete on temporary draft comments; discard draft comments
  through the existing draft cancellation flow instead.

If native delete actions require more comment controller infrastructure than
the initial implementation has available, the overview delete flow can ship
first. The service and store APIs should still be shaped so native delete can
call the same operation later without a second API path.

## API Contract

Use the endpoint from [api.md](api.md):

```text
DELETE /api/v5/repos/:owner/:repo/pulls/comments/:id
```

Path variables:

- `owner`: repository owner path
- `repo`: repository path
- `id`: pull request comment id

The documented response is `200 OK`. The API reference currently shows a
request-body placeholder, but the endpoint identifies the target comment
entirely by path. The service should not send a request body unless GitCode
confirms one is required.

Treat a successful response as confirmation only. The caller should refresh the
comments store afterward instead of mutating the cached comment tree locally.

Suggested service surface:

```ts
export interface DeletePullRequestCommentInput {
  commentId: string;
}

commentService.deletePullRequestComment(
  repository: GitCodeRepository,
  input: DeletePullRequestCommentInput,
): Promise<void>;
```

The service should:

- reject a missing `commentId` before issuing the request
- construct the API path with the comment id as `:id`
- send no request payload
- keep authentication and request formatting consistent with the existing
  comment service methods
- return `void` on `200 OK`

## Permission Control

Deleting comments is destructive, so permission control must be applied in both
the UI and extension host.

### Permission Operation

Add a business-level operation:

```ts
export type PermissionOperation =
  | ...
  | 'pr.comment.delete';
```

The current permission API sample documents `note:create` and `note:resolve`,
but it does not document `note:delete`. Use this mapping:

```text
primary permission point: note:delete, when present in the snapshot
fallback permission point: none unless GitCode explicitly documents one
ownership rule: current user is the comment author
server authority: DELETE API response
```

If the permission snapshot contains `note:delete`, it should grant delete for
repository moderators or maintainers. If the snapshot does not contain
`note:delete`, do not infer broad delete permission from `note:create` by
default. `note:create` may allow comment creation or editing in existing docs,
but it is too broad for destructive deletion unless GitCode confirms that
mapping.

Add a centralized ownership helper:

```ts
export function canDeleteOwnComment(
  currentUserLogin: string | undefined,
  commentAuthorLogin: string | undefined,
): boolean;
```

The rule should use the same case-insensitive login comparison as
`canEditOwnComment`.

### UI Gating

Overview and native comment projections should evaluate delete capability per
comment because ownership is object-specific:

```ts
evaluatePermission(
  'pr.comment.delete',
  snapshot,
  {
    scope: 'note',
    action: 'delete',
    message: repository =>
      `You do not have permission to delete comments in ${repository.fullName}.`,
  },
  {
    objectRuleAllows: canDeleteOwnComment(currentUserLogin, comment.author.login),
  },
);
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
- Do not rely on UI gating as the only enforcement.

### Handler Enforcement

Every delete command handler must re-check permission before calling the
service:

- find the target comment in the current `PullRequestCommentsStore` snapshot
- compare current user login to the target comment author login
- evaluate `pr.comment.delete`
- stop before the API call when permission is known denied
- if permission state is unavailable because the permission endpoint failed,
  allow the request only for own comments when ownership is known; otherwise
  show the permission message

The server remains final authority. If the delete API returns `403` or `404`,
show the API error and refresh the permission snapshot in the background when
possible.

## State Model

The canonical comment objects remain owned by `PullRequestCommentsStore`.
Deletion should add transient operation state outside the comment object:

```ts
export interface PullRequestCommentDeleteOperation {
  commentId: string;
  status: 'confirming' | 'pending' | 'failed';
  error?: string;
}
```

The operation state is temporary. It must not remove the comment from the
canonical comments snapshot before the delete API succeeds and the store
refresh returns updated data.

If a deleted comment was the parent of a discussion, the refreshed API response
is authoritative for whether replies disappear, remain as a collapsed deleted
thread, or are re-parented. The extension should not invent that behavior
locally.

## Architecture

```text
Overview trash action
        |
        v
Overview confirmation UI
        |
        v
PullRequestOverviewPanel permission check
        |
        +---------------------------+
                                    |
Native comment delete command       |
        |                           |
        v                           v
DiffCommentController -> PullRequestCommentsStore.deleteComment()
                                    |
                                    v
                    CommentService.deletePullRequestComment()
                                    |
                                    v
                    PullRequestCommentsStore.refresh()
                                    |
                                    v
                 Overview and native threads rerender
```

Dependency rules:

- The webview sends command messages to the extension host; it does not call
  GitCode directly.
- The native comment controller should call the same store operation as the
  overview.
- The store serializes concurrent delete operations per `commentId`.
- The service owns API path construction and request formatting.
- UI projections render pending/error state but do not mutate cached comments.
- Permission evaluation lives in `view/permissions/*`, not in ad hoc webview
  conditionals.

## Webview Messages

Opening and cancelling confirmation are local webview state. Confirming delete
posts the target comment id:

```ts
{
  command: 'deletePullRequestComment',
  commentId: string
}
```

The extension host should reply through the normal overview state refresh path.
If deletion fails before a refresh can happen, it should send an error state
back to the webview for the matching `commentId`.

## Validation and Errors

- Reject missing `commentId` before calling the service.
- Reject deletion when the target comment does not exist in the current
  comments snapshot.
- Require confirmation before the write API call.
- If an operation is already pending for the same `commentId`, ignore or block
  duplicate submissions.
- Show permission failures before API failures when local permission is known
  denied.
- Show API failures beside the delete action in the overview.
- Keep the comment visible after failure.
- If refresh fails after a successful delete, show that deletion succeeded but
  comments could not be reloaded.

## Proposed Files

Update:

```text
src/common/models.ts
src/gitcode/services/commentService.ts
src/view/state/pullRequestCommentsStore.ts
src/view/overview/overviewHtml.ts
src/view/overview/pullRequestOverviewPanel.ts
src/view/comments/diffCommentController.ts
src/view/comments/commentThreadFactory.ts
src/view/permissions/ownershipRules.ts
src/view/permissions/permissionOperations.ts
src/view/permissions/permissionEvaluator.ts
```

Add or update tests near the existing pull request comment and permission
tests.

## Testing

- `CommentService.deletePullRequestComment` validates missing `commentId`.
- The service sends `DELETE` to
  `/api/v5/repos/:owner/:repo/pulls/comments/:id` with no request body.
- The store calls the delete service, then refreshes the same pull request
  comments snapshot.
- Duplicate pending deletes for the same `commentId` do not send duplicate API
  requests.
- The overview renders delete only for comments the current user can delete, or
  renders disabled permission-tooltipped controls if that pattern is used.
- The overview requires confirmation before posting
  `deletePullRequestComment`.
- The overview disables delete controls while deletion is pending.
- The overview keeps the comment visible and shows an error when deletion
  fails.
- The overview rerenders from refreshed state after successful deletion.
- Permission tests cover `pr.comment.delete` with `note:delete` present,
  own-comment ownership, missing current user, and known-denied permissions.
- Native comment controller tests should verify command wiring, confirmation,
  permission checks, and shared store refresh when native delete is included.

