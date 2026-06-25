# Issue Related Pull Requests Design

## Goal

Display pull requests linked to a GitCode issue in the existing issue overview
page.

The feature must:

- call the GitCode issue related pull requests API documented in [api.md](api.md)
- reuse the issue overview panel created by
  [../get-issue/design.md](../get-issue/design.md)
- render linked pull requests as a read-only section in the issue page
- keep GitCode API access inside `gitcode/services/*`
- map raw GitCode pull request DTOs into domain models before rendering
- keep pull request links and actions consistent with the existing pull request
  overview flow

The GitHub reference is `vscode-pull-request-github/src/view`. GitCode should
adopt the useful separation:

- tree nodes and overview panels are thin view projections
- model and store classes own API state, caching, and refresh behavior
- pull request rows use compact metadata in lists and richer detail in overview
  panels
- webviews send commands back to the extension host instead of calling APIs

GitCode should not adopt GitHub-specific checkout, review-mode, viewed-file,
GraphQL timeline, notification, or comment-controller behavior for this feature.

## Scope

### In Scope

- Fetch pull requests related to one issue on demand.
- Display linked pull requests in the issue overview page.
- Show PR number, title, state, author, source branch, target branch, updated
  time, labels, and mergeability hints when available.
- Open a linked pull request in the existing GitCode pull request overview page.
- Open a linked pull request on GitCode.
- Refresh issue detail, issue comments, and related pull requests from the
  existing issue refresh action.
- Share concurrent requests for the same issue related pull request list.
- Clear related pull request caches when authentication or workspace repository
  context changes.
- Render empty and partial-failure states without hiding the issue body.

### Out of Scope

- Creating or linking a pull request from the issue page.
- Editing pull request metadata from the issue page.
- Checking out pull request branches.
- Displaying changed files, commits, or review comments inline in the issue page.
- Pull request review actions.
- Polling, push updates, or background refresh.
- Cross-panel synchronization beyond manual refresh.

## User Experience

The entry point remains the issue tree:

```text
Issues
  owner/repo (origin)
    All Open
      #304 qwen2.5-vl w4a8 quantization error
```

Opening the issue shows the existing issue overview. Add `Related Pull Requests`
between `Description` and `Conversation`:

```text
Issue: #304 qwen2.5-vl w4a8 quantization error

Header
  Open | TODO | Bug-Report | title | number
  author | created time | updated time
  Open on GitCode | Refresh

Main Content
  Description
    rendered markdown issue body

  Related Pull Requests (2)
    #613 [Bugfix] Fix the error in qwen2.5-vl w4a8 v0
      Closed | caishengcheng | qwen2_5vl_v0 -> master | updated Jun 25
      ascend-cla/no  ci-pipeline-failed  docs-ci-pipeline-success

    #615 [Bugfix] Fix the error in qwen2.5-vl w4a8 v0
      Open | caishengcheng | qwen25vl_v0 -> master | updated Jun 25
      ascend-cla/yes  ci-pipeline-passed  docs-ci-pipeline-success

  Conversation (3)
    issue comments

Sidebar
  existing issue metadata
```

Rules:

- Show `Related Pull Requests (<count>)` after the API request succeeds.
- Hide the section while the request is still pending during the first detail
  render, matching the current comment-loading pattern.
- Show `No related pull requests` when the endpoint returns an empty array.
- Show `Unable to load related pull requests` inside the section when only this
  request fails.
- Selecting a PR title opens the existing pull request overview webview.
- The external-link action opens the PR URL on GitCode.
- Labels should render as compact chips using API colors.
- Long PR bodies should not render in this issue section. The PR overview page
  remains the detail surface.
- Keep the first version read-only.

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/:repo/issues/:number/pull_requests
```

The service call should be:

```ts
issueService.listIssueRelatedPullRequests(repository, issueNumber);
```

`GitCodeClient` remains responsible for authentication, base URL handling, and
request errors. The view layer must not append `access_token` or construct raw
API URLs.

The response is an array of pull request-like objects. Minimum fields needed by
the issue page:

- `id`
- `number`
- `state`
- `title`
- `html_url`
- `updated_at`
- `head.ref`
- `head.repo.full_name`
- `head.assigner`
- `base.ref`
- `base.repo.full_name`
- `labels`
- `can_merge_check`

## Domain Model

Add an issue-scoped related pull request model in `src/common/models.ts`. Do not
reuse `PullRequestDetail` because the endpoint returns enough data for a compact
linked-list row, not the full PR overview contract.

```ts
export interface IssueRelatedPullRequestBranch {
  ref: string;
  sha?: string;
  repositoryFullName?: string;
}

export interface IssueRelatedPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  url?: string;
  author: PullRequestParticipant;
  source: IssueRelatedPullRequestBranch;
  target: IssueRelatedPullRequestBranch;
  labels: PullRequestLabel[];
  updatedAt: string;
  closedAt?: string;
  canMergeCheck?: boolean;
}

export interface IssueRelatedPullRequestsSnapshot {
  repositoryKey: string;
  issueNumber: number;
  pullRequests: readonly IssueRelatedPullRequest[];
  loadedAt: number;
}
```

Reuse `PullRequestParticipant` and `PullRequestLabel` so the mapper and renderer
follow existing PR naming and label behavior.

### Mapping Rules

- Convert `id` and `number` with `Number(...)`.
- Resolve `state` as:
  1. `merged_at` exists -> `merged`
  2. `state === "closed"` -> `closed`
  3. otherwise -> `open`
- Resolve `url` from `html_url`, then `web_url`, then `url`.
- Resolve author from `head.assigner`, then `user`, then `author`, then
  `unknown`.
- Resolve branch refs from `head.ref` and `base.ref`.
- Resolve repository names from `head.repo.full_name` and `base.repo.full_name`.
- Preserve `updated_at` and normalize missing dates to an empty string.
- Normalize labels with the same behavior as pull request detail labels.
- Preserve `can_merge_check` only when it is a boolean.
- Ignore large fields such as `body` in this list model.

## Architecture

Use this flow:

```text
IssueOverviewPanel
  -> IssueRelatedPullRequestsStore
  -> IssueService
  -> GitCodeClient
  -> issueRelatedPullRequestMapper
  -> issue overview HTML renderer
  -> gitcode.openPullRequest command
```

Dependency rules:

- `view` consumes `IssueRelatedPullRequest`, never raw GitCode responses.
- `gitcode/services` owns endpoint construction.
- `gitcode/mappers` owns response normalization.
- the store owns caching, authentication checks, and invalidation.
- the panel owns refresh and webview message routing.
- the HTML renderer owns escaped markup projection only.

## Proposed Files

Create:

```text
src/gitcode/mappers/issueRelatedPullRequestMapper.ts
src/view/issueOverview/issueRelatedPullRequestsStore.ts
```

Update:

```text
src/common/models.ts
src/gitcode/services/issueService.ts
src/view/issueOverview/issueOverviewPanel.ts
src/view/issueOverview/issueOverviewHtml.ts
src/view/viewController.ts
```

## Service Design

Extend `IssueService`:

```ts
async listIssueRelatedPullRequests(
  repository: GitCodeRepository,
  issueNumber: number,
): Promise<IssueRelatedPullRequest[]>;
```

Endpoint construction:

```text
/api/v5/repos/:owner/:repo/issues/:number/pull_requests
```

The method should call `mapIssueRelatedPullRequests(response)`. It should not
special-case empty responses; an empty API array maps to an empty domain array.

## Store Design

`IssueRelatedPullRequestsStore` owns related PR caching:

```ts
export class IssueRelatedPullRequestsStore {
  private readonly pullRequestPromises =
    new Map<string, Promise<IssueRelatedPullRequestsSnapshot>>();

  async getPullRequests(
    repository: GitCodeRepository,
    issueNumber: number,
  ): Promise<IssueRelatedPullRequestsSnapshot>;

  async refresh(repository: GitCodeRepository, issueNumber: number): Promise<void>;
  clear(): void;
}
```

Rules:

- Check `AuthService.getSession()` before calling the service.
- Use cache key `${repository.fullName}#${issueNumber}:relatedPullRequests`.
- Share concurrent requests for the same issue.
- Cache successful arrays, including an empty array.
- Remove a failed request from the cache so retry works.
- Fire a lightweight change event after refresh for future consumers.
- `clear()` removes all cached related PR lists on authentication changes.

## Panel Design

Extend `IssueOverviewPanel` to accept `IssueRelatedPullRequestsStore` in addition
to `IssueOverviewStore` and `IssueCommentsStore`.

Recommended behavior:

1. Show the loading page while issue detail loads.
2. Render issue detail as soon as it succeeds.
3. Fetch related pull requests and comments independently after detail succeeds.
4. If issue detail fails, show the existing issue error page.
5. If related PRs fail, render the issue page with an inline related-PR error.
6. If comments fail, render the issue page with an inline Conversation error.
7. On refresh, invalidate issue detail, comments, and related PRs, then reload
   the panel.

The panel should keep one render state:

```ts
interface IssueOverviewRenderState {
  detail: IssueDetail;
  comments?: IssueCommentsSnapshot;
  commentsError?: Error;
  relatedPullRequests?: IssueRelatedPullRequestsSnapshot;
  relatedPullRequestsError?: Error;
}
```

Avoid making related pull requests required for rendering `IssueDetail`; a
related-PR outage must not block the issue body, sidebar, or comments.

## HTML Rendering

Extend the renderer options:

```ts
getIssueOverviewHtml({
  detail,
  comments,
  commentsError,
  relatedPullRequests,
  relatedPullRequestsError,
  nonce,
});
```

Add a `Related Pull Requests` section in the main column after `Description` and
before `Conversation`.

Suggested renderer helpers:

```ts
function renderRelatedPullRequests(
  pullRequests: readonly IssueRelatedPullRequest[] | undefined,
  error: Error | undefined,
): string;

function renderRelatedPullRequest(pr: IssueRelatedPullRequest): string;
```

Webview commands:

```text
openRelatedPullRequest
openUrl
```

`openRelatedPullRequest` should post the PR number. The extension host should
open the existing pull request overview panel with the current issue repository
and selected PR number.

Security requirements:

- Use `escapeHtml` for all PR titles, labels, branches, authors, dates, and URLs.
- Do not render `body` from the related PR endpoint.
- Keep the existing content security policy with a per-render nonce.
- Route external links through the existing trusted `openUrl` command.
- Only open URLs that share the same origin as `repository.webUrl`.

## Error and Empty States

Use independent page states:

- issue loading: `Loading issue` / `Fetching issue details from GitCode.`
- issue failure: keep the existing `Unable to load issue` page
- related pull requests pending: omit the section during first render
- related pull requests failure: `Unable to load related pull requests`
- empty related pull requests: `No related pull requests`
- comments failure: keep the existing `Unable to load comments`
- empty comments: keep the existing `No comments yet`

The issue page should remain usable when related pull requests fail to load.

## Commands and Navigation

The related PR section should reuse the existing PR overview behavior instead of
opening browser pages by default.

Recommended command flow:

```text
webview openRelatedPullRequest
  -> IssueOverviewPanel
  -> PullRequestOverviewPanel.createOrShow({
       repository,
       pullRequestNumber,
       url,
     })
```

If direct access to `PullRequestOverviewPanel` would create an awkward dependency,
route through an existing extension command that opens a pull request by
repository and number. The important behavior is that linked PRs open inside VS
Code first, with a separate external-link action for GitCode web.

## Testing

Add focused unit tests:

- `issueRelatedPullRequestMapper.test.ts`
  - maps the sample response from [api.md](api.md)
  - maps `head` and `base` branch refs
  - maps author from `head.assigner`
  - maps labels and `can_merge_check`
  - resolves `open`, `closed`, and `merged` states
  - tolerates missing optional fields
- `issueRelatedPullRequestsStore.test.ts`
  - requires authentication
  - shares concurrent requests
  - caches empty successful responses
  - clears failed promises
  - invalidates one issue on refresh
  - clears all related PR lists on `clear()`
- `issueOverviewHtml.test.ts`
  - renders the Related Pull Requests section
  - escapes PR title, branch, author, and label text
  - renders labels with colors
  - renders empty and error states
  - emits the `openRelatedPullRequest` command metadata
- `issueOverviewPanel.test.ts`
  - renders issue detail when related PR loading fails
  - refreshes issue detail, comments, and related PRs
  - opens a related PR through the existing PR overview flow
  - rejects untrusted external PR URLs

Manual verification:

1. Open the Issues tree.
2. Select an issue with linked pull requests.
3. Confirm the issue overview shows `Related Pull Requests`.
4. Confirm all PRs from the GitCode API response are displayed.
5. Select a PR title and confirm it opens the PR overview in VS Code.
6. Use the external-link action and confirm it opens the PR on GitCode.
7. Refresh the issue page and confirm related PRs reload.
8. Test an issue with no linked PRs.
9. Simulate a related-PR API failure and confirm the issue body and comments
   still render.

## Future Extensions

This design leaves room for:

- linking and unlinking pull requests from an issue
- showing PR file counts or merge checks when dedicated APIs are available
- grouping related PRs by state
- showing merged/closed timestamps
- rendering a richer issue timeline that includes linked PR events
