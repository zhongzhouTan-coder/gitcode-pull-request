# Add Related Issue to Pull Request Design

## Goal

Add a GitCode flow for linking one or more existing issues to a pull request.

The feature must:

- call the GitCode add related issue API documented in [api.md](api.md)
- start from the existing pull request overview page
- let users select existing issue numbers and link them to the active pull
  request
- refresh the pull request overview related issue section after a successful
  link
- keep GitCode API access inside `gitcode/services/*`, not in the view layer
- map the API response into the existing `PullRequestRelatedIssue` domain model
- preserve the current read-only related issues display design from
  [../get-pr-related-issues/design.md](../get-pr-related-issues/design.md)

This feature adds relationship creation only. It should not change issue
content, pull request content, comments, merge state, or review state.

## Scope

### In Scope

- Add an `Add related issue` action to the `Related Issues` section in the pull
  request overview page.
- Add a command that links issues to the currently active pull request overview.
- Let users enter issue numbers directly.
- Optionally offer issue search/list choices from the existing issue list API
  when the repository issue list is available.
- Validate issue numbers before submitting.
- Submit one or more issue numbers through `PullRequestService`.
- Reuse the API response to update the related issue list when possible.
- Refresh the related issue cache after success so the overview stays
  consistent with GitCode.
- Show loading, validation, unauthenticated, permission, and API error states.
- Keep the pull request body, timeline, comments, and existing related issues
  visible while the link action is running.

### Out of Scope

- Creating a new issue from the pull request page.
- Unlinking related issues.
- Linking pull requests from the issue overview page.
- Editing issue title, body, labels, assignees, priority, workflow state, or
  milestone.
- Editing pull request title, body, labels, branches, reviewers, or state.
- Inferring issue links from pull request description text.
- Optimistic relationship creation before the API request succeeds.
- Background refresh, polling, or push-driven synchronization.
- Cross-repository issue linking unless the API later documents that behavior.

## User Experience

The entry point is the pull request overview page. The existing `Related Issues`
section gets an icon button in its heading.

```text
Related Issues (2)                                      [+]
  #339 Quantization format docs need corrections
    Open | mominhua | Bug-Report | TODO | updated Jun 29

  #341 Improve examples for model conversion
    Open | alice | Feature | TODO | updated Jun 30
```

Button behavior:

- Use an icon-only add button with `aria-label="Add related issue"`.
- Keep space for the button reserved so the heading does not shift.
- Disable the button while a link request is in flight.
- Keep keyboard activation and focus styling consistent with existing overview
  actions.

When clicked, the extension host opens a VS Code quick input flow. The first
version can use direct number entry because the API accepts issue numbers:

```text
Issue numbers to link to PR #660
Example: 339 or 339,341,342
```

If issue list data is already available or can be loaded cheaply, the quick
input may offer checkable issue choices:

```text
Select issues to link to PR #660
  #339 Quantization format docs need corrections
  #341 Improve examples for model conversion
  #342 Broken image in README
```

The direct entry path must remain available even when issue listing fails,
because linking by known issue number is the minimum supported API flow.

Validation rules:

- At least one issue number is required.
- Split comma-separated input on commas, whitespace, and new lines.
- Trim values before validation.
- Each value must be a positive integer.
- Deduplicate issue numbers before submitting.
- Do not submit issue numbers already shown in the current related issue
  snapshot.
- If all entered numbers are already linked, show `All selected issues are
  already related to this pull request.`

After submit:

- show a progress notification or quick input busy state
- keep the pull request overview rendered
- on success, show `Related issue added to pull request #660` for one issue or
  `Related issues added to pull request #660` for multiple issues
- refresh the related issues section
- refresh the pull request timeline/activity if that feature is active, because
  GitCode may record a relationship operation log
- keep comments unchanged unless the existing refresh pipeline reloads them
- on failure, keep the overview page open and show the API error in a VS Code
  error notification

## API Contract

Use the endpoint from [api.md](api.md):

```text
POST /api/v5/repos/:owner/:repo/pulls/:number/issues
```

Request body:

```json
[
  339,
  341
]
```

The service call should be:

```ts
pullRequestService.addRelatedIssues(
  repository,
  pullRequestNumber,
  issueNumbers,
);
```

`GitCodeClient` remains responsible for authentication, base URL handling, and
request errors. The view layer must not append `access_token` or construct raw
API URLs.

The API response is an array of issue-like objects. The sample response contains
only:

- `id`
- `number`
- `title`

Because the response can be smaller than the existing related issue list
contract, the implementation should support two paths:

1. map complete response objects through `mapPullRequestRelatedIssues` when they
   include enough fields for the existing related issue row
2. map minimal response objects into `AddedPullRequestRelatedIssue` summaries
   for notifications, then refresh the canonical related issue list from
   `GET /api/v5/repos/:owner/:repo/pulls/:number/issues`

The refreshed GET response remains the source of truth for rendering the
overview section.

## Domain Model

Keep `PullRequestRelatedIssue` as the render model for the related issue
section. Add a small request/response model for the link operation in
`src/common/models.ts`:

```ts
export interface AddPullRequestRelatedIssuesInput {
  issueNumbers: readonly number[];
}

export interface AddedPullRequestRelatedIssue {
  id: number;
  number: number;
  title: string;
}
```

The service method can return the minimal response:

```ts
async addRelatedIssues(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  issueNumbers: readonly number[],
): Promise<AddedPullRequestRelatedIssue[]>;
```

Mapping rules:

- Require the request body to be a non-empty array of positive integers.
- Convert response `id` and `number` with `Number(...)`.
- Normalize missing response titles to an empty string.
- Drop response entries with unusable issue numbers only if the mapper already
  follows that defensive pattern; otherwise surface mapper errors so API
  contract problems are visible in tests.
- Do not synthesize labels, state, author, dates, or repository data for the
  overview row from the minimal POST response.

## Architecture

Use this flow:

```text
PullRequestOverviewPanel
  -> Add related issue quick input
  -> PullRequestOverviewStore
  -> PullRequestService
  -> GitCodeClient
  -> addedPullRequestRelatedIssueMapper
  -> invalidate related issue cache
  -> reload pull request overview related issues
```

Dependency rules:

- `view` sends issue numbers and consumes domain models, never raw GitCode
  responses.
- `gitcode/services` owns endpoint construction.
- `gitcode/mappers` owns response normalization.
- the overview store owns related issue cache invalidation.
- the panel owns command routing, quick input, validation, and refresh behavior.
- the HTML renderer owns escaped markup projection only.

## Proposed Files

Create:

```text
src/gitcode/mappers/addedPullRequestRelatedIssueMapper.ts
```

Update:

```text
src/common/models.ts
src/gitcode/services/pullRequestService.ts
src/view/overview/pullRequestOverviewStore.ts
src/view/overview/pullRequestOverviewPanel.ts
src/view/overview/overviewHtml.ts
src/view/viewController.ts
package.json
```

## Service Design

Extend `PullRequestService`:

```ts
async addRelatedIssues(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  issueNumbers: readonly number[],
): Promise<AddedPullRequestRelatedIssue[]>;
```

Endpoint construction:

```text
/api/v5/repos/:owner/:repo/pulls/:number/issues
```

Request behavior:

- send `POST`
- send the issue number array as the JSON request body
- require `Content-Type: application/json`
- rely on `GitCodeClient` for access token handling
- call `mapAddedPullRequestRelatedIssues(response)` before returning

The method should not silently ignore an empty `issueNumbers` array. Empty input
is a caller validation error and should throw before the HTTP request.

## Store Design

The current `PullRequestOverviewStore` already owns pull request detail and
related issue caching. Add a mutation method there instead of creating a
separate store only for this operation:

```ts
async addRelatedIssues(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  issueNumbers: readonly number[],
): Promise<AddedPullRequestRelatedIssue[]>;
```

Rules:

- Check `AuthService.getSession()` before calling the service.
- Submit through `PullRequestService.addRelatedIssues`.
- Invalidate the related issue cache key for the pull request after success.
- Do not invalidate the pull request detail cache unless the API response or UI
  later shows PR detail fields changing.
- Remove failed mutation state so a retry can run immediately.
- Share no mutation promises by default; two explicit user submissions should
  remain separate API calls.

If the implementation has already split related issues into a dedicated
`PullRequestRelatedIssuesStore`, place the mutation there and keep the same
rules.

## Panel Design

Extend `PullRequestOverviewPanel` message handling with:

```text
addRelatedIssue
```

Recommended behavior:

1. User activates the add button in the `Related Issues` heading.
2. Webview posts `addRelatedIssue`.
3. Panel opens the issue-number quick input.
4. Panel validates and deduplicates issue numbers.
5. Panel filters out issue numbers already present in `relatedIssuesSnapshot`.
6. Panel calls `store.addRelatedIssues(...)`.
7. On success, panel refreshes related issues and rerenders the overview.
8. On failure, panel keeps the current overview visible and reports the error.

The panel should keep the mutation independent from the main detail load:

```ts
interface PullRequestOverviewRenderState {
  detail: PullRequestDetail;
  relatedIssues?: PullRequestRelatedIssuesSnapshot;
  relatedIssuesError?: string;
  addRelatedIssueInProgress?: boolean;
  addRelatedIssueError?: string;
}
```

Avoid making the mutation block pull request rendering. If linking fails, the
existing related issue list should remain visible.

## HTML Rendering

Update `renderRelatedIssuesSection` so the heading can include an add button:

```ts
renderRelatedIssuesSection(snapshot, {
  canAddRelatedIssue: true,
  addRelatedIssueInProgress,
});
```

Suggested heading:

```html
<div class="section-heading-row">
  <h2>Related Issues (2)</h2>
  <button
    class="icon-button"
    data-action="addRelatedIssue"
    aria-label="Add related issue"
    title="Add related issue"
  >
    ...
  </button>
</div>
```

Render the button for loaded, empty, and error states. If related issues fail to
load, the user may still know an issue number and should be allowed to retry
linking unless authentication failed.

Security requirements:

- Continue using `escapeHtml` for all rendered issue data.
- Do not inject quick input values into HTML.
- Keep the existing content security policy with a per-render nonce.
- Route all webview actions through `postMessage`.
- Do not render API error details as raw HTML.

## Commands

Add a command for keyboard and command palette access:

```text
gitcode.pullRequest.addRelatedIssue
GitCode: Add Related Issue to Pull Request
```

Command behavior:

- If a pull request overview panel is active, run the same quick input flow for
  that pull request.
- If no pull request overview panel is active, show
  `Open a pull request before adding a related issue.`

The section add button should use the panel-local message flow. The command
should call a static `PullRequestOverviewPanel.addRelatedIssueToCurrent()`
method so both paths share validation and service behavior.

## Error and Empty States

Use independent states:

- no issue numbers entered: `Enter at least one issue number.`
- invalid number: `Issue numbers must be positive integers.`
- all duplicates: `All selected issues are already related to this pull
  request.`
- unauthenticated: use the existing not-signed-in message pattern
- permission or API failure: show the API message from `ApiRequestError`
- related issue refresh failure after successful POST: show the success
  notification, then render `Unable to load related issues` in the section

Successful POST and failed refresh should not be treated as a failed link. The
relationship was created; only the follow-up read failed.

## Testing

Add focused unit tests:

- `addedPullRequestRelatedIssueMapper.test.ts`
  - maps the sample response from [api.md](api.md)
  - normalizes string issue numbers to numbers
  - normalizes missing titles to an empty string
  - rejects or surfaces non-array payloads according to mapper conventions
- `pullRequestService.test.ts`
  - sends `POST /api/v5/repos/:owner/:repo/pulls/:number/issues`
  - sends the JSON body as an array of issue numbers
  - maps the response through the added related issue mapper
  - rejects empty issue number arrays before making a request
- `pullRequestOverviewStore.test.ts`
  - requires authentication
  - calls `PullRequestService.addRelatedIssues`
  - invalidates only the related issue cache after success
  - allows retry after failure
- `overviewHtml.test.ts`
  - renders the add button in loaded, empty, and error related issue states
  - emits the `addRelatedIssue` webview action
  - keeps existing related issue rows escaped
- `pullRequestOverviewPanel.test.ts`
  - validates comma-separated issue number input
  - deduplicates issue numbers
  - filters already linked issue numbers
  - keeps the overview visible when linking fails
  - refreshes related issues after successful linking
  - exposes the command only when a PR overview is active

Manual verification:

1. Open the Pull Requests tree.
2. Select a pull request.
3. Click the add button in `Related Issues`.
4. Enter one existing issue number and confirm it appears in the related issue
   list after refresh.
5. Enter multiple issue numbers separated by commas and confirm all are linked.
6. Enter an already linked issue number and confirm no POST is sent.
7. Enter an invalid value and confirm validation prevents submission.
8. Simulate a POST failure and confirm the current overview remains visible.
9. Simulate a refresh failure after successful POST and confirm the link success
   notification still appears.

## Future Extensions

This design leaves room for:

- unlinking issues from a pull request
- creating a new issue and linking it in one flow
- search-as-you-type issue lookup
- linking issues from selected text in a pull request description
- showing operation log entries immediately after a successful link
