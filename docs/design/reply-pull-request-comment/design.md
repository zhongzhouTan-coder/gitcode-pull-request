# Reply Pull Request Comment Design

## Goal

Allow users to reply to an existing pull request discussion.

The feature must:

- use the reply comment API documented in [api.md](api.md)
- support replies to pull request conversation comments
- support replies to pull request diff discussions
- keep API access inside `gitcode/services/*`, not in the view layer
- keep `PullRequestCommentsStore` as the source of truth
- refresh comments after a successful reply
- preserve the drafted reply body when submission fails

This design extends the normalized comments architecture from
[../list-comments/design.md](../list-comments/design.md). The existing
overview conversation and native diff editor projections should continue to
render from the shared comments store after each mutation.

## Scope

### In Scope

- Add a reply action to each top-level pull request discussion in the overview
  conversation.
- Add an inline reply composer below the selected discussion or below the
  existing replies for that discussion.
- Submit a reply body to the discussion identified by `discussionId`.
- Refresh `PullRequestCommentsStore` after a successful reply.
- Show progress and API errors in the UI that initiated the action.
- Preserve the user's drafted body when the API request fails.
- Support native VS Code comment thread replies for diff discussions that are
  already projected into the editor.

### Out of Scope

- Creating new top-level comments.
- Editing or deleting replies.
- Resolving or reopening discussions.
- Replying to stale diff locations that are not present in the current
  normalized comments snapshot.
- Optimistically appending replies to cached comments before the API confirms
  success.
- Markdown preview mode inside the reply form.
- Pending review batches or submit-review state.

## User Experience

### Pull Request Overview

Each top-level comment card should show a compact reply action near the other
comment controls:

```text
@octocat                                      Jun 17, 16:13   [Reply]
Looks good to me.
```

For diff discussions, place the action with the discussion header controls so
it remains associated with the whole thread:

```text
Code comment · src/example.ts · line 24       Unresolved   [Reply]
@octocat                                      Jun 17, 16:13
Consider extracting this condition.
```

When users activate `Reply`, show an inline composer at the end of that
discussion:

```text
  @hubot                                      Jun 17, 16:20
  Existing reply.

  [textarea: Write a reply...]

  [Reply] [Cancel]
```

Rules:

- The reply action opens one inline reply composer for the selected
  `discussionId`.
- Only one overview reply composer needs to be open at a time.
- Pre-fill the composer only with an empty draft.
- `body` is required after trimming.
- Disable `Reply` when the trimmed body is empty.
- Disable `Reply`, `Cancel`, and the parent reply action while submission is in
  flight for that `discussionId`.
- On success, clear and close the composer, then refresh
  `PullRequestCommentsStore`.
- On failure, keep the composer open, preserve the typed body, and show the API
  error near the composer actions.
- `Cancel` closes the composer and discards only that draft.
- Render the saved reply through the existing sanitized markdown pipeline after
  the store refreshes.

The webview should post a command message to the extension host instead of
calling GitCode directly:

```ts
{
  command: 'replyPullRequestComment',
  discussionId: string,
  body: string
}
```

### Native Diff Editor

For locatable diff discussions projected into VS Code's Comments API, users
should be able to reply through the native comment thread reply flow.

Rules:

- Enable replies on persisted `vscode.CommentThread` instances for current
  diff discussions.
- Submit native reply bodies through the same store operation used by the
  overview.
- Use the thread's `discussionId` as the target API identifier.
- Reject empty bodies before calling the API.
- Refresh `PullRequestCommentsStore` after success so overview and native
  threads rerender from the same API state.
- Show failures through `vscode.window.showErrorMessage` and leave the previous
  thread state intact.

If the initial native comment controller cannot support reply drafts without
larger VS Code Comments API changes, the overview reply flow can ship first.
The service and store APIs should still be shaped so native replies can call
the same operation later.

## API Contract

Use the endpoint from [api.md](api.md):

```text
POST /api/v5/repos/:owner/:repo/pulls/:number/discussions/:discussion_id/comments
```

Request body:

```json
{
  "body": "Reply content"
}
```

The documented response returns the new reply id, body, and `note_id`:

```json
{
  "id": "73b1babf3cff8703f99ac535510a4d11765d658f",
  "body": "test reply",
  "note_id": 178162257
}
```

Treat the response as an acknowledgement only. The reply response does not
include the full normalized author, timestamp, and discussion shape needed by
the overview and native comment projections, so callers should refresh the
comments store after success.

Suggested service surface:

```ts
export interface ReplyPullRequestCommentInput {
  discussionId: string;
  body: string;
}

export interface ReplyPullRequestCommentResult {
  id: string;
  noteId?: number;
  body: string;
}

commentService.replyPullRequestComment(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  input: ReplyPullRequestCommentInput,
): Promise<ReplyPullRequestCommentResult>;
```

The service should:

- trim only for validation; send the user's actual reply body value
- construct the API path with `discussion_id`
- send only `body` in the request payload
- map `id`, `note_id`, and `body` for diagnostics or transient success
  messages
- keep authentication and request formatting consistent with existing comment
  service methods

## State Model

The canonical reply objects remain nested under their parent discussion in
`PullRequestCommentsStore`:

```ts
export interface PullRequestCommentReply {
  id: string;
  body: string;
  author: PullRequestCommentAuthor;
  createdAt: string;
  updatedAt: string;
}
```

Add transient operation state outside the canonical comment objects:

```ts
export interface PullRequestCommentReplyOperation {
  discussionId: string;
  body: string;
  status: 'pending' | 'failed';
  error?: string;
}
```

The operation state is temporary view state. It must not append a reply to the
canonical comments snapshot before the API succeeds and the refresh returns the
new server state.

## Architecture

```text
Overview reply action
        |
        v
Overview inline reply form
        |
        v
PullRequestOverviewPanel
        |
        +------------------------+
                                 |
Native thread reply              |
        |                        |
        v                        v
DiffCommentController -> PullRequestCommentsStore.replyToComment()
                                 |
                                 v
                    CommentService.replyPullRequestComment()
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
- The store serializes concurrent reply operations per `discussionId`.
- The service owns API path construction and request body formatting.
- UI projections render pending/error state but do not mutate cached comments.

## Webview Messages

Opening, typing, and cancelling a reply are local webview state. Submitting
posts the target discussion and body:

```ts
{
  command: 'replyPullRequestComment',
  discussionId: string,
  body: string
}
```

The extension host should reply through the normal overview state refresh path.
If the reply fails before a refresh can happen, it should send an error state
back to the webview for the matching `discussionId`.

## Validation and Errors

- Reject missing `discussionId` before calling the service.
- Reject empty `body.trim()` before calling the service.
- Reject replies when the target discussion does not exist in the current
  comments snapshot.
- If an operation is already pending for the same `discussionId`, ignore or
  block duplicate submissions.
- Show API failures beside the reply composer in the overview.
- Keep the reply composer open after failure.
- Do not discard user-entered text unless the user cancels or submission
  succeeds.
- If refresh fails after a successful reply, show that the reply was submitted
  but comments could not be reloaded, then allow manual refresh.

## Proposed Files

Update:

```text
src/common/models.ts
src/gitcode/services/commentService.ts
src/gitcode/mappers/commentMapper.ts
src/view/state/pullRequestCommentsStore.ts
src/view/overview/overviewHtml.ts
src/view/overview/pullRequestOverviewPanel.ts
src/view/comments/diffCommentController.ts
src/view/comments/commentThreadFactory.ts
```

Add tests near the existing pull request comment tests for service validation,
store refresh behavior, overview message handling, and native thread reply
submission when the native flow is implemented.

## Testing

- `CommentService.replyPullRequestComment` validates empty body and missing
  `discussionId`.
- The service posts to
  `/api/v5/repos/:owner/:repo/pulls/:number/discussions/:discussion_id/comments`
  with `{ body }`.
- The mapper handles `id`, `note_id`, and `body` from the reply response.
- The store calls the reply service, then refreshes the same pull request
  comments snapshot.
- Duplicate pending replies for the same `discussionId` do not send duplicate
  API requests.
- The overview disables submit for empty drafts and while submission is
  pending.
- The overview preserves draft text and shows an error when submission fails.
- The overview closes the composer and rerenders replies from refreshed state
  after success.
- Native thread reply tests should verify the thread submits with the correct
  `discussionId` and refreshes the shared store.
