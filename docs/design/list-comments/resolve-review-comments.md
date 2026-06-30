# Resolve Pull Request Review Comments Feature

## Problem

Pull request review discussions need to expose their `resolved` state in the
extension. The list-comments API already returns `resolved` for
`diff_comment` records, but users need the state to be visible in the pull
request conversation and native diff comment thread. Later, the extension
should also support a GitHub-like action for marking a review discussion as
resolved or unresolved.

The review discussion status is a two-state value only. It can transfer from
`Unresolved` to `Resolved`, or from `Resolved` back to `Unresolved`.

This feature builds on the read-only comments design in [design.md](design.md)
and the list-comments API contract in [api.md](api.md).

## Goals

- Display resolved and unresolved state for every diff review discussion
  returned by the list-comments API.
- Treat review discussion status as a strict two-state value:
  `resolved` or `unresolved`.
- Keep pull request comments and diff review discussions visually distinct.
- Map resolved diff discussions to VS Code's native resolved thread state.
- Add a clear product and code path for future resolve and reopen actions.
- Refresh the shared comments store after any future resolution change.

## Non-Goals

- Marking normal PR-level comments as resolved.
- Inferring resolution from reply text, robot commands, or commit links.
- Mutating resolution before GitCode's resolve/reopen API is confirmed.
- Supporting old or outdated historical diff snapshots as part of this feature.
- Implementing GitHub review batching or pending review state.

## Current Read-Only Behavior

The source of truth is `PullRequestCommentsStore`. The mapper should preserve
the API field:

```ts
export interface PullRequestDiffComment {
  kind: 'diff';
  resolved: boolean;
}
```

Only `diff_comment` records can carry `resolved`. `pr_comment` records must not
show a review resolution status.

### Pull Request Overview

Each diff discussion card should show a dedicated review status area separate
from the location and metadata row:

```text
Code comment · src/example.ts · line 24
Review status: Resolved

Code comment · src/example.ts · line 31
Review status: Unresolved
```

Rules:

- Show `Resolved` when `comment.kind === 'diff' && comment.resolved === true`.
- Show `Unresolved` when `comment.kind === 'diff' && comment.resolved === false`.
- Show no review resolution status for PR-level comments.
- Render review status in a dedicated place, separate from metadata badges.
- Keep the existing `Outdated` badge independent from review status; a
  discussion may be both outdated and resolved.
- Do not place `Resolved` or `Unresolved` in the same badge group as `Outdated`.
- Use the sanitized markdown rendering path for comment bodies and replies.

### Review Status Style

The review status should feel harmonious with the current pull request overview
design. It should use the same card vocabulary, spacing scale, and VS Code
theme tokens rather than a bright success/warning badge.

Preferred style:

- Use a compact status line:
  - label: `Review status`
  - value: `Resolved` or `Unresolved`
- Place it in the diff comment card header area or aligned to the top-right of
  the card when there is enough width.
- On narrow layouts, let it wrap below the author/time header before the
  comment body.
- Avoid creating a nested card or boxed badge inside the comment card.
- Use the normal foreground color for the value and muted text for the label.
- Avoid strong green/red status colors for the read-only state; reserve stronger
  color only for future action feedback such as success or API failure.
- Keep `Outdated` in the metadata badge group near the file and line location.

Example structure:

```html
<div class="comment-review-status">
  <span class="comment-review-status-label">Review status</span>
  <span class="comment-review-status-value">Resolved</span>
</div>
```

### Native Diff Editor

When a locatable diff discussion is projected into VS Code's Comments API:

```ts
thread.state = comment.resolved
  ? vscode.CommentThreadState.Resolved
  : vscode.CommentThreadState.Unresolved;
```

Rules:

- Set the parent comment `contextValue` to distinguish resolved and unresolved
  threads.
- Use compact labels such as `Resolved` and `Unresolved` for review threads.
- Keep read-only threads non-replyable until mutation support exists.
- Continue skipping outdated comments for current diff editor binding.

## Future Resolve/Reopen Behavior

After GitCode exposes or confirms the API for changing review discussion
resolution, add commands that mirror GitHub's review thread controls:

- `GitCode: Resolve Review Comment`
- `GitCode: Reopen Review Comment`

The commands should be available from:

- the pull request overview diff discussion card
- the native VS Code comment thread context menu

### UX Rules

- Show `Resolve` only for diff discussions with an `Unresolved` state.
- Show `Reopen` only for diff discussions with a `Resolved` state.
- Disable or hide actions for PR-level comments.
- Disable or hide actions for outdated discussions unless GitCode confirms the
  API supports changing outdated discussion resolution.
- Show progress while the request is running.
- On success, refresh `PullRequestCommentsStore` instead of locally toggling
  the value.
- On failure, keep the previous UI state and show the API error near the action
  source.

## API Contract To Confirm

The list-comments API returns the read state:

```json
{
  "id": 176153829,
  "discussion_id": "9035cc85d114b0e24b5b48104ecf51f94a901be2",
  "comment_type": "diff_comment",
  "resolved": true
}
```

The mutation API is not documented in this repository yet. Before
implementation, confirm:

- endpoint path
- HTTP method
- whether the operation targets `comment id` or `discussion_id`
- request body shape
- response body shape
- permission errors for authors, reviewers, and repository maintainers
- behavior for outdated discussions

Expected service surface after confirmation:

```ts
export type PullRequestReviewResolution = 'resolved' | 'unresolved';

commentService.updatePullRequestReviewResolution(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  input: {
    commentId: string;
    discussionId: string;
    resolution: PullRequestReviewResolution;
  },
): Promise<void>;
```

If the confirmed API only requires one identifier, keep both identifiers in the
domain model but send only the required field.

The mutation request must not introduce any third state. The extension should
only request a transfer to `resolved` or `unresolved`, then reload the canonical
state from the list-comments API.

## Architecture

```text
List comments API
      |
      v
commentMapper.resolved
      |
      v
PullRequestCommentsStore
      |
      +--> Overview diff card badge
      |
      +--> VS Code CommentThread.state

Future resolve/reopen command
      |
      v
CommentService.updatePullRequestReviewResolution()
      |
      v
PullRequestCommentsStore.refresh()
      |
      v
Overview and native threads rerender from fresh API state
```

The store remains the only cache. UI layers must not mutate a local copy of
`resolved` because the server may reject the action or return a different final
state.

## Proposed Files

```text
src/
  gitcode/
    services/commentService.ts          # future resolve/reopen API call
    mappers/commentMapper.ts            # keep mapping resolved from list API
  view/
    state/pullRequestCommentsStore.ts   # future mutation wrapper and refresh
    overview/overviewHtml.ts            # badge and future card action button
    overview/pullRequestOverviewPanel.ts # future webview command handling
    comments/diffCommentController.ts   # future native thread command handling
    comments/commentThreadFactory.ts    # thread state and context values
```

## Testing

- Mapper maps `resolved: true` to `PullRequestDiffComment.resolved === true`.
- Mapper maps missing or false `resolved` to `false`.
- Overview renders `Resolved` for resolved diff comments.
- Overview renders `Unresolved` for unresolved diff comments.
- Overview does not render `Resolved` for PR-level comments.
- Native thread factory sets `CommentThreadState.Resolved` for resolved
  comments.
- Native thread factory sets `CommentThreadState.Unresolved` for unresolved
  comments.
- Future resolve/reopen command calls the service, refreshes the store, and
  leaves the previous UI state intact on API failure.
