# List Pull Request Operation Logs Design

## Goal

Display GitCode pull request operation logs in the existing pull request overview
page.

The feature must:

- call the operation logs API documented in [api.md](api.md)
- render a read-only activity timeline in the pull request overview
- keep operation logs separate from pull request comments
- map raw API DTOs into view-independent domain models before rendering
- fetch, cache, refresh, and fail independently from pull request detail,
  comments, and related issues
- reuse the existing sanitized overview rendering patterns for user-provided
  text

Operation logs are timeline events such as closing, reopening, label changes,
title changes, and discussion resolution. They are not comments and should not
be merged into `PullRequestCommentsStore`.

## Scope

### In Scope

- Fetch operation logs for one pull request on demand.
- Display operation logs in the pull request overview page.
- Render actor, action content, action type, and timestamp.
- Display logs from oldest to newest so the activity timeline reads
  top-to-bottom like the Conversation section.
- Show an empty state when no logs are returned.
- Show an inline error when only operation logs fail to load.
- Refresh operation logs from the existing pull request refresh action.
- Share concurrent requests for the same pull request logs.
- Clear cached operation logs when the overview store is refreshed.

### Out of Scope

- Creating or editing operation logs.
- Filtering by operation type.
- Infinite scrolling or a load-more control.
- Polling, push updates, or background refresh.
- Native VS Code Comments API integration.
- Treating operation logs as review discussions or PR comments.

## User Experience

The pull request overview should keep the existing primary flow:

```text
Pull Request #2

Header
Description
Conversation
Activity
Related Issues
Sidebar
```

Add an `Activity` section after `Conversation` and before `Related Issues`:

```text
Activity (10)

  @tangxuanya                         Jun 30, 11:17
  add label bug                       label

  @tangxuanya                         Jun 30, 18:53
  reopen from codehub                 opened

  @tangxuanya                         Jul 1, 00:10
  resolved all discussions            discussion
```

Rules:

- Show `Activity (<count>)` after logs load.
- Show `Loading activity...` while only logs are loading.
- Show `No activity yet.` for an empty response.
- Show `Unable to load activity` inside the section when the logs request fails.
- Sort logs by `createdAt` ascending for display, even if the API returns the
  newest entries first.
- The pull request header, description, comments, and related issues must still
  render when activity loading fails.
- Render actor display as `name @login` when both values exist and differ;
  otherwise render `@login`.
- Prefer actor profile links only through the existing trusted `openUrl` command
  and only when the URL origin matches the repository web URL.
- Escape all actor, action, action type, date, and project text.
- Do not render operation log `content` as markdown in the first version. The
  sample contains lightweight formatting for title changes, but treating it as
  plain text avoids accidentally interpreting API-provided content as trusted
  markup.

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/:repo/pulls/:number/operate_logs
```

The service surface should be:

```ts
pullRequestService.listPullRequestOperationLogs(repository, pullRequestNumber, {
  page: 1,
  perPage: 100,
});
```

`GitCodeClient` remains responsible for authentication, base URL handling, and
request errors. The view layer must not append `access_token` or construct raw
API URLs.

Fields consumed from each response item:

- `id`
- `content`
- `action`
- `action_type`
- `merge_request_id`
- `discussion_id`
- `project`
- `created_at`
- `updated_at`
- `user.id`
- `user.login`
- `user.name`
- `user.nick_name`
- `user.web_url`
- `user.state`

The first implementation should request one page with `per_page: 100`. If the
API later exposes total count headers through the client, pagination can be
added without changing the domain model.

## Domain Model

Add operation log types to `src/common/models.ts`:

```ts
export interface PullRequestOperationLogActor {
  id?: string;
  login: string;
  name?: string;
  nickName?: string;
  htmlUrl?: string;
  state?: string;
}

export interface PullRequestOperationLog {
  id: string;
  content: string;
  action: string;
  actionType: string;
  pullRequestId?: string;
  discussionId?: string;
  project?: string;
  actor: PullRequestOperationLogActor;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestOperationLogsSnapshot {
  repositoryKey: string;
  pullRequestNumber: number;
  logs: readonly PullRequestOperationLog[];
  loadedAt: number;
}
```

### Mapping Rules

- Convert `id` and `merge_request_id` to strings.
- Map `content` to an empty string when omitted.
- Map `action` and `action_type` independently because the API supplies both.
- Prefer `action_type` for badges; fall back to `action`, then `activity`.
- Preserve `discussion_id` when present so discussion-related events can be
  linked later.
- Map `user` to `actor`; tolerate missing `user` by using `unknown`.
- Prefer `user.login`; fall back to `user.nick_name`, `user.name`, then
  `unknown`.
- Prefer `user.name`; fall back to `user.nick_name` when displaying a full name.
- Prefer `user.web_url` for `actor.htmlUrl`.
- Preserve `created_at` and `updated_at` as strings.
- Normalize missing dates to empty strings.
- Drop raw DTO fields after mapping.
- Sort mapped logs by `createdAt` ascending for display. If dates are equal or
  invalid, sort by numeric `id` ascending when possible.

## Architecture

Use this flow:

```text
PullRequestOverviewPanel
  -> PullRequestOperationLogsStore
  -> PullRequestService
  -> GitCodeClient
  -> pullRequestOperationLogMapper
  -> overviewHtml Activity renderer
```

Dependency rules:

- `view` consumes `PullRequestOperationLog`, never raw GitCode responses.
- `gitcode/services` owns endpoint construction and query parameters.
- `gitcode/mappers` owns DTO normalization.
- the store owns caching, invalidation, and change events.
- `overviewHtml` receives a snapshot or error state and only renders HTML.
- operation logs should not be stored in `PullRequestCommentsStore`; comments
  support editing, replies, resolved state, and inline editor projection, which
  operation logs do not need.

## Proposed Files

Create:

```text
src/gitcode/mappers/pullRequestOperationLogMapper.ts
src/view/overview/pullRequestOperationLogsStore.ts
```

Update:

```text
src/common/models.ts
src/gitcode/services/pullRequestService.ts
src/view/overview/pullRequestOverviewPanel.ts
src/view/overview/overviewHtml.ts
src/view/viewController.ts
```

Tests:

```text
src/test/pullRequestOperationLogMapper.test.ts
src/test/pullRequestOperationLogsStore.test.ts
src/test/pullRequestOverviewPanel.test.ts
src/test/overviewHtml.test.ts
```

## Store Design

`PullRequestOperationLogsStore` owns operation log caching:

```ts
export interface PullRequestOperationLogsChangeEvent {
  repositoryKey: string;
  pullRequestNumber: number;
}

export class PullRequestOperationLogsStore implements vscode.Disposable {
  readonly onDidChange: vscode.Event<PullRequestOperationLogsChangeEvent | undefined>;

  async getOrFetch(
    repository: GitCodeRepository,
    pullRequestNumber: number,
  ): Promise<PullRequestOperationLogsSnapshot>;

  async refresh(repositoryKey: string, pullRequestNumber: number): Promise<void>;
  clear(): void;
  dispose(): void;
}
```

Rules:

- Check `AuthService.getSession()` before calling the service.
- Use cache key `${repository.fullName}#${pullRequestNumber}`.
- Share concurrent requests for the same pull request logs.
- Remove a failed request from the cache so retry works.
- `refresh()` deletes only the targeted snapshot and fires a targeted change
  event.
- `clear()` deletes all cached logs and fires a broad change event.

## Panel Design

Extend `PullRequestOverviewPanel.createOrShow` to accept
`PullRequestOperationLogsStore`.

Recommended loading behavior:

1. Show the existing loading page while pull request detail loads.
2. Once detail is available, render the overview with comments, activity, and
   related issues in their loading states.
3. Fetch comments, operation logs, related issues, and edit options concurrently.
4. If comments fail, show the existing Conversation error state.
5. If operation logs fail, show only the Activity error state.
6. If related issues fail, show only the Related Issues error state.
7. If pull request detail fails, keep the existing full-page error behavior.

Refresh behavior:

- The existing overview refresh action should invalidate detail, comments,
  operation logs, and related issues.
- Creating, editing, or resolving a PR comment should refresh comments and
  operation logs because those operations may add activity entries.
- Editing pull request title, state, labels, assignees, reviewers, or milestone
  should refresh detail and operation logs.

## HTML Rendering

Add activity render helpers to `overviewHtml.ts`:

```ts
function renderActivitySection(snapshot: PullRequestOperationLogsSnapshot): string;
function renderActivityLoading(): string;
function renderActivityError(message: string): string;
```

`getOverviewHtml` should accept an `activityHtml` parameter beside the existing
conversation and related issue HTML fragments.

Render each log as a compact timeline row:

- avatar or initials
- actor display
- formatted `createdAt`
- escaped `content`
- small action-type badge

Use existing date formatting and avatar helper patterns where possible. Keep CSS
scoped under the overview page's Activity classes, for example:

```text
.activity-list
.activity-item
.activity-meta
.activity-content
.activity-badge
```

## Error Handling

- Authentication errors should display the store-provided message inside the
  Activity section.
- API request errors should show their message if available.
- Malformed response items should not break the whole overview. The mapper
  should tolerate missing fields and preserve a minimal log row.
- Invalid actor URLs should render as plain text.
- If `created_at` is missing or invalid, show `Unknown time`.

## Testing

Mapper tests should cover:

- complete sample item from [api.md](api.md)
- missing `user`
- missing `action_type`
- string and numeric IDs
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

- loading state
- empty state
- escaped log content
- actor display with and without URL
- activity badge fallback from `action`
- invalid date display

Panel tests should cover:

- operation logs load concurrently with comments and related issues
- operation log failure does not hide the pull request detail
- refresh invalidates operation logs
- comment/status/edit operations invalidate operation logs when they can create
  activity entries
