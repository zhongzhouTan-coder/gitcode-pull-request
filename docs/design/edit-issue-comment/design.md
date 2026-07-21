# Edit Issue Comment Design

## Goal

Allow users to edit an existing comment from the issue overview timeline.

The feature must:

- use the edit issue comment API documented in [api.md](api.md)
- keep GitCode API access inside `gitcode/services/*`, not in the view layer
- keep `IssueCommentsStore` as the source of truth for issue comments
- refresh issue comments after a successful edit
- preserve the previous comment body when editing is cancelled or fails
- apply permission control before rendering enabled actions and before calling
  the write API
- preserve the existing issue timeline behavior for operation logs and related
  pull requests

This design extends the issue comment list, create, and delete flows from
[../get-issue-comments/design.md](../get-issue-comments/design.md),
[../create-issue-comment/design.md](../create-issue-comment/design.md), and
[../delete-issue-comment/design.md](../delete-issue-comment/design.md). The edit
API response is treated as an acknowledgement. After editing, the extension
reloads comments through the existing list-comments path so sorting, mapping,
author data, avatar data, and updated timestamps remain centralized.

## Scope

### In Scope

- Add an edit action to issue comment timeline entries.
- Render the edit action as a compact pencil icon in the issue comment header
  action area.
- Open an inline edit form for the selected issue comment.
- Submit the updated `body` by `commentId`.
- Disable edit controls while the request is in flight.
- Refresh `IssueCommentsStore` after a successful edit.
- Show validation and API errors near the edit form.
- Keep the user's edited body when submission fails.
- Allow users to cancel editing and restore the read-only comment view.
- Re-check permission in the extension-host handler before calling the service.

### Out of Scope

- Creating or deleting issue comments.
- Editing issue title, description, labels, milestone, or state.
- Editing pull request comments or pull request diff comments.
- Replying to issue comments. GitCode issue comments are flat in the current
  API.
- Markdown preview mode inside the edit form.
- Optimistically mutating cached comments before the API confirms success.
- Offline draft persistence.
- Conflict resolution for concurrent edits made outside the extension.

## User Experience

Issue comments render in the issue overview timeline. Each editable issue
comment should show a compact edit action in the top-right comment controls:

```text
@octocat                                      Jul 12, 10:24   [pencil]
I can reproduce this on the latest build.
```

Rules:

- The edit action is an icon-only button.
- Use a pencil icon and an accessible label such as `Edit comment`.
- Place it beside delete and any future comment header actions.
- Use the existing subtle action styling used by issue and pull request
  overview controls.
- Keep the hit target large enough for pointer use even when the icon is
  visually compact.
- Do not enable the action when local permission and ownership data determine
  the current user cannot edit the comment.
- Prefer the existing disabled-control-with-tooltip pattern for permission
  gated actions. If the local renderer already hides unavailable per-comment
  actions, hiding is acceptable only when a disabled control would create noisy
  repeated actions.

Activating the pencil replaces that comment body's read-only markdown with an
inline editor:

```text
@octocat                                      Jul 12, 10:24
[textarea with current markdown body]

[Save] [Cancel]
```

Rules:

- Pre-fill the editor with the current raw markdown body.
- `body` is required after trimming.
- Send the user's actual edited body value; trimming is only for validation.
- Disable `Save` when the trimmed body is empty or unchanged.
- Disable `Save`, `Cancel`, and the pencil button while the edit request is
  running for that `commentId`.
- On success, close the editor and refresh `IssueCommentsStore`.
- On failure, keep the editor open, preserve the typed body, and show the error
  near the editor actions.
- `Cancel` closes the editor without changing the cached comment.
- Only one inline edit form needs to be open in the issue overview at a time.
- Render the saved body through the existing sanitized markdown pipeline after
  the store refreshes.

The webview should post a command message to the extension host instead of
calling GitCode directly:

```ts
{
  command: 'editIssueComment',
  commentId: string,
  body: string
}
```

The extension host should reply with one of:

```ts
{
  command: 'issueCommentEditPending',
  commentId: string
}

{
  command: 'issueCommentEdited',
  commentId: string
}

{
  command: 'issueCommentEditError',
  commentId: string,
  message: string
}
```

Start editing is local webview state and does not need to notify the extension
host. The canonical comment list remains owned by `IssueCommentsStore`.
Webview script state is only for the open editor, pending state, and inline
errors.

## API Contract

Use the endpoint from [api.md](api.md):

```text
PATCH /api/v5/repos/:owner/:repo/issues/comments/:comment_id
```

Path variables:

- `owner`: repository owner path
- `repo`: repository path
- `comment_id`: issue comment id

Request body:

```json
{
  "body": "Updated comment content"
}
```

The documented response is `200 OK`. The current API documentation does not
describe a response body, so callers should treat a successful response as
confirmation only and refresh the comments store afterward.

Suggested service surface:

```ts
export interface EditIssueCommentInput {
  commentId: string;
  body: string;
}

issueCommentService.editIssueComment(
  repository: GitCodeRepository,
  input: EditIssueCommentInput,
): Promise<void>;
```

The service should:

- reject a missing `commentId` before issuing the request
- reject an empty `body.trim()` before issuing the request
- construct the API path with `comment_id`
- encode owner, repo, and comment id consistently with existing service methods
- send only `body` in the request payload
- preserve the user's body value exactly in the payload after validation
- keep authentication and request formatting inside `GitCodeClient`
- return `void` on `200 OK`

## Permission Control

Editing comments must be controlled in both the UI and the extension-host
handler. UI gating prevents accidental actions; the GitCode API remains the
final authority.

### Permission Operation

Add a business-level operation:

```ts
export type PermissionOperation =
  | ...
  | 'issue.comment.edit';
```

Use this mapping:

```text
primary permission point: note:update, if GitCode adds it to the snapshot
current fallback permission point: note:create
ownership rule: current user is the comment author
server authority: PATCH API response
```

The existing permission API design maps pull request comment editing to
`note:create` because the documented permission snapshot does not expose a
separate `note:update` action. Use the same fallback for issue comment editing
to keep comment edit behavior consistent. If GitCode later exposes
`note:update`, switch both issue and pull request comment editing to that
permission point.

Reuse the centralized ownership helper:

```ts
canEditOwnComment(currentUserLogin, comment.author.login)
```

The rule should use case-insensitive login comparison.

### UI Gating

Issue comment edit capability is object-specific because comment ownership is
per comment. Add `canEditComment` to `IssueOverviewPermissions` for the
repository-level permission point, then combine it with the ownership rule when
rendering each comment.

Recommended rule:

```ts
const canEdit =
  permissions.canEditComment
  || canEditOwnComment(currentUserLogin, comment.author.login);
```

Rules:

- Enable edit when `note:create` is present and selected.
- Enable edit for the current user's own comments when ownership can be
  determined locally.
- Disable or hide edit when neither permission nor ownership grants it.
- Keep edit disabled when current user identity is unavailable and no
  permission point grants the operation.
- Show a permission tooltip such as
  `You do not have permission to edit this comment.`
- Do not rely on webview gating as the only enforcement.

When the permission endpoint fails and the issue overview uses unknown
permissions, keep write controls available only when the existing unknown
permission policy does so. The handler must still check ownership before
calling the API when permission state is unavailable.

### Handler Enforcement

The `editIssueComment` message handler must re-check permission before calling
the service:

- find the target comment in the current `IssueCommentsStore` snapshot
- compare current user login to the target comment author login
- evaluate `issue.comment.edit`
- stop before the API call when permission is known denied
- if permission state is unavailable because the permission endpoint failed,
  allow the request only for own comments when ownership is known; otherwise
  show the permission message

If the edit API returns `403` or `404`, show the API error and refresh the
repository permission snapshot in the background when possible.

## State Model

The canonical comment objects remain owned by `IssueCommentsStore`. Editing
adds transient operation state outside the comment object:

```ts
export interface EditIssueCommentInput {
  commentId: string;
  body: string;
}

export interface IssueCommentEditOperation {
  commentId: string;
  body: string;
  status: 'pending' | 'failed';
  error?: string;
}
```

The operation state must not replace the comment's canonical body before the
edit API succeeds and the store refresh returns updated data.

## Architecture

```text
Issue overview pencil action
        |
        v
Issue overview inline edit form
        |
        v
IssueOverviewPanel permission check
        |
        v
IssueCommentsStore.editComment()
        |
        v
IssueCommentService.editIssueComment()
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
- The store serializes concurrent edit operations per `commentId`.
- The service owns API path construction and request body formatting.
- UI projections render pending/error state but do not mutate cached comments.
- Permission evaluation lives in `view/permissions/*`, not in ad hoc webview
  conditionals.
- Issue comments stay separate from pull request comments because issue
  comments have no diff location, discussion state, or native editor
  projection.

## Store Design

Extend `IssueCommentsStore`:

```ts
async editComment(
  repository: GitCodeRepository,
  issueNumber: number,
  input: EditIssueCommentInput,
): Promise<IssueCommentEditOperation>;
```

Rules:

- Check `AuthService.getSession()` before calling the service.
- Reject missing `commentId`.
- Reject empty `body.trim()`.
- Validate that the target comment exists in the current snapshot before
  calling the service.
- Avoid sending duplicate concurrent edit requests for the same comment.
- Treat an unchanged body as a no-op before calling the service.
- Call `IssueCommentService.editIssueComment`.
- On success, call `refresh(repository, issueNumber)`.
- On failure, leave the cached comment snapshot unchanged and return or rethrow
  the error for the panel to render.

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
src/view/permissions/permissionMessages.ts
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
- Reject editing when the target comment does not exist in the current comments
  snapshot.
- Reject empty `body.trim()` before calling the service.
- Treat an unchanged body as a no-op and keep `Save` disabled.
- If an operation is already pending for the same `commentId`, ignore or block
  duplicate submissions.
- Show permission failures before API failures when local permission is known
  denied.
- Show API failures beside the edit controls in the issue overview.
- Keep the edit form open and preserve user-entered text after failure.
- Do not discard user-entered text unless the user cancels.
- If refresh fails after a successful edit, show that the comment was updated
  but comments could not be reloaded.

## Testing

- `IssueCommentService.editIssueComment` validates missing `commentId`.
- `IssueCommentService.editIssueComment` validates empty `body.trim()`.
- The service sends `PATCH` to
  `/api/v5/repos/:owner/:repo/issues/comments/:comment_id` with `{ body }`.
- The store calls the edit service, then refreshes the same issue comments
  snapshot.
- Duplicate pending edits for the same `commentId` do not send duplicate API
  requests.
- The overview renders edit only for comments the current user can edit, or
  renders disabled permission-tooltipped controls if that pattern is used.
- The overview opens an inline editor with the raw markdown body.
- The overview disables `Save` for empty or unchanged bodies.
- The overview posts `editIssueComment` with `commentId` and `body`.
- The overview disables edit controls while editing is pending.
- The overview keeps the editor open and shows an error when editing fails.
- The overview rerenders from refreshed state after successful editing.
- Permission tests cover `issue.comment.edit` with the `note:create` fallback,
  own-comment ownership, missing current user, unknown permission state, and
  known-denied permissions.
