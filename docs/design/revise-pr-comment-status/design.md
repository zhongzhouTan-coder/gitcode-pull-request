# Revise Pull Request Comment Status Design

## Goal

Allow users to mark a pull request diff discussion as resolved or unresolved.

The feature must:

- use the revise status API documented in [api.md](api.md)
- turn the existing resolved status label into a toggle control
- allow both transitions: unresolved to resolved, and resolved to unresolved
- keep `PullRequestCommentsStore` as the source of truth
- refresh comments after a successful status change
- keep normal PR-level comments out of the resolved workflow

This design extends the pull request comments display work in
[../list-comments/design.md](../list-comments/design.md) and replaces the
future-only resolve/reopen notes in
[../list-comments/resolve-review-comments.md](../list-comments/resolve-review-comments.md)
with a confirmed mutation path.

## Scope

### In Scope

- Display a toggle for every diff discussion that has a `resolved` state.
- Toggle unresolved discussions to resolved.
- Toggle resolved discussions back to unresolved.
- Update the pull request overview conversation UI.
- Update native VS Code diff comment thread actions when the discussion is
  projected into the editor.
- Show progress while the request is running.
- Refresh the shared comments store after success.
- Preserve the previous UI state and show an error after failure.

### Out of Scope

- Marking PR-level comments as resolved.
- Changing comment body, replies, or review content.
- Creating a third status beyond resolved and unresolved.
- Optimistically mutating the shared comments cache.
- Resolving old historical diff snapshots unless the API is confirmed to
  support them.
- Batch resolving multiple discussions at once.

## User Experience

### Pull Request Overview

For diff comments in the `Conversation` section, replace the read-only
`Review status` value with a compact toggle:

```text
Code comment · src/example.ts · line 24
Review status  [Resolved  on]

Code comment · src/example.ts · line 31
Review status  [Unresolved  off]
```

Rules:

- Render the toggle only for `comment.kind === 'diff'`.
- Do not render a status toggle for `pr_comment` records.
- The toggle checked state maps directly to `comment.resolved`.
- Checked means `Resolved`.
- Unchecked means `Unresolved`.
- The accessible label should include the target state, for example
  `Mark discussion as resolved` or `Mark discussion as unresolved`.
- Disable the toggle while its request is running.
- Keep the current value visible while the request is running.
- On success, refresh `PullRequestCommentsStore`; do not locally flip the
  persisted comment object.
- On failure, keep the old state selected and show the API error near the
  toggle.

The toggle should stay visually close to the existing status label placement:
in the diff comment card header area or aligned to the top-right when there is
enough width. On narrow layouts, it can wrap below the author/time row before
the comment body.

Use VS Code theme tokens and the existing overview control style. Avoid strong
green/red status colors; the state text and toggle position are sufficient.

### Native Diff Editor

For locatable diff discussions projected into VS Code's Comments API, expose
the same two-state operation through thread actions:

```text
Unresolved thread: Resolve
Resolved thread: Mark as unresolved
```

Rules:

- `thread.state` continues to reflect the canonical `comment.resolved` value.
- Show only the action that changes the current state.
- Disable or ignore the action while a status request is already running for
  the same `discussionId`.
- Refresh `PullRequestCommentsStore` after success so both overview and native
  threads rerender from the same API state.
- Show failures through `vscode.window.showErrorMessage` and leave the previous
  state intact.

## API Contract

Use the endpoint from [api.md](api.md):

```text
PUT /api/v5/repos/:owner/:repo/pulls/:number/comments/:discussion_id
```

Request body:

```json
{
  "resolved": true
}
```

`resolved: true` marks the discussion as resolved. `resolved: false` marks it
as unresolved.

The API returns an empty object:

```json
{}
```

The service should expose the operation as a state-setting call rather than a
blind toggle. The UI decides the next value from the current canonical state,
then sends the desired final value:

```ts
export interface RevisePullRequestCommentStatusInput {
  discussionId: string;
  resolved: boolean;
}

commentService.revisePullRequestCommentStatus(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  input: RevisePullRequestCommentStatusInput,
): Promise<void>;
```

Use `discussion_id` in the URL. Do not send comment `id` or `note_id` unless a
future API version requires them.

## State Model

The domain model remains a strict two-state value:

```ts
export interface PullRequestDiffComment {
  kind: 'diff';
  discussionId: string;
  resolved: boolean;
}
```

Add transient operation state outside the comment object:

```ts
export interface PullRequestCommentStatusOperation {
  discussionId: string;
  resolved: boolean;
  status: 'pending' | 'failed';
  error?: string;
}
```

The operation state is view state only. It must not replace the comment's
canonical `resolved` value from the list-comments API.

## Architecture

```text
Overview status toggle
        |
        v
PullRequestOverviewPanel
        |
        +-------------------------+
                                  |
Native thread command             |
        |                         |
        v                         v
DiffCommentController -> PullRequestCommentsStore.reviseCommentStatus()
                                  |
                                  v
                    CommentService.revisePullRequestCommentStatus()
                                  |
                                  v
                    PullRequestCommentsStore.refresh()
                                  |
                                  v
                 Overview and native threads rerender
```

Dependency rules:

- The webview sends a command message to the extension host; it does not call
  GitCode directly.
- The native comment controller calls the same store method as the overview.
- The store serializes concurrent operations per `discussionId`.
- The service owns API path construction and request body formatting.
- UI projections render pending/error state but do not mutate cached comments.

## Webview Message

The overview should post a command with the desired final state:

```ts
{
  command: 'revisePullRequestCommentStatus',
  discussionId: string,
  resolved: boolean
}
```

Validation before sending the API request:

- `discussionId` must be non-empty.
- The target comment must exist in the current snapshot.
- The target comment must be a diff comment.
- The requested `resolved` value must differ from the current canonical value.
- If an operation is already pending for the same `discussionId`, ignore the
  duplicate request.

## Error Handling

- Permission errors: show the API message near the toggle or through the native
  VS Code error message path.
- Missing discussion: refresh the comments store, then show a concise error if
  the discussion still does not exist.
- Network failure: keep the old state and allow the user to retry.
- Empty API response: treat HTTP success as success and refresh the store.
- Refresh failure after successful mutation: show that the status changed but
  the comments could not be reloaded, then allow manual refresh.

## Proposed Files

Update:

```text
src/gitcode/services/commentService.ts
src/view/state/pullRequestCommentsStore.ts
src/view/overview/overviewHtml.ts
src/view/overview/pullRequestOverviewPanel.ts
src/view/comments/diffCommentController.ts
src/view/comments/commentThreadFactory.ts
src/common/models.ts
```

Add tests near the existing pull request comment tests for service, store, and
rendering behavior.

## Testing

- Service sends `PUT` to
  `/repos/:owner/:repo/pulls/:number/comments/:discussion_id`.
- Service sends `{ "resolved": true }` when resolving.
- Service sends `{ "resolved": false }` when marking unresolved.
- Store rejects status changes for PR-level comments.
- Store ignores duplicate pending requests for the same `discussionId`.
- Store refreshes comments after a successful mutation.
- Store preserves the previous snapshot when mutation fails.
- Overview renders a checked toggle for resolved diff comments.
- Overview renders an unchecked toggle for unresolved diff comments.
- Overview does not render a toggle for PR-level comments.
- Overview posts `revisePullRequestCommentStatus` with the desired final state.
- Native thread action resolves unresolved discussions.
- Native thread action marks resolved discussions as unresolved.
- Native thread state rerenders from refreshed store data.
