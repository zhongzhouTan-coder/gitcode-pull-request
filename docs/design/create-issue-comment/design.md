# Create Issue Comment Design

## Goal

Allow users to create a comment on a GitCode issue from the issue overview page.

The feature must:

- add a comment composer to the existing issue `Conversation` section
- use the create issue comment API documented in [api.md](api.md)
- submit the typed comment body exactly, including slash commands or other
  command-like text users enter in the issue comment
- keep GitCode API access inside `gitcode/services/*`, not in the view layer
- reuse `IssueCommentsStore` as the source of truth for issue comments
- refresh issue comments after successful creation
- validate required input before sending the request
- show submission progress and API errors near the composer

This design extends the read-only issue comments work from
[../get-issue-comments/design.md](../get-issue-comments/design.md). The create
API response is treated as an acknowledgement. After a successful create call,
the extension reloads comments through the existing list-comments path so the
conversation renders from normalized state.

## Scope

### In Scope

- Add an issue comment composer to the issue overview `Conversation` section.
- Submit top-level issue comments with `body`.
- Preserve markdown and command-like text exactly as entered, after required
  empty-body validation.
- Disable the submit button while the request is in flight.
- Keep the typed body when submission fails.
- Clear the composer after successful submission.
- Refresh `IssueCommentsStore` after successful creation.
- Render the newly created comment through the existing sanitized markdown
  renderer after refresh.
- Surface validation and API errors in the webview.

### Out of Scope

- Editing or deleting issue comments.
- Replying to a specific comment thread. GitCode issue comments are flat in the
  current API.
- Reactions.
- Attachments and file uploads.
- Rich timeline events that are not issue comments.
- Optimistic insertion before the list-comments refresh completes.
- Offline draft persistence.
- Parsing or executing slash commands locally. Command text is submitted as the
  issue comment body and interpreted by GitCode or downstream automation.

## User Experience

The issue overview already renders issue detail, description, related pull
requests, and comments. Add a compact composer at the bottom of the
`Conversation` section:

```text
Conversation (3)

@alice                                      Jul 1, 14:10
rendered markdown comment body

Write a comment...

[Comment]
```

Rules:

- The composer sends an issue comment for the currently open issue.
- `body` is required after trimming.
- The raw submitted value should preserve the user's text, including markdown,
  blank lines, and command-like content such as `/assign @user`.
- The submit button is disabled while the request is in flight.
- On success, clear the composer and reload the conversation.
- On failure, keep the typed body and show the error near the composer.
- If existing comments failed to load, still show the composer when issue detail
  loaded successfully.
- Markdown input is accepted. Persisted comments continue rendering through
  `renderMarkdown`.

The webview should post a command message to the extension host instead of
calling GitCode directly:

```ts
{
  command: 'submitIssueComment',
  body: string
}
```

The extension host should reply with one of:

```ts
{
  command: 'issueCommentSubmitting'
}

{
  command: 'issueCommentSubmitted'
}

{
  command: 'issueCommentSubmitError',
  message: string
}
```

The webview script owns transient composer UI state. The canonical comments
remain owned by `IssueCommentsStore`.

## API Contract

Use the endpoint from [api.md](api.md):

```text
POST /api/v5/repos/:owner/:repo/issues/:number/comments
```

Request body:

```json
{
  "body": "The contents of the comment."
}
```

Suggested service surface:

```ts
export interface CreateIssueCommentInput {
  body: string;
}

export interface CreateIssueCommentResult {
  id: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
}

issueCommentService.createIssueComment(
  repository: GitCodeRepository,
  issueNumber: number,
  input: CreateIssueCommentInput,
): Promise<CreateIssueCommentResult>;
```

`GitCodeClient` remains responsible for authentication, base URL handling, and
request errors. The view layer must not append `access_token` or construct raw
API URLs.

The create response includes fields similar to:

- `id`
- `body`
- `user`
- `target.issue.number`
- `created_at`
- `updated_at`

The service result only needs the fields required for diagnostics and tests.
After creation, callers should refresh comments instead of merging the response
into local state. This keeps sorting, author mapping, avatar mapping, and future
comment fields centralized in the existing list-comments mapper.

## Architecture

```text
Issue overview composer
  -> IssueOverviewPanel
     -> IssueCommentsStore.submitComment()
        -> IssueCommentService.createIssueComment()
        -> GitCodeClient
     -> IssueCommentsStore.refresh()
  -> Issue overview HTML renderer
```

Dependency rules:

- `view` may depend on `common`, `authentication`, and `gitcode/services`.
- `view` must not depend on raw GitCode comment DTOs.
- `gitcode` must not depend on `view`.
- Issue comments stay separate from pull request comments because issue comments
  have no diff location, discussion state, or native editor projection.

## Proposed Files

Update existing files:

```text
src/common/models.ts
src/gitcode/services/issueCommentService.ts
src/view/issueOverview/issueCommentsStore.ts
src/view/issueOverview/issueOverviewHtml.ts
src/view/issueOverview/issueOverviewPanel.ts
src/test/issueCommentsStore.test.ts
src/test/issueOverviewHtml.test.ts
src/test/issueOverviewPanel.test.ts
```

Add a mapper test only if the create response mapper becomes separate from the
service:

```text
src/test/issueCommentMapper.test.ts
```

## Service Design

Extend `IssueCommentService`:

```ts
async createIssueComment(
  repository: GitCodeRepository,
  issueNumber: number,
  input: CreateIssueCommentInput,
): Promise<CreateIssueCommentResult> {
  const response = await this.client.post<Record<string, unknown>>(
    `/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/issues/${issueNumber}/comments`,
    { body: input.body },
  );

  return mapCreateIssueCommentResult(response);
}
```

Mapping rules:

- Convert `id` to a string.
- Map `body` to an empty string when omitted.
- Preserve `created_at` and `updated_at` as strings when present.
- Ignore `user` and `target` in the create result unless needed later.
- Do not reuse the create result as the rendered comment list.

## Store Design

Add a store-level submit helper so panel code does not duplicate authentication,
service calls, refresh, and change notification behavior:

```ts
async submitComment(
  repository: GitCodeRepository,
  issueNumber: number,
  input: CreateIssueCommentInput,
): Promise<CreateIssueCommentResult> {
  const session = await this.authService.getSession();
  if (!session) {
    throw new NotSignedInError('Sign in to GitCode first.');
  }

  const result = await this.commentService.createIssueComment(repository, issueNumber, input);
  await this.refresh(repository, issueNumber);
  return result;
}
```

Rules:

- Validate authentication before calling the service.
- Let `IssueOverviewPanel` validate empty body before calling the store.
- Refresh only after successful creation.
- Do not clear the existing cached snapshot before the API confirms success.
- `refresh()` deletes the cache entry and fires the existing change event.
- Failed submissions should leave the previous comments snapshot available.

## Panel Design

Extend `IssueOverviewPanel` message handling:

```ts
if (message.command === 'submitIssueComment') {
  await this.handleSubmitIssueComment(message.body);
  return;
}
```

`handleSubmitIssueComment` should:

1. Reject missing or empty `body.trim()` and post
   `issueCommentSubmitError`.
2. Post `issueCommentSubmitting` before the API call.
3. Call `commentsStore.submitComment(repository, issueNumber, { body })`.
4. Clear local `commentsSnapshot` and `commentsError`.
5. Reload the panel so issue detail, comments, related pull requests, and edit
   options stay consistent with the existing load path.
6. Post `issueCommentSubmitted` after success if the webview is still active.
7. On failure, log the error and post `issueCommentSubmitError`.

The panel should not call `IssueCommentService` directly if
`IssueCommentsStore.submitComment` exists.

## HTML Rendering

Extend the conversation renderer to include the composer:

```ts
function renderConversation(
  comments: readonly IssueComment[] | undefined,
  commentsError: Error | undefined,
): string;
```

Recommended markup:

```html
<form class="comment-composer" data-action="submitIssueComment">
  <textarea class="comment-input" name="body" placeholder="Write a comment"></textarea>
  <div class="comment-composer-actions">
    <span class="comment-submit-error" hidden></span>
    <button type="submit">Comment</button>
  </div>
</form>
```

Rules:

- The composer belongs inside `Conversation`.
- Render the composer for empty, error, and non-empty comment states.
- Keep comments sorted oldest first above the composer.
- Escape any server-provided text.
- Do not render the typed draft through markdown before submission.
- Do not inject API-provided HTML directly.
- Keep the existing content security policy with per-render nonce.

Webview script behavior:

- Listen for composer submit.
- Read the textarea value.
- Block empty `body.trim()` locally and show `Comment body is required.`
- Post `submitIssueComment` with the original textarea value.
- Disable textarea and button while pending.
- Re-enable controls on failure.
- Clear textarea on success.

## Validation Rules

- `body.trim()` must be non-empty.
- The original body string, not the trimmed string, should be submitted after
  validation so markdown indentation and command formatting are preserved.
- The user must be signed in before submission.
- Repository owner, repository name, and issue number must be present.
- API errors should surface the server message when available.
- Duplicate rapid submissions should be prevented by the pending UI state.

## Error Handling

For validation errors:

- Do not call the API.
- Keep the composer text.
- Show an inline error near the composer.

For API errors:

- Keep the composer text.
- Show the server message when available.
- Do not reload the whole issue page only to display the create error.
- Keep the previous comments visible when available.

For successful submission followed by refresh failure:

- Treat the comment creation as successful.
- Show a message such as `Comment created, but comments could not be refreshed.`
- Keep or show the normal comments error state from the refresh failure.
- Let the user use the existing refresh action to retry loading comments.

## Testing

Add focused unit tests:

- `IssueCommentService.createIssueComment` posts to
  `/api/v5/repos/:owner/:repo/issues/:number/comments`.
- The service sends only `{ body }` in the request payload.
- The create result maps numeric `id` to string.
- `IssueCommentsStore.submitComment` requires authentication.
- `IssueCommentsStore.submitComment` refreshes comments after success.
- `IssueCommentsStore.submitComment` does not refresh after create failure.
- `IssueOverviewPanel` rejects empty bodies before calling the store.
- `IssueOverviewPanel` posts submit success and error messages to the webview.
- `issueOverviewHtml` renders the composer for non-empty, empty, and failed
  comment states.
- Webview submit handling preserves body text on failure and clears it on
  success.

Manual verification:

1. Open the Issues tree.
2. Select an issue.
3. Type a normal markdown comment and submit it.
4. Confirm the composer clears and the new comment appears in `Conversation`.
5. Type a command-like comment such as `/assign @user` and submit it.
6. Confirm the command text is preserved in the created issue comment.
7. Try submitting an empty or whitespace-only body and confirm no API request is
   sent.
8. Simulate an API failure and confirm the typed body remains in the composer.

## Future Extensions

This design leaves room for:

- edit and delete own issue comments
- comment reactions
- attachments
- richer issue timeline events
- autosaved comment drafts
- server-driven command completion if GitCode exposes command metadata
