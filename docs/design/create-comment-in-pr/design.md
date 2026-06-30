# Submit Pull Request Comment Design

## Goal

Add comment submission for GitCode pull requests.

The feature must:

- create a pull request conversation comment from the pull request overview page
- create an inline diff comment from a pull request diff editor
- use the create comment API documented in [api.md](api.md)
- keep API access inside `gitcode/services/*`, not in the view layer
- reuse the existing pull request comments store as the source of truth
- refresh the overview conversation and native diff comment threads after a
  successful submission
- validate required inputs before sending the request

The implementation should extend the current read-only comments architecture
from [../list-comments/design.md](../list-comments/design.md). The normalized
comments store remains the shared cache, while the overview webview and native
diff editor stay separate projections of the same pull request comment state.

## Scope

### In Scope

- Add a pull request comment composer to the pull request overview conversation
  section.
- Add native diff editor commenting support for opened `gitcode-pr` diff
  documents.
- Submit PR-level comments with `body`.
- Submit diff comments with `body`, `path`, `position`, and `position_type`.
- Support text line comments with `position_type: "text"`.
- Support file-level comments with `position_type: "binary"` when no line
  position applies.
- Map VS Code zero-based editor lines to GitCode one-based positions.
- Reject unsupported locations before calling the API.
- Refresh `PullRequestCommentsStore` after successful creation.
- Show submission progress and API errors in the UI that initiated the action.

### Out of Scope

- Editing or deleting comments.
- Replying to an existing discussion.
- Resolving or reopening a discussion.
- Pending review batches or submit-review state.
- Suggested changes.
- Old-side inline comments unless the API contract documents old-side position
  fields.
- Historical or outdated diff snapshots.
- Offline draft persistence.

## User Experience

### Pull Request Overview

The overview page should add a compact composer at the top of the existing
`Conversation` section:

```text
Conversation

Write a comment...

[Comment]
```

Rules:

- The composer sends a PR-level comment.
- `body` is required after trimming.
- The submit button is disabled while the request is in flight.
- On success, clear the composer and reload the conversation.
- On failure, keep the typed body and show the error near the composer.
- Markdown input is accepted; rendered comments continue using the existing
  sanitized markdown pipeline.

The webview should post a command message to the extension host instead of
calling GitCode directly:

```ts
{
  command: 'submitPullRequestComment',
  body: string
}
```

### Diff Editor

When a `gitcode-pr` diff document is open, users should be able to create a
native VS Code comment thread on the head-side document.

Rules:

- Use a `vscode.CommentController.commentingRangeProvider` for eligible
  `gitcode-pr` head documents.
- Allow comments only for current head-side text documents where the PR URI
  contains repository, pull request number, path, side, and head SHA.
- Convert the selected range start line from zero-based VS Code coordinates to
  the one-based GitCode `position`.
- Use the head document path from the parsed PR URI as `path`.
- Submit `position_type: "text"` for line comments.
- Use `position_type: "binary"` only for file-level comments where the file has
  no line-based text document.
- After success, dispose any temporary draft thread and refresh the shared
  comments store so the persisted API comment is recreated from normalized
  state.

Unsupported diff locations should fail before submission with a clear message:

- base-side documents
- non-`gitcode-pr` documents
- outdated or missing snapshot SHA
- missing path
- invalid or empty comment body
- invalid line number

## API Contract

Use the endpoint from [api.md](api.md):

```text
POST /api/v5/repos/:owner/:repo/pulls/:number/comments
```

PR-level comments send only `body`:

```json
{
  "body": "Looks good to me."
}
```

Diff text comments send `body`, `path`, `position`, and `position_type`:

```json
{
  "body": "Consider extracting this condition.",
  "path": "src/example.ts",
  "position": 16,
  "position_type": "text"
}
```

File-level comments send `body`, `path`, and `position_type: "binary"`:

```json
{
  "body": "This generated file needs to be refreshed.",
  "path": "dist/app.bin",
  "position_type": "binary"
}
```

The service should not send `path`, `position`, or `position_type` for
PR-level comments. It should not send `position` when `position_type` is
`"binary"`.

Suggested service surface:

```ts
export type CreatePullRequestCommentInput =
  | {
      kind: 'pullRequest';
      body: string;
    }
  | {
      kind: 'diff';
      body: string;
      path: string;
      position: number;
      positionType: 'text';
    }
  | {
      kind: 'file';
      body: string;
      path: string;
      positionType: 'binary';
    };

commentService.createPullRequestComment(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  input: CreatePullRequestCommentInput,
): Promise<CreatePullRequestCommentResult>;
```

The result only needs the fields required for diagnostics and optimistic UI
messages:

```ts
export interface CreatePullRequestCommentResult {
  id: string;
  noteId?: number;
  body: string;
}
```

After creation, the caller should refresh the store instead of trying to merge
the create response into local state. The create response does not include the
full normalized fields needed by the overview and inline projections.

## Architecture

```text
Overview composer
       |
       v
PullRequestOverviewPanel
       |
       +--------------------+
                            |
Diff editor draft thread    |
       |                    |
       v                    v
DiffCommentController -> CommentService.createPullRequestComment()
                            |
                            v
                  PullRequestCommentsStore.refresh()
                            |
                  +---------+----------+
                  v                    v
       Overview conversation    Native diff threads
```

The store remains the source of truth after submission. The create API response
is treated as an acknowledgement, then the extension reloads the list-comments
endpoint and detail enrichment path already used by the read-only feature.

### Proposed Files

```text
src/
  common/
    models.ts                         # create comment input/result types
  gitcode/
    services/commentService.ts        # createPullRequestComment
    mappers/commentMapper.ts          # create response mapper
  view/
    state/pullRequestCommentsStore.ts # submit helper or refresh after submit
    overview/
      overviewHtml.ts                 # PR-level composer UI
      pullRequestOverviewPanel.ts     # webview message handling
    comments/
      diffCommentController.ts        # commenting range + submit handling
      commentThreadFactory.ts         # persisted comment rendering only
```

Keep submission orchestration close to the initiating UI:

- `PullRequestOverviewPanel` handles overview composer messages.
- `DiffCommentController` handles native diff editor draft comments.
- Both call the same `CommentService` method and then refresh the same
  `PullRequestCommentsStore` entry.

## Validation Rules

Common validation:

- `body.trim()` must be non-empty.
- The user must be signed in before submission.
- Repository owner, repository name, and pull request number must be present.
- API errors should surface the server message when available.

PR-level validation:

- Do not require path or position.
- Do not allow submission if the overview context is stale or missing.

Diff text validation:

- URI scheme must be `gitcode-pr`.
- URI side must be `head`.
- URI path must be present.
- Selected line must map to a positive one-based `position`.
- The document SHA should match the current head SHA for the open PR diff when
  that data is available.
- Multi-line selections should initially submit against the start line only
  because the documented create API accepts a single `position`.

File-level validation:

- Path is required.
- `position_type` must be `"binary"`.
- `position` must be omitted.

## State and Refresh

Add a store-level helper only if it reduces duplicated orchestration:

```ts
async submitComment(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  input: CreatePullRequestCommentInput,
): Promise<CreatePullRequestCommentResult> {
  const result = await this.commentService.createPullRequestComment(repository, pullRequestNumber, input);
  await this.refresh(repository.fullName, pullRequestNumber);
  return result;
}
```

If this helper is added, callers should use it consistently. If callers invoke
`CommentService` directly, they must call `commentsStore.refresh()` on success.

Refresh behavior:

- Invalidate the cached snapshot for the PR.
- Fire the existing comments change event.
- Let the overview reload its conversation state.
- Let `DiffCommentController` recreate native threads from the refreshed
  snapshot.
- Do not optimistically add a local comment unless the create response later
  includes all required normalized fields.

## Error Handling

For overview submission:

- Keep the composer text on failure.
- Display the failure inside the conversation section.
- Do not reload the whole PR detail page for a create error.

For diff submission:

- Show validation errors with `vscode.window.showWarningMessage`.
- Show API errors with `vscode.window.showErrorMessage`.
- Dispose temporary draft threads only after successful submission or explicit
  cancellation.

For authentication:

- Reuse the existing `AuthService.getSession()` pattern.
- If no session exists, show the same sign-in flow or message used by other PR
  actions.

## Testing

Unit tests should cover:

- `CommentService.createPullRequestComment` sends only `body` for PR comments.
- `CommentService.createPullRequestComment` sends `body`, `path`, `position`,
  and `position_type: "text"` for diff comments.
- `CommentService.createPullRequestComment` omits `position` for
  `position_type: "binary"`.
- Empty bodies are rejected before API calls.
- Overview webview message handling calls the submit path and preserves text on
  failure.
- Diff comment submission converts zero-based editor lines to one-based API
  positions.
- Base-side and non-PR documents are rejected.
- Successful submission refreshes `PullRequestCommentsStore`.

Manual verification:

- Add a PR-level comment from the overview and confirm it appears in
  `Conversation`.
- Add a head-side inline comment from a diff and confirm it appears both inline
  and in the overview after refresh.
- Try a base-side inline comment and confirm no API request is sent.
