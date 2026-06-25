# Get Issue Comments Design

## Goal

Display all comments for a GitCode issue in the existing issue overview page.

The feature must:

- call the GitCode get issue comments API documented in [api.md](api.md)
- reuse the issue overview panel created by
  [../get-issue/design.md](../get-issue/design.md)
- render comments under the issue description as a read-only conversation
- keep GitCode API access inside `gitcode/services/*`
- map raw GitCode comment DTOs into domain models before rendering
- reuse the existing sanitized markdown pipeline for comment bodies

The GitHub reference is `vscode-pull-request-github/src/view` together with
`src/github/issueOverview.ts`. GitCode should adopt the useful separation:

- the issue model/store owns normalized issue and comment state
- the webview projects that state into a conversation timeline
- the panel owns refresh and message routing
- the renderer receives view-ready models and never calls APIs directly

GitCode should not adopt GitHub-specific editing, deleting, reactions,
GraphQL timeline events, file uploads, project editing, or Copilot refresh
behavior for this feature.

## Scope

### In Scope

- Fetch all comments for one issue on demand.
- Display comments in the issue overview page below `Description`.
- Render author, timestamp, updated timestamp when different, and markdown body.
- Sort comments by `createdAt`, oldest first.
- Display an empty comments state.
- Display comment loading errors without hiding the issue detail page.
- Refresh issue detail and issue comments from the existing issue refresh action.
- Share concurrent requests for the same issue comments.
- Clear comment caches when authentication or workspace repository context
  changes.

### Out of Scope

- Creating, editing, or deleting issue comments.
- Reactions.
- Attachments and file uploads.
- Timeline events that are not issue comments.
- Inline editor comments. Issue comments do not have file locations.
- Polling, push updates, or background refresh.
- Cross-panel synchronization beyond manual refresh.

## User Experience

The entry point remains the issue tree:

```text
Issues
  owner/repo (origin)
    All Open
      #309 [Bug-Report] Quantization warning for Qwen3.6
```

Opening the issue shows the existing issue overview. Add `Conversation` after
the description in the main column:

```text
Issue: #309 Quantization warning for Qwen3.6

Header
  Open | TODO | Bug-Report | title | number
  author | created time | updated time
  Open on GitCode | Refresh

Main Content
  Description
    rendered markdown issue body

  Conversation (3)
    @anreywmh                                      Jun 16, 11:29
    rendered markdown comment body

    @yejiajun                                     Jun 18, 09:52
    rendered markdown comment body

Sidebar
  existing issue metadata
```

Rules:

- Show `Conversation (<count>)` using the loaded comment count. If comments fail
  to load, keep the issue detail `comments` count in the sidebar unchanged.
- Show `No comments yet` when the endpoint returns an empty array.
- Show `Unable to load comments` inside the Conversation section when only the
  comments request fails.
- Render each comment body through `renderMarkdown`.
- Escape all author, date, and issue metadata text.
- Never inject API-provided HTML directly.
- Keep the first version read-only. Buttons inside comments are not needed.
- User profile links can use the existing trusted `openUrl` webview command
  only when the URL has the same origin as the repository `webUrl`.

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/:repo/issues/:number/comments
```

The service call should be:

```ts
issueCommentService.listIssueComments(repository, issueNumber);
```

`GitCodeClient` remains responsible for authentication, base URL handling, and
request errors. The view layer must not append `access_token` or construct raw
API URLs.

The response is an array of comments. Minimum fields needed by the page:

- `id`
- `body`
- `user`
- `target.issue.number`
- `created_at`
- `updated_at`

## Domain Model

Add issue comment types in `src/common/models.ts`. Keep them separate from pull
request comments because issue comments have no diff location, discussion
state, or reply structure in the current API.

```ts
export interface IssueCommentAuthor {
  id?: string;
  login: string;
  name?: string;
  htmlUrl?: string;
  avatarUrl?: string;
}

export interface IssueComment {
  id: string;
  body: string;
  author: IssueCommentAuthor;
  createdAt: string;
  updatedAt: string;
  issueNumber?: number;
}

export interface IssueCommentsSnapshot {
  repositoryKey: string;
  issueNumber: number;
  comments: readonly IssueComment[];
  loadedAt: number;
}
```

### Mapping Rules

- Convert `id` to a string so large numeric API IDs are not coupled to JS
  integer behavior.
- Map `body` to an empty string when omitted.
- Map `user` to `author`; tolerate missing `user` by using `unknown`.
- Prefer `user.login`; fall back to `user.name`, then `unknown`.
- Prefer `user.html_url` for `author.htmlUrl`.
- Preserve `created_at` and `updated_at` as strings.
- Normalize missing dates to empty strings.
- Read `target.issue.number` when present and convert it with `Number(...)`.
- Drop raw `target` and other DTO fields after mapping.
- Sort mapped comments by `createdAt` ascending in the store or renderer.

## Architecture

```text
Issue tree node command
  -> IssueOverviewPanel
     -> IssueOverviewStore
     -> IssueCommentsStore
        -> IssueCommentService
        -> GitCodeClient
        -> issueCommentMapper
  -> Issue overview HTML renderer
```

Dependency rules:

- `view` may depend on `common`, `authentication`, and `gitcode/services`.
- `view` must not depend on raw GitCode comment DTOs.
- `gitcode` must not depend on `view`.
- Issue detail and issue comments should have separate stores. Their payloads
  have different failure modes and should render independently.
- Pull request comment types and stores should not be reused for issue comments.
  The PR model includes diff-specific fields that do not apply here.

## Proposed Files

Create:

```text
src/gitcode/mappers/issueCommentMapper.ts
src/gitcode/services/issueCommentService.ts
src/view/issueOverview/issueCommentsStore.ts
```

Update existing files:

```text
src/common/models.ts
src/view/issueOverview/issueOverviewPanel.ts
src/view/issueOverview/issueOverviewHtml.ts
src/view/viewController.ts
```

## Store Design

`IssueCommentsStore` owns comment caching:

```ts
export class IssueCommentsStore {
  private readonly commentPromises = new Map<string, Promise<IssueCommentsSnapshot>>();

  async getComments(
    repository: GitCodeRepository,
    issueNumber: number,
  ): Promise<IssueCommentsSnapshot>;

  async refresh(repository: GitCodeRepository, issueNumber: number): Promise<void>;
  clear(): void;
}
```

Rules:

- Check `AuthService.getSession()` before calling the service.
- Use cache key `${repository.fullName}#${issueNumber}`.
- Share concurrent requests for the same issue.
- Remove a failed request from the cache so retry works.
- Fire a lightweight change event after refresh for future consumers.
- `clear()` removes all cached comments on authentication changes.

## Panel Design

`IssueOverviewPanel` already loads issue detail through `IssueOverviewStore`.
Extend it to also accept `IssueCommentsStore`.

Recommended behavior:

1. Show the loading page while issue detail loads.
2. Fetch comments after the issue detail request starts. The two requests may run
   concurrently because comments only need repository and issue number.
3. If issue detail fails, show the existing issue error page.
4. If comments fail, render the issue page with an inline Conversation error.
5. On refresh, invalidate both the issue detail cache and the issue comments
   cache, then reload the panel.

The panel should keep one active issue context:

```ts
interface IssueOverviewRenderState {
  detail: IssueDetail;
  comments?: IssueCommentsSnapshot;
  commentsError?: Error;
}
```

Avoid making comments required for rendering `IssueDetail`; a comment outage
must not block the issue body and sidebar.

## HTML Rendering

Change the renderer signature from:

```ts
getIssueOverviewHtml(detail, nonce)
```

to:

```ts
getIssueOverviewHtml({
  detail,
  comments,
  commentsError,
  nonce,
});
```

Add a `Conversation` section in the main column after `Description`.

Suggested renderer helpers:

```ts
function renderConversation(
  comments: readonly IssueComment[] | undefined,
  commentsError: Error | undefined,
): string;

function renderIssueComment(comment: IssueComment): string;
```

Security requirements:

- Use `renderMarkdown(comment.body)` for comment bodies.
- Use `escapeHtml` for author names, logins, dates, URLs, and badges.
- Keep the existing content security policy with per-render nonce.
- Do not enable arbitrary script execution for rendered markdown.
- Only route user links through the existing trusted `openUrl` command.

## Error and Empty States

Use independent page states:

- issue loading: `Loading issue` / `Fetching issue details from GitCode.`
- issue failure: keep the existing `Unable to load issue` page
- comments loading during full page load: no separate page is needed
- comments failure: `Unable to load comments`
- empty comments: `No comments yet`
- empty comment body: `No comment body provided.`

The tree should remain usable when comments fail to load.

## Testing

Add focused unit tests:

- `issueCommentMapper.test.ts`
  - maps the sample response from [api.md](api.md)
  - converts numeric IDs to strings
  - maps author login, name, and HTML URL
  - tolerates missing `user`
  - maps `target.issue.number`
- `issueCommentsStore.test.ts`
  - requires authentication
  - shares concurrent requests
  - clears failed promises
  - invalidates one issue on refresh
  - clears all comments on `clear()`
- `issueOverviewHtml.test.ts`
  - renders a Conversation section
  - renders comment markdown through the sanitized markdown renderer
  - escapes author and date text
  - renders empty and error states
- `issueOverviewPanel.test.ts`
  - renders issue detail when comments fail
  - refreshes both issue detail and comments

Manual verification:

1. Open the Issues tree.
2. Select an issue with comments.
3. Confirm the issue overview shows `Conversation`.
4. Confirm all comments from the GitCode API response are displayed.
5. Refresh the issue page and confirm comments reload.
6. Test an issue with no comments.
7. Simulate a comment API failure and confirm the issue body still renders.

## Future Extensions

This design leaves room for:

- create comment
- edit and delete own comments
- reactions
- attachments
- richer issue timeline events if GitCode exposes them
- incremental refresh when an open issue panel becomes active
