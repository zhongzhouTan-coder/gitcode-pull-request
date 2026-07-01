# List Issue Operation Logs Design

## Goal

Display GitCode issue operation logs in the existing issue overview page.

The feature must:

- call the operation logs API documented in [api.md](api.md)
- reuse the issue overview panel created by
  [../get-issue/design.md](../get-issue/design.md)
- render issue comments and operation logs in one chronological timeline
- keep operation logs separate from issue comments in the data layer
- map raw API DTOs into view-independent domain models before rendering
- fetch, cache, refresh, and fail independently from issue detail and comments
- reuse the existing sanitized overview rendering patterns for user-provided
  text

Operation logs are read-only timeline events such as label changes, milestone
changes, and title changes. They are not comments and should not be stored in
`IssueCommentsStore`.

## Scope

### In Scope

- Fetch operation logs for one issue on demand.
- Display operation logs in the issue overview page.
- Render actor, action content, action type, and timestamp.
- Interleave operation logs with issue comments by `createdAt`, oldest first.
- Show compact activity rows for logs and full cards for comments.
- Show an empty timeline state when both comments and logs are empty.
- Show an inline operation-log error without hiding issue detail or comments.
- Refresh operation logs from the existing issue refresh action.
- Share concurrent requests for the same issue logs.
- Clear cached operation logs when authentication or workspace repository
  context changes.

### Out of Scope

- Creating or editing operation logs.
- Filtering by operation type.
- Infinite scrolling or a load-more control.
- Polling, push updates, or background refresh.
- Native VS Code Comments API integration.
- Treating operation logs as issue comments.
- Rendering operation log content as markdown in the first version.

## User Experience

The entry point remains the Issues tree:

```text
Issues
  owner/repo (origin)
    All Open
      #1 [issue] test issue create new
```

Opening the issue shows the existing issue overview. The main column should
present the description followed by a unified `Timeline`:

```text
Issue: #1 [issue] test issue create new

Header
  Open | TODO | title | number
  author | created time | updated time
  Open on GitCode | Refresh

Main Content
  Description
    rendered markdown issue body

  Timeline (7)
    @tangxuanya                                 Jun 30, 16:24
    add label bug                              label

    @tangxuanya                                 Jun 30, 17:55
    add label perf                             label

    @tangxuanya                                 Jun 30, 17:55
    changed milestone to new_milstone          milestone

    @tangxuanya                                 Jun 30, 17:58
    changed title from ... to ...              title

    @anreywmh                                   Jul 1, 10:12
    rendered markdown comment body

Sidebar
  existing issue metadata
```

Rules:

- Show `Timeline (<count>)` after comments and logs are loaded. The count is
  comments plus operation logs that can be rendered.
- Show issue comments as the existing full comment cards.
- Show operation logs as compact activity rows.
- If only operation logs are still loading, the timeline can render comments and
  a compact `Loading activity...` row.
- If operation logs fail, keep comments visible and show
  `Unable to load activity` inside the timeline.
- If comments fail, keep logs visible and show the existing comments error state
  inside the timeline.
- If both comments and logs are empty, show `No activity yet.`
- Sort all timeline entries by `createdAt` ascending. If dates are equal or
  invalid, keep comments before operation logs when that avoids visual churn.
- Render actor display as `name @login` when both values exist and differ;
  otherwise render `@login`.
- User profile links can use the existing trusted `openUrl` webview command
  only when the URL has the same origin as the repository `webUrl`.
- Escape all actor, action, action type, date, and issue metadata text.
- Do not render operation log `content` as markdown in the first version. The
  sample contains lightweight formatting for title changes, but treating it as
  plain text avoids interpreting API-provided content as trusted markup.

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/issues/:number/operate_logs
```

The service surface should be:

```ts
issueOperationLogService.listIssueOperationLogs(repository, issueNumber);
```

`GitCodeClient` remains responsible for authentication, base URL handling, and
request errors. The view layer must not append `access_token` or construct raw
API URLs.

The API takes the repository path as a query parameter:

```text
repo=<repository path>
```

The service should derive this from `GitCodeRepository` in the same way as other
issue APIs that require `owner` and `repo` separately.

Fields consumed from each response item:

- `id`
- `content`
- `action_type`
- `issue_id`
- `created_at`
- `update_at`
- `updated_at`
- `user.id`
- `user.login`
- `user.name`
- `user.html_url`

The API documentation does not describe pagination parameters for this endpoint.
The first implementation should request the documented endpoint once. If GitCode
later documents pagination or exposes response headers through the client, add
pagination in the service without changing the domain model.

## Domain Model

Add operation log types to `src/common/models.ts`:

```ts
export interface IssueOperationLogActor {
  id?: string;
  login: string;
  name?: string;
  htmlUrl?: string;
}

export interface IssueOperationLog {
  id: string;
  content: string;
  actionType: string;
  issueId?: string;
  actor: IssueOperationLogActor;
  createdAt: string;
  updatedAt: string;
}

export interface IssueOperationLogsSnapshot {
  repositoryKey: string;
  issueNumber: number;
  logs: readonly IssueOperationLog[];
  loadedAt: number;
}
```

### Mapping Rules

- Convert `id` and `issue_id` to strings.
- Map `content` to an empty string when omitted.
- Map `action_type` to `actionType`; fall back to `activity` when missing.
- Map `user` to `actor`; tolerate missing `user` by using `unknown`.
- Prefer `user.login`; fall back to `user.name`, then `unknown`.
- Prefer `user.name` for the full display name.
- Prefer `user.html_url` for `actor.htmlUrl`.
- Preserve `created_at` as `createdAt`.
- Map `updatedAt` from `updated_at` first, then `update_at`, because the issue
  operation logs sample uses `update_at`.
- Normalize missing dates to empty strings.
- Drop raw DTO fields after mapping.
- Sort mapped logs by `createdAt` ascending before rendering. If dates are equal
  or invalid, sort by numeric `id` ascending when possible.

## Architecture

Use this flow:

```text
Issue tree node command
  -> IssueOverviewPanel
     -> IssueOverviewStore
     -> IssueCommentsStore
     -> IssueOperationLogsStore
        -> IssueOperationLogService
        -> GitCodeClient
        -> issueOperationLogMapper
  -> Issue overview HTML renderer
```

Dependency rules:

- `view` consumes `IssueOperationLog`, never raw GitCode responses.
- `gitcode/services` owns endpoint construction and query parameters.
- `gitcode/mappers` owns DTO normalization.
- the store owns caching, invalidation, and change events.
- `issueOverviewHtml` receives snapshots or error state and only renders HTML.
- operation logs should not be stored in `IssueCommentsStore`; comments support
  markdown bodies and future create/edit/delete behavior, while logs are
  immutable activity records.
- Pull request operation log types and stores should not be reused for issues.
  The API shape differs enough to keep issue-specific mapping explicit.

## Proposed Files

Create:

```text
src/gitcode/mappers/issueOperationLogMapper.ts
src/gitcode/services/issueOperationLogService.ts
src/view/issueOverview/issueOperationLogsStore.ts
```

Update:

```text
src/common/models.ts
src/view/issueOverview/issueOverviewPanel.ts
src/view/issueOverview/issueOverviewHtml.ts
src/view/viewController.ts
```

Tests:

```text
src/test/issueOperationLogMapper.test.ts
src/test/issueOperationLogsStore.test.ts
src/test/issueOverviewHtml.test.ts
src/test/issueOverviewPanel.test.ts
```

## Store Design

`IssueOperationLogsStore` owns operation log caching:

```ts
export interface IssueOperationLogsChangeEvent {
  repositoryKey: string;
  issueNumber: number;
}

export class IssueOperationLogsStore implements vscode.Disposable {
  readonly onDidChange: vscode.Event<IssueOperationLogsChangeEvent | undefined>;

  async getOrFetch(
    repository: GitCodeRepository,
    issueNumber: number,
  ): Promise<IssueOperationLogsSnapshot>;

  async refresh(repository: GitCodeRepository, issueNumber: number): Promise<void>;
  clear(): void;
  dispose(): void;
}
```

Rules:

- Check `AuthService.getSession()` before calling the service.
- Use cache key `${repository.fullName}#${issueNumber}`.
- Share concurrent requests for the same issue logs.
- Remove a failed request from the cache so retry works.
- `refresh()` deletes only the targeted snapshot and fires a targeted change
  event.
- `clear()` deletes all cached logs and fires a broad change event.

## Panel Design

`IssueOverviewPanel` already loads issue detail through `IssueOverviewStore` and
comments through `IssueCommentsStore`. Extend it to also accept
`IssueOperationLogsStore`.

Recommended loading behavior:

1. Show the existing loading page while issue detail loads.
2. Start detail, comments, and operation-log requests concurrently because all
   three only need repository and issue number.
3. If issue detail fails, keep the existing full-page issue error behavior.
4. If comments fail, render the issue page with timeline activity and a comments
   error row.
5. If operation logs fail, render the issue page with comments and an activity
   error row.
6. On refresh, invalidate issue detail, comments, and operation logs, then
   reload the active panel.

The panel should keep operation logs optional in render state:

```ts
interface IssueOverviewRenderState {
  detail: IssueDetail;
  comments?: IssueCommentsSnapshot;
  commentsError?: Error;
  operationLogs?: IssueOperationLogsSnapshot;
  operationLogsError?: Error;
}
```

Avoid making operation logs required for rendering `IssueDetail`; an activity
outage must not block the issue body, comments, or sidebar.

## HTML Rendering

Change the renderer state to include operation logs:

```ts
getIssueOverviewHtml({
  detail,
  comments,
  commentsError,
  operationLogs,
  operationLogsError,
  nonce,
});
```

Replace the existing comment-only `Conversation` section with a unified
`Timeline` section. Comment rendering can keep its current full-card layout.
Operation logs should use compact rows.

Suggested renderer helpers:

```ts
function renderTimeline(state: IssueTimelineRenderState): string;
function renderIssueCommentTimelineItem(comment: IssueComment): string;
function renderIssueOperationLogTimelineItem(log: IssueOperationLog): string;
function mergeIssueTimelineEntries(
  comments: readonly IssueComment[] | undefined,
  logs: readonly IssueOperationLog[] | undefined,
): readonly IssueTimelineEntry[];
```

Render each operation log as:

- avatar or initials when the existing issue comment helper supports it
- actor display
- formatted `createdAt`
- escaped `content`
- small `actionType` badge

Security requirements:

- Use `renderMarkdown(comment.body)` only for issue comments.
- Use `escapeHtml` for operation log content and all non-markdown metadata.
- Keep the existing content security policy with a per-render nonce.
- Do not enable arbitrary script execution for rendered markdown.
- Only route user links through the existing trusted `openUrl` command.

## Error Handling

- Authentication errors should display the store-provided message inside the
  Timeline section when issue detail itself is available.
- API request errors should show their message if available.
- Malformed response items should not break the whole overview. The mapper
  should tolerate missing fields and preserve a minimal log row.
- Invalid actor URLs should render as plain text.
- If `created_at` is missing or invalid, show `Unknown time`.
- If both comments and operation logs fail, render both inline errors in the
  timeline instead of hiding the issue detail page.

## Testing

Mapper tests should cover:

- complete sample item from [api.md](api.md)
- missing `user`
- missing `action_type`
- string and numeric IDs
- `update_at` fallback for `updatedAt`
- ascending date sort
- invalid dates falling back to ID sort

Store tests should cover:

- authentication required before service access
- cache hit
- concurrent request sharing
- failed request removal
- targeted refresh event
- clear event

Overview HTML tests should cover:

- timeline with comments and operation logs interleaved
- loading state for operation logs while comments are visible
- empty timeline state
- escaped operation log content, including `**title**` text
- actor display with and without URL
- activity badge fallback to `activity`
- invalid date display
- operation-log error without hiding comments

Panel tests should cover:

- operation logs load concurrently with issue detail and comments
- operation log failure does not hide the issue detail
- comments failure does not hide operation logs
- refresh invalidates operation logs together with detail and comments

Manual verification:

1. Open the Issues tree.
2. Select an issue with label, milestone, or title changes.
3. Confirm the issue overview shows a `Timeline` section.
4. Confirm comments and operation logs are sorted oldest first.
5. Refresh the issue page and confirm operation logs reload.
6. Test an issue with no comments and no operation logs.
7. Simulate an operation-log API failure and confirm the issue body and comments
   still render.

## Future Extensions

This design leaves room for:

- rendering known operation-log content with richer formatting after a safe
  formatter is defined
- filtering activity by comments, labels, milestones, title changes, or state
- pagination if GitCode documents paging for issue operation logs
- richer issue timeline events if GitCode exposes them
- incremental refresh when an open issue panel becomes active
