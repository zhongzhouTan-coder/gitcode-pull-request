# Edit Pull Request Comment Design

## Goal

Allow users to edit an existing pull request comment.

The feature must:

- use the edit comment API documented in [api.md](api.md)
- support editing existing pull request conversation comments
- support editing existing pull request diff comments and replies where the API
  accepts the comment id
- keep API access inside `gitcode/services/*`, not in the view layer
- keep `PullRequestCommentsStore` as the source of truth
- refresh comments after a successful edit
- preserve the previous comment body when editing is cancelled or fails

This design extends the comments display work in
[../list-comments/design.md](../list-comments/design.md) and should reuse the
same normalized comment state used by the pull request overview and native diff
comment projections.

## Scope

### In Scope

- Add an edit action to editable comments in the pull request overview
  conversation.
- Render the edit action as a small pencil icon in the top-right area of the
  comment card header.
- Open an inline edit form for the selected comment.
- Submit the updated `body` with the edit comment API.
- Disable edit controls while the request is in flight.
- Refresh `PullRequestCommentsStore` after a successful edit.
- Show API errors near the edit form and keep the user's edited text.
- Allow users to cancel editing and restore the read-only comment view.

### Out of Scope

- Deleting comments.
- Creating comments.
- Editing resolved status.
- Editing pull request title, description, or metadata.
- Optimistically mutating cached comments before the API confirms success.
- Editing historical or outdated diff snapshot metadata.
- Markdown preview mode inside the edit form.

## User Experience

### Pull Request Overview

Each editable comment card should show a compact edit action in the upper-right
corner of the comment header:

```text
@octocat                                      Jun 17, 16:13   [pencil]
Looks good to me.
```

Rules:

- The edit action is an icon-only button.
- The icon should be a small pencil.
- Place the icon in the comment's top-right area, aligned with the author and
  timestamp row.
- Use the existing subtle action color for comment header controls, such as the
  VS Code foreground or icon foreground token at reduced emphasis.
- On hover and focus, increase contrast using the active foreground token and
  show a visible focus outline.
- Keep the button hit target large enough for pointer use even though the
  pencil glyph is visually small.
- Provide an accessible label such as `Edit comment`.
- Do not show the edit action for comments the current user cannot edit if the
  API or local model can determine ownership.

When users activate the pencil icon, replace that comment body's read-only
markdown with an inline editor:

```text
@octocat                                      Jun 17, 16:13
[textarea with current markdown body]

[Save] [Cancel]
```

Rules:

- Pre-fill the editor with the current raw markdown body.
- `body` is required after trimming.
- Disable `Save` when the trimmed body is empty or unchanged.
- Disable `Save`, `Cancel`, and the pencil button while the edit request is
  running for that comment.
- On success, close the editor and refresh `PullRequestCommentsStore`.
- On failure, keep the editor open, preserve the typed body, and show the error
  near the editor actions.
- `Cancel` closes the editor without changing the cached comment.
- Only one inline edit form needs to be open in the overview at a time.
- Render the saved body through the existing sanitized markdown pipeline after
  the store refreshes.

The webview should post a command message to the extension host instead of
calling GitCode directly:

```ts
{
  command: 'editPullRequestComment',
  commentId: string,
  body: string
}
```

### Native Diff Editor

For locatable diff comments projected into VS Code's Comments API, expose the
same operation through a comment action when the user can edit the comment:

```text
Comment action: Edit
```

Rules:

- The native edit command should collect the new body with VS Code UI or a
  temporary editable comment flow that matches the existing comment controller
  implementation.
- Submit the comment id and updated body through the same store operation used
  by the overview.
- Refresh `PullRequestCommentsStore` after success so overview and native
  threads rerender from the same API state.
- Show failures through `vscode.window.showErrorMessage` and leave the previous
  state intact.

If native editing requires more infrastructure than the initial implementation
has available, the overview edit flow can ship first. The service and store
APIs should still be shaped so native editing can call them later without a
second API path.

## API Contract

Use the endpoint from [api.md](api.md):

```text
PATCH /api/v5/repos/:owner/:repo/pulls/comments/:comment_id
```

Request body:

```json
{
  "body": "Updated comment content"
}
```

The API returns `200 OK`. The current API documentation does not describe a
response body, so callers should treat a successful response as confirmation
only and refresh the comments store afterward.

Suggested service surface:

```ts
export interface EditPullRequestCommentInput {
  commentId: string;
  body: string;
}

commentService.editPullRequestComment(
  repository: GitCodeRepository,
  input: EditPullRequestCommentInput,
): Promise<void>;
```

The service should:

- trim only for validation; send the user's actual edited body value
- construct the API path with `comment_id`
- send only `body` in the request payload
- keep authentication and request formatting consistent with the existing
  comment service methods

## State Model

The canonical comment objects remain owned by `PullRequestCommentsStore`.
Editing should add transient view or store operation state outside the comment
object:

```ts
export interface PullRequestCommentEditOperation {
  commentId: string;
  body: string;
  status: 'pending' | 'failed';
  error?: string;
}
```

The operation state is temporary. It must not replace the comment's canonical
body before the edit API succeeds and the store refresh returns updated data.

## Architecture

```text
Overview pencil action
        |
        v
Overview inline edit form
        |
        v
PullRequestOverviewPanel
        |
        +------------------------+
                                 |
Native comment edit command      |
        |                        |
        v                        v
DiffCommentController -> PullRequestCommentsStore.editComment()
                                 |
                                 v
                    CommentService.editPullRequestComment()
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
- The store serializes concurrent edit operations per `commentId`.
- The service owns API path construction and request body formatting.
- UI projections render pending/error state but do not mutate cached comments.

## Webview Messages

Start editing is local webview state and does not need to notify the extension
host. Saving posts the updated body:

```ts
{
  command: 'editPullRequestComment',
  commentId: string,
  body: string
}
```

The extension host should reply through the normal overview state refresh path.
If the edit fails before a refresh can happen, it should send an error state
back to the webview for the matching `commentId`.

## Validation and Errors

- Reject missing `commentId` before calling the service.
- Reject empty `body.trim()` before calling the service.
- Treat an unchanged body as a no-op and keep `Save` disabled.
- Show API failures beside the edit controls.
- Keep the edit form open after failure.
- Do not discard user-entered text unless the user cancels.

## Testing

- Unit test the service request path and payload.
- Unit test store behavior for success, failure, and per-comment pending state.
- Webview tests should cover pencil visibility, opening the editor, save button
  disabled states, cancel behavior, successful save command payload, and error
  rendering.
- Native comment controller tests should cover command wiring if native editing
  is included in the implementation.
