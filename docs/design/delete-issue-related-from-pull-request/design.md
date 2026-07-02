# Delete Related Issue from Pull Request Design

## Goal

Add a GitCode flow for removing one or more issue relationships from a pull
request.

The feature must:

- call the GitCode delete related issue API documented in [api.md](api.md)
- start from the existing pull request overview page
- let users unlink issue numbers that are already related to the active pull
  request
- refresh the pull request overview related issue section after a successful
  unlink
- keep GitCode API access inside `gitcode/services/*`, not in the view layer
- preserve the existing related issue read and add flows
- make the UI copy clear that this removes only the relationship, not the issue

This feature removes pull-request-to-issue relationships only. It should not
delete issues, edit issue fields, edit pull request content, change merge state,
or change comments.

## Scope

### In Scope

- Add a remove/unlink action to each related issue row in the pull request
  overview page.
- Add a command that unlinks related issues from the currently active pull
  request overview.
- Let users select one or more currently linked issues.
- Confirm the destructive relationship action before submitting.
- Validate issue numbers before submitting.
- Submit one or more issue numbers through `PullRequestService`.
- Invalidate and reload the related issue cache after success.
- Refresh pull request activity/operation logs when available, because GitCode
  may record relationship changes there.
- Show loading, validation, unauthenticated, permission, and API error states.
- Keep the pull request detail, comments, timeline, and remaining related issues
  visible while the unlink action is running.

### Out of Scope

- Deleting GitCode issues.
- Closing, reopening, or otherwise editing issues.
- Editing pull request title, body, labels, branches, reviewers, or state.
- Removing pull request links from the issue overview page.
- Bulk unlinking across multiple pull requests.
- Optimistic row removal before the API request succeeds.
- Background refresh, polling, or push-driven synchronization.
- Cross-repository relationship deletion unless the API later documents that
  behavior.

## User Experience

The primary entry point is each row in the pull request overview `Related
Issues` section. Rows get a small icon-only unlink button next to the existing
title and external-link actions.

```text
Related Issues (2)                                      [+]
  #339 Quantization format docs need corrections       [external] [unlink]
    Open | mominhua | Bug-Report | TODO | updated Jun 29

  #341 Improve examples for model conversion           [external] [unlink]
    Open | alice | Feature | TODO | updated Jun 30
```

Button behavior:

- Use an icon-only button with `aria-label="Remove related issue"`.
- Use `title="Remove related issue"`.
- Disable remove buttons while an unlink request is in flight.
- Keep keyboard activation and focus styling consistent with existing overview
  icon buttons.
- Do not hide the row until GitCode confirms the relationship was removed.

When clicked, the webview posts the issue number to the extension host. The host
shows a confirmation prompt:

```text
Remove issue #339 from related issues on PR #660?
```

Confirmation buttons:

- `Remove relationship`
- `Cancel`

The prompt text must avoid phrases such as `Delete issue`, because the API
removes the relationship only.

For command palette access, provide a multi-select quick pick when a pull
request overview is active:

```text
Select related issues to remove from PR #660
  #339 Quantization format docs need corrections
  #341 Improve examples for model conversion
```

If there are no related issues loaded, show:

```text
No related issues to remove.
```

After submit:

- show a progress notification or disable row actions while the request runs
- keep the pull request overview rendered
- on success, show `Related issue removed from pull request #660` for one issue
  or `Related issues removed from pull request #660` for multiple issues
- refresh the related issues section
- refresh pull request activity/operation logs when that store is available
- keep comments unchanged unless the existing refresh pipeline reloads them
- on failure, keep the overview page open and show the API error in a VS Code
  error notification

## API Contract

Use the endpoint from [api.md](api.md):

```text
DELETE /api/v5/repos/:owner/:repo/pulls/:number/issues
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
pullRequestService.removeRelatedIssues(
  repository,
  pullRequestNumber,
  issueNumbers,
);
```

`GitCodeClient` remains responsible for authentication, base URL handling, and
request errors. The view layer must not append `access_token` or construct raw
API URLs.

The documented response is `200 OK` with an empty JSON array. Treat the response
as an acknowledgement only. The canonical related issue list must come from the
existing `GET /api/v5/repos/:owner/:repo/pulls/:number/issues` refresh after the
DELETE succeeds.

## Domain Model

No new render model is required. Continue using `PullRequestRelatedIssue` and
`PullRequestRelatedIssuesSnapshot` for the overview section.

Add a small input type only if the codebase wants symmetry with the add flow:

```ts
export interface RemovePullRequestRelatedIssuesInput {
  issueNumbers: readonly number[];
}
```

The service method can return `void`:

```ts
async removeRelatedIssues(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  issueNumbers: readonly number[],
): Promise<void>;
```

Validation rules:

- Require a non-empty issue number array.
- Require positive integers.
- Deduplicate issue numbers before submitting.
- When the action comes from current row data, only submit numbers present in
  the current `relatedIssuesSnapshot`.
- If all selected numbers are no longer related, show
  `Selected issues are no longer related to this pull request.`

## Architecture

Use this flow:

```text
PullRequestOverviewPanel
  -> related issue row unlink action or command quick pick
  -> confirmation
  -> PullRequestOverviewStore
  -> PullRequestService
  -> GitCodeClient
  -> invalidate related issue cache
  -> reload pull request overview related issues
```

Dependency rules:

- `view` sends issue numbers and consumes domain models, never raw GitCode
  responses.
- `gitcode/services` owns endpoint construction.
- no mapper is needed unless GitCode later returns relationship records from
  DELETE
- the overview store owns related issue cache invalidation.
- the panel owns command routing, quick pick, confirmation, validation, and
  refresh behavior.
- the HTML renderer owns escaped markup projection only.

## Proposed Files

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

No mapper file is required for the documented empty-array response.

## Service Design

Extend `PullRequestService`:

```ts
async removeRelatedIssues(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  issueNumbers: readonly number[],
): Promise<void>;
```

Endpoint construction:

```text
/api/v5/repos/:owner/:repo/pulls/:number/issues
```

Request behavior:

- send `DELETE`
- send the issue number array as the JSON request body
- require `Content-Type: application/json`
- rely on `GitCodeClient` for access token handling
- ignore the documented empty array response

The method should not silently ignore an empty `issueNumbers` array. Empty input
is a caller validation error and should throw before the HTTP request.

If `GitCodeWriteClient` does not currently expose a `delete` method with a JSON
body, extend the client rather than special-casing this endpoint in the service.

## Store Design

Add a mutation method to `PullRequestOverviewStore`:

```ts
async removeRelatedIssues(
  repository: GitCodeRepository,
  pullRequestNumber: number,
  issueNumbers: readonly number[],
): Promise<void>;
```

Rules:

- Check `AuthService.getSession()` before calling the service.
- Submit through `PullRequestService.removeRelatedIssues`.
- Invalidate the related issue cache key for the pull request after success.
- Do not invalidate the pull request detail cache unless the API response or UI
  later shows PR detail fields changing.
- Fire the store change event after successful invalidation.
- Remove failed mutation state so a retry can run immediately.
- Share no mutation promises by default; two explicit user submissions should
  remain separate API calls.

## Panel Design

Extend `PullRequestOverviewPanel` message handling with:

```text
removeRelatedIssue
```

The row-level behavior:

1. User activates the remove button on a related issue row.
2. Webview posts `removeRelatedIssue` with the issue number.
3. Panel verifies the issue number is present in the current
   `relatedIssuesSnapshot`.
4. Panel asks the user to confirm removing the relationship.
5. Panel calls `store.removeRelatedIssues(...)`.
6. On success, panel refreshes related issues and rerenders the overview.
7. On failure, panel keeps the current overview visible and reports the error.

The command behavior:

1. User runs `gitcode.pullRequest.removeRelatedIssue`.
2. Panel reads the current `relatedIssuesSnapshot`.
3. Panel shows a multi-select quick pick of currently related issues.
4. Panel confirms the selected removal.
5. Panel uses the same store and refresh path as the row action.

Recommended in-memory render state:

```ts
interface PullRequestOverviewRenderState {
  detail: PullRequestDetail;
  relatedIssues?: PullRequestRelatedIssuesSnapshot;
  relatedIssuesError?: string;
  addRelatedIssueInProgress?: boolean;
  removeRelatedIssueInProgress?: boolean;
  removingRelatedIssueNumbers?: readonly number[];
}
```

Avoid making the mutation block pull request rendering. If unlinking fails, the
existing related issue list should remain visible.

## HTML Rendering

Update `renderRelatedIssuesSection` so each row can include a remove button:

```ts
renderRelatedIssuesSection(snapshot, {
  canAddRelatedIssue: true,
  canRemoveRelatedIssue: true,
  addRelatedIssueInProgress,
  removeRelatedIssueInProgress,
  removingRelatedIssueNumbers,
});
```

Suggested row action:

```html
<button
  class="icon-button remove-related-issue-btn"
  data-action="removeRelatedIssue"
  data-issue="339"
  aria-label="Remove related issue"
  title="Remove related issue"
>
  ...
</button>
```

Render remove buttons only for loaded related issue rows. Empty, loading, and
error states should not show remove controls because there is no confirmed
relationship to remove.

Security requirements:

- Continue using `escapeHtml` for all rendered issue data.
- Do not inject quick input values into HTML.
- Keep the existing content security policy with a per-render nonce.
- Route all webview actions through `postMessage`.
- Do not render API error details as raw HTML.
- Validate `data-issue` again in the extension host before calling the service.

## Commands

Add a command for keyboard and command palette access:

```text
gitcode.pullRequest.removeRelatedIssue
GitCode: Remove Related Issue from Pull Request
```

Command behavior:

- If a pull request overview panel is active, run the same quick pick and
  confirmation flow for that pull request.
- If no pull request overview panel is active, show
  `Open a pull request before removing a related issue.`
- If no related issues are loaded or present, show `No related issues to
  remove.`

The row remove button should use the panel-local message flow. The command
should call a static `PullRequestOverviewPanel.removeRelatedIssueFromCurrent()`
method so both paths share validation and service behavior.

## Error and Empty States

Use independent states:

- no selected issue numbers: `Select at least one related issue.`
- invalid number: `Issue numbers must be positive integers.`
- selected numbers no longer related: `Selected issues are no longer related to
  this pull request.`
- unauthenticated: use the existing not-signed-in message pattern
- permission or API failure: show the API message from `ApiRequestError`
- related issue refresh failure after successful DELETE: show the success
  notification, then render `Unable to load related issues` in the section

Successful DELETE and failed refresh should not be treated as a failed unlink.
The relationship was removed; only the follow-up read failed.

## Testing

Add focused unit tests:

- `pullRequestService.test.ts`
  - sends `DELETE /api/v5/repos/:owner/:repo/pulls/:number/issues`
  - sends the JSON body as an array of issue numbers
  - ignores the documented empty array response
  - rejects empty issue number arrays before making a request
- `pullRequestOverviewStore.test.ts`
  - requires authentication
  - calls `PullRequestService.removeRelatedIssues`
  - invalidates only the related issue cache after success
  - allows retry after failure
- `overviewHtml.test.ts`
  - renders remove buttons for loaded related issue rows
  - does not render remove buttons for empty, loading, or error states
  - emits the `removeRelatedIssue` webview action with the issue number
  - disables remove buttons while unlinking is in progress
  - keeps existing related issue rows escaped
- `pullRequestOverviewPanel.test.ts`
  - validates row-provided issue numbers
  - filters selected numbers against the current related issue snapshot
  - confirms before calling the store
  - keeps the overview visible when unlinking fails
  - refreshes related issues after successful unlinking
  - reports no active PR overview for command usage without a panel
  - reports no related issues when the active panel has none

Manual verification:

1. Open the Pull Requests tree.
2. Select a pull request with related issues.
3. Click the remove button on one related issue row.
4. Confirm the relationship removal and verify the issue disappears after
   refresh.
5. Use the command palette command and remove multiple related issues.
6. Cancel the confirmation and confirm no DELETE request is sent.
7. Simulate a DELETE failure and confirm the current overview remains visible.
8. Simulate a refresh failure after successful DELETE and confirm the unlink
   success notification still appears.
9. Confirm the issue still exists in the issue tree or on GitCode after the
   relationship is removed.

## Future Extensions

This design leaves room for:

- adding undo by immediately relinking the removed issue numbers
- removing related pull requests from the issue overview page
- showing operation log entries immediately after a successful unlink
- supporting relationship management in a dedicated edit mode for the related
  issues section
