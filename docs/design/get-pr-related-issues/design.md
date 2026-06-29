# Pull Request Related Issues Design

## Goal

Display issues linked to a GitCode pull request in the existing pull request
overview page.

The feature must:

- call the GitCode pull request related issues API documented in [api.md](api.md)
- reuse the pull request overview panel created by
  [../get-request/design.md](../get-request/design.md)
- render linked issues as a read-only section in the pull request page
- keep GitCode API access inside `gitcode/services/*`
- map raw GitCode issue DTOs into domain models before rendering
- keep issue links and actions consistent with the existing issue overview flow

GitCode should follow the same separation used by the issue and pull request
overview features:

- overview panels are thin view projections
- model and store classes own API state, caching, and refresh behavior
- compact linked rows use list-specific models instead of full detail models
- webviews send commands back to the extension host instead of calling APIs

This feature should not add issue editing, PR editing, checkout, merge, review,
timeline, polling, or notification behavior.

## Scope

### In Scope

- Fetch issues related to one pull request on demand.
- Display linked issues in the pull request overview page.
- Show issue number, title, state, author, labels, workflow state, type,
  priority, updated time, and repository when available.
- Open a linked issue in the existing GitCode issue overview page.
- Open a linked issue on GitCode.
- Refresh pull request detail, pull request comments, and related issues from
  the existing pull request refresh action.
- Share concurrent requests for the same pull request related issue list.
- Clear related issue caches when authentication or workspace repository context
  changes.
- Render empty and partial-failure states without hiding the pull request body
  or comments.

### Out of Scope

- Creating, linking, or unlinking issues from the pull request page.
- Editing issue title, labels, assignees, priority, state, or milestone.
- Rendering issue bodies inline in the pull request page.
- Displaying issue comments or timelines inline in the pull request page.
- Cross-repository navigation beyond opening the linked issue URL on GitCode.
- Polling, push updates, or background refresh.
- Cross-panel synchronization beyond manual refresh.

## User Experience

The entry point remains the pull request tree:

```text
Pull Requests
  owner/repo (origin)
    All Open
      #660 [Doc] Update quantization format docs
```

Opening the pull request shows the existing pull request overview. Add
`Related Issues` after `Description` and before `Conversation`:

```text
Pull Request: #660 [Doc] Update quantization format docs

Header
  Open | title | number
  author | source branch -> target branch | updated time
  Open on GitCode | Refresh

Main Content
  Status Summary

  Description
    rendered markdown pull request body

  Related Issues (1)
    #339 [Doc]: quantization format docs need corrections
      Open | mominhua | Bug-Report | TODO | updated Jun 29
      document  medium-priority  triaged

  Conversation (4)
    pull request comments

Sidebar
  existing pull request metadata
```

Rules:

- Show `Related Issues (<count>)` after the API request succeeds.
- Hide the section while the request is still pending during the first detail
  render, matching the current comment-loading pattern.
- Show `No related issues` when the endpoint returns an empty array.
- Show `Unable to load related issues` inside the section when only this request
  fails.
- Selecting an issue title opens the existing issue overview webview.
- The external-link action opens the issue URL on GitCode.
- Labels should render as compact chips using API colors.
- Long issue bodies should not render in this pull request section. The issue
  overview page remains the detail surface.
- Keep the first version read-only.

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/:repo/pulls/:number/issues
```

The service call should be:

```ts
pullRequestService.listPullRequestRelatedIssues(repository, pullRequestNumber);
```

`GitCodeClient` remains responsible for authentication, base URL handling, and
request errors. The view layer must not append `access_token` or construct raw
API URLs.

The response is an array of issue-like objects. Minimum fields needed by the
pull request page:

- `id`
- `number`
- `title`
- `state`
- `html_url`
- `user`
- `labels`
- `repository.full_name`
- `issue_created_at`
- `issue_updated_at`
- `issue_state`
- `issue_state_detail`
- `issue_type`
- `issue_type_detail`
- `priority`
- `issue_priority_detail`

## Domain Model

Add a pull-request-scoped related issue model in `src/common/models.ts`. Do not
reuse `IssueDetail` because this endpoint returns enough data for a compact
linked-list row, not the full issue overview contract.

```ts
export interface PullRequestRelatedIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  url?: string;
  author: IssueUser;
  labels: IssueLabel[];
  repository?: IssueRepositoryRef;
  createdAt: string;
  updatedAt: string;
  issueState?: string;
  issueStateDetail?: IssueWorkflowState;
  issueType?: string;
  issueTypeDetail?: IssueTypeDetail;
  priority?: number;
  priorityDetail?: IssuePriorityDetail;
}

export interface PullRequestRelatedIssuesSnapshot {
  repositoryKey: string;
  pullRequestNumber: number;
  issues: readonly PullRequestRelatedIssue[];
  loadedAt: number;
}
```

Reuse `IssueUser`, `IssueLabel`, `IssueRepositoryRef`, `IssueWorkflowState`,
`IssueTypeDetail`, and `IssuePriorityDetail` so issue rendering and related issue
rendering normalize data the same way.

### Mapping Rules

- Convert `id` and `number` with `Number(...)`.
- Resolve `state` to `'closed'` only when raw `state` is exactly `closed`;
  otherwise use `'open'`.
- Resolve `url` from `html_url`, then `web_url`, then `url`.
- Resolve author from `user`, then `author`, then `unknown`.
- Normalize labels with the same behavior as issue list and issue detail labels.
- Resolve `createdAt` from `issue_created_at`, then `created_at`.
- Resolve `updatedAt` from `issue_updated_at`, then `updated_at`.
- Preserve both short workflow fields (`issue_state`, `issue_type`, `priority`)
  and their detail objects when present.
- Normalize `repository.full_name` into `IssueRepositoryRef.fullName`.
- Ignore large fields such as `body` in this list model.
- Map missing arrays to empty arrays and missing numeric values to `0`.

## Architecture

Use this flow:

```text
PullRequestOverviewPanel
  -> PullRequestRelatedIssuesStore
  -> PullRequestService
  -> GitCodeClient
  -> pullRequestRelatedIssueMapper
  -> pull request overview HTML renderer
  -> gitcode.openIssue command
```

Dependency rules:

- `view` consumes `PullRequestRelatedIssue`, never raw GitCode responses.
- `gitcode/services` owns endpoint construction.
- `gitcode/mappers` owns response normalization.
- the store owns caching, authentication checks, and invalidation.
- the panel owns refresh and webview message routing.
- the HTML renderer owns escaped markup projection only.

## Proposed Files

Create:

```text
src/gitcode/mappers/pullRequestRelatedIssueMapper.ts
src/view/overview/pullRequestRelatedIssuesStore.ts
```

Update:

```text
src/common/models.ts
src/gitcode/services/pullRequestService.ts
src/view/overview/pullRequestOverviewPanel.ts
src/view/overview/overviewHtml.ts
src/view/viewController.ts
```

## Service Design

Extend `PullRequestService`:

```ts
async listPullRequestRelatedIssues(
  repository: GitCodeRepository,
  pullRequestNumber: number,
): Promise<PullRequestRelatedIssue[]>;
```

Endpoint construction:

```text
/api/v5/repos/:owner/:repo/pulls/:number/issues
```

The method should call `mapPullRequestRelatedIssues(response)`. It should not
special-case empty responses; an empty API array maps to an empty domain array.
If the API returns a non-array payload, fail through the normal client or mapper
error path rather than silently hiding the server contract problem.

## Store Design

`PullRequestRelatedIssuesStore` owns related issue caching:

```ts
export class PullRequestRelatedIssuesStore {
  private readonly issuePromises =
    new Map<string, Promise<PullRequestRelatedIssuesSnapshot>>();

  async getIssues(
    repository: GitCodeRepository,
    pullRequestNumber: number,
  ): Promise<PullRequestRelatedIssuesSnapshot>;

  async refresh(
    repository: GitCodeRepository,
    pullRequestNumber: number,
  ): Promise<void>;

  clear(): void;
}
```

Rules:

- Check `AuthService.getSession()` before calling the service.
- Use cache key `${repository.fullName}#${pullRequestNumber}:relatedIssues`.
- Share concurrent requests for the same pull request.
- Cache successful arrays, including an empty array.
- Remove a failed request from the cache so retry works.
- Fire a lightweight change event after refresh for future consumers.
- `clear()` removes all cached related issue lists on authentication changes.

## Panel Design

Extend `PullRequestOverviewPanel` to accept `PullRequestRelatedIssuesStore` in
addition to `PullRequestOverviewStore` and `PullRequestCommentsStore`.

Recommended behavior:

1. Show the loading page while pull request detail loads.
2. Render pull request detail as soon as it succeeds.
3. Fetch related issues and comments independently after detail succeeds.
4. If pull request detail fails, show the existing pull request error page.
5. If related issues fail, render the pull request page with an inline
   related-issue error.
6. If comments fail, render the pull request page with an inline Conversation
   error.
7. On refresh, invalidate pull request detail, comments, and related issues,
   then reload the panel.

The panel should keep one render state:

```ts
interface PullRequestOverviewRenderState {
  detail: PullRequestDetail;
  comments?: PullRequestCommentsSnapshot;
  commentsError?: Error;
  relatedIssues?: PullRequestRelatedIssuesSnapshot;
  relatedIssuesError?: Error;
}
```

Avoid making related issues required for rendering `PullRequestDetail`; a
related-issue outage must not block the pull request body, sidebar, or comments.

## HTML Rendering

Extend the renderer options. If the current `getOverviewHtml` positional
arguments become difficult to read, replace them with an options object:

```ts
getOverviewHtml({
  detail,
  comments,
  commentsError,
  relatedIssues,
  relatedIssuesError,
  nonce,
});
```

Add a `Related Issues` section in the main column after `Description` and before
`Conversation`.

Suggested renderer helpers:

```ts
function renderRelatedIssues(
  issues: readonly PullRequestRelatedIssue[] | undefined,
  error: Error | undefined,
): string;

function renderRelatedIssue(issue: PullRequestRelatedIssue): string;
```

Webview commands:

```text
openRelatedIssue
openUrl
```

`openRelatedIssue` should post the issue number and, when available, the target
repository full name. The extension host should open the existing issue overview
panel with the current pull request repository unless the API clearly points to
a different repository.

Security requirements:

- Use `escapeHtml` for all issue titles, labels, repositories, authors, dates,
  and URLs.
- Do not render `body` from the related issue endpoint.
- Keep the existing content security policy with a per-render nonce.
- Route external links through the existing trusted `openUrl` command.
- Only open URLs that share the same origin as `repository.webUrl`.

## Commands and Navigation

The related issue section should reuse the existing issue overview behavior
instead of opening browser pages by default.

Recommended command flow:

```text
webview openRelatedIssue
  -> PullRequestOverviewPanel
  -> IssueOverviewPanel.createOrShow({
       repository,
       issueNumber,
       url,
     })
```

If direct access to `IssueOverviewPanel` would create an awkward dependency,
route through an existing extension command that opens an issue by repository
and number. The important behavior is that linked issues open inside VS Code
first, with a separate external-link action for GitCode web.

For cross-repository issue results:

- if `repository.full_name` matches the active pull request repository, open the
  issue overview normally
- if it differs and the repository cannot be resolved locally, keep the issue
  title clickable only when a repository context can be built safely; otherwise
  use the external-link action
- never synthesize API requests for an unrelated repository without a trusted
  owner/name pair from the API response

## Error and Empty States

Use independent page states:

- pull request loading: `Loading pull request` /
  `Fetching pull request details from GitCode.`
- pull request failure: keep the existing `Unable to load pull request` page
- related issues pending: omit the section during first render
- related issues failure: `Unable to load related issues`
- empty related issues: `No related issues`
- comments failure: keep the existing `Unable to load comments`
- empty comments: keep the existing `No comments yet`

The pull request page should remain usable when related issues fail to load.

## Testing

Add focused unit tests:

- `pullRequestRelatedIssueMapper.test.ts`
  - maps the sample response from [api.md](api.md)
  - normalizes string issue numbers to numbers
  - maps author from `user`
  - maps labels, repository, workflow state, type, and priority detail
  - resolves `open` and `closed` states
  - tolerates missing optional fields
- `pullRequestRelatedIssuesStore.test.ts`
  - requires authentication
  - shares concurrent requests
  - caches empty successful responses
  - clears failed promises
  - invalidates one pull request on refresh
  - clears all related issue lists on `clear()`
- `overviewHtml.test.ts`
  - renders the Related Issues section
  - escapes issue title, repository, author, and label text
  - renders labels with colors
  - renders empty and error states
  - emits the `openRelatedIssue` command metadata
- `pullRequestOverviewPanel.test.ts`
  - renders pull request detail when related issue loading fails
  - refreshes pull request detail, comments, and related issues
  - opens a related issue through the existing issue overview flow
  - rejects untrusted external issue URLs

Manual verification:

1. Open the Pull Requests tree.
2. Select a pull request with linked issues.
3. Confirm the pull request overview shows `Related Issues`.
4. Confirm all issues from the GitCode API response are displayed.
5. Select an issue title and confirm it opens the issue overview in VS Code.
6. Use the external-link action and confirm it opens the issue on GitCode.
7. Refresh the pull request page and confirm related issues reload.
8. Test a pull request with no linked issues.
9. Simulate a related-issue API failure and confirm the pull request body and
   comments still render.

## Future Extensions

This design leaves room for:

- linking and unlinking issues from a pull request
- showing issue comment counts or milestone data when needed
- grouping related issues by state or workflow state
- rendering a richer pull request timeline that includes linked issue events
- cross-repository issue overview support when repository resolution is explicit
