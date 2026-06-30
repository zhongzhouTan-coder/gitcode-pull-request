# Edit Pull Request Design

## Goal

Add a GitCode pull request basic information edit flow from the pull request
overview page.

The feature must:

- call the GitCode edit pull request API documented in [api.md](api.md)
- let users update pull request title, description, state, labels, milestone,
  draft state, and close-related-issue preference
- expose edit icons in each editable overview section, similar to GitHub pull
  request pages
- prefill inline section editors from the currently loaded pull request detail
- keep API access inside `gitcode/services/*`, not in the view layer
- refresh the active overview page and pull request tree after a successful edit
- preserve the existing overview page and tree architecture

This feature is intentionally scoped to pull request basic info. Branch changes
are not included in the first version because the documented patch request body
does not include source or target branch fields.

## Scope

### In Scope

- Add edit icon buttons to each editable pull request overview section.
- Prefill inline section editors from `PullRequestDetail`.
- Support editing:
  - title
  - body
  - state
  - milestone selected from the repository milestone list API
  - labels selected from the repository label list API
  - draft flag
  - close-related-issue flag
- Load labels and milestones from the existing repository APIs so metadata
  sections can use the same option data as create pull request.
- Validate required fields before submitting.
- Submit changes through `PullRequestService`.
- Map the edit response back into `PullRequestDetail`.
- Invalidate the overview store cache after success.
- Refresh the pull request tree because title, state, draft, and labels can
  affect tree rendering or visibility.
- Show loading, validation, unauthenticated, and API error states.

### Out of Scope

- Editing source or target branch.
- Editing reviewers, testers, assignees, squash options, or source branch
  deletion behavior.
- Editing files, commits, comments, or inline review threads.
- Merge, close-only, reopen-only, or draft-only actions outside the section
  editors.
- Bulk editing multiple pull requests.
- Optimistic updates before the API call succeeds.
- Opening a separate edit page, modal, or webview panel.

## User Experience

The pull request overview should keep users on the same page. It should not open
a separate edit page, modal, or full-page form. Instead, each editable section
should expose a small icon-only edit button, matching the GitHub pull request
overview pattern.

Recommended layout:

```text
Pull Request #123
Open · author wants to merge source into target

Title
  Add login callback validation                  [pencil]

Description
  Markdown-rendered pull request body            [pencil]

Sidebar
  Labels                                      [pencil]
    bug  performance

  Milestone                                   [pencil]
    MindStudio 26.2.0

  State                                       [pencil]
    Open

  Draft                                       [pencil]
    No

  Close related issues                       [pencil]
    Yes
```

Use icon buttons rather than text buttons:

```text
pencil icon, aria-label="Edit title"
pencil icon, aria-label="Edit description"
pencil icon, aria-label="Edit labels"
```

When the user clicks an edit icon, only that section changes into edit mode.
Other sections remain readable.

```text
Title            Add login callback validation
[Save] [Cancel]
```

Description edit mode should use a textarea in place:

```text
Description
  [textarea with current markdown body]
  [Save] [Cancel]
```

Sidebar metadata edit mode should stay compact:

```text
Labels
  [x] bug
  [x] performance
  [ ] documentation
[Save] [Cancel]
```

```text
Milestone
  ( ) No milestone
  (x) MindStudio 26.2.0
  ( ) Backlog
[Save] [Cancel]
```

```text
State            Open
[Save] [Cancel]
```

```text
Draft            [ ]
[Save] [Cancel]
```

```text
Close issues     [x]
[Save] [Cancel]
```

Behavior:

- Opening a section edit mode should not refetch the pull request if the
  overview already has a loaded `PullRequestDetail`.
- Only one section should be in edit mode at a time. Opening another edit
  section should first cancel the current unsaved section edit.
- The labels section must render labels from the list labels API as selectable
  options. Users should not type raw comma-separated label names.
- The milestone section must render milestones from the list repository
  milestones API as selectable options, plus a `No milestone` option. Users
  should not type a raw milestone number.
- If label or milestone options are still loading, the section can show the
  current value and disable save until option loading finishes.
- Cancel should restore that section's read-only rendering without refreshing.
- Save should disable the submit button and show an inline saving state.
- On success, show `GitCode pull request #123 updated`, close the section edit
  mode, refresh the overview, and refresh the pull request tree.
- On failure, keep that section in edit mode and show the API error message near
  the section.
- Section edit icons should be visible on hover and keyboard focus, with stable
  space reserved so the layout does not shift.
- Icons must be real buttons with accessible labels and keyboard activation.

Validation rules:

- title is required after trimming
- state must be `opened` or `closed`
- selected labels must come from the loaded label option list
- labels are stored in the view state as `GitCodeLabel[]` and converted to the
  API's comma-separated `labels` string only when building `EditPullRequestInput`
- selected milestone must come from the loaded milestone option list or the
  explicit `No milestone` option
- milestone is stored in the view state as `GitCodeMilestone | undefined` and
  converted to `milestoneNumber` only when building `EditPullRequestInput`
- milestone must be omitted when `No milestone` is selected
- draft and close-related-issue values must be sent as booleans when present
- unchanged submissions should be allowed only if the user explicitly presses
  save; the API response still becomes the refreshed source of truth

Section submit behavior:

- Title section sends the current title.
- Description section sends the current title plus the edited body.
- Labels section sends the current title plus the names from selected label
  options.
- Milestone section sends the current title plus the number from the selected
  milestone option, or omits milestone when `No milestone` is selected.
- State section sends the current title plus the selected state.
- Draft section sends the current title plus the draft value.
- Close-related-issue section sends the current title plus the
  close-related-issue value.

The edit API marks `title` as required, so every section save must include the
current title even when the title section is not being edited.

## API Contract

Use the endpoint from [api.md](api.md):

```text
POST /api/v5/repos/:owner/:repo/pulls/:number
```

The service call should be:

```ts
pullRequestService.editPullRequest(repository, pullRequestNumber, input);
```

Suggested input model:

```ts
export interface EditPullRequestInput {
  title: string;
  body?: string;
  state?: 'opened' | 'closed';
  milestoneNumber?: number;
  labels?: string;
  draft?: boolean;
  closeRelatedIssue?: boolean;
}
```

Mapping rules:

- `title` -> `title`
- `body` -> `body`
- `state` -> `state`
- `milestoneNumber` -> `milestone_number`
- `labels` -> `labels`
- `draft` -> `draft`
- `closeRelatedIssue` -> `close_related_issue`

`EditPullRequestInput` is the service/API input, not the webview editing state.
The webview should keep selected label and milestone objects from the list APIs
until submit time, then map them into the API shape:

```ts
selectedLabels.map((label) => label.name).join(',');
selectedMilestone?.number;
```

The API response should be mapped through `mapPullRequestDetail` when the
response contains enough detail fields. If the response is partial, merge the
returned fields over the previously loaded `PullRequestDetail` and then refresh
from `getPullRequest` so the overview returns to a complete model.

The view layer must not pass `access_token` or construct raw URLs. The
`GitCodeClient` remains responsible for authentication and base URL handling.

## Supporting API Contract

Editable metadata sections should use existing option APIs before or while
rendering section edit controls:

| Purpose          | API doc                                                                  | Endpoint                                    |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| Label picker     | [../api/list-labels-api.md](../api/list-labels-api.md)                   | `GET /api/v5/repos/:owner/:repo/labels`     |
| Milestone picker | [../api/list-repository-milestone-api.md](../api/list-repository-milestone-api.md) | `GET /api/v5/repos/:owner/:repo/milestones` |

These calls should be exposed through existing `RepositoryService` methods
rather than called from the webview.

Label and milestone controls should be option-driven:

- labels: multi-select from `GitCodeLabel[]`, displayed with label name and
  color when available
- milestone: single-select from `GitCodeMilestone[]`, with an additional
  `No milestone` option
- no raw text input for labels
- no raw numeric input for milestone

## Domain Model

Add an edit input model to `src/common/models.ts` rather than reusing
`CreatePullRequestInput`. Create and edit have different API contracts, and
reusing the create input would accidentally expose branch, assignee, tester,
squash, and fork fields that the edit endpoint does not support.

Suggested supporting state:

```ts
export interface EditPullRequestOptions {
  labels: GitCodeLabel[];
  milestones: GitCodeMilestone[];
}

export interface EditPullRequestSnapshot {
  detail: PullRequestDetail;
  options: EditPullRequestOptions;
}

export interface EditPullRequestSectionState {
  selectedLabels: GitCodeLabel[];
  selectedMilestone?: GitCodeMilestone;
}
```

`PullRequestDetail` may need to grow one optional field if the API returns the
current milestone:

```ts
milestone?: IssueMilestone;
```

If the get pull request API does not return a milestone in practice, the
milestone section should still allow selecting a new milestone but leave the
initial milestone empty.

## Architecture

Follow this flow:

```text
Section edit icon
  -> PullRequestOverviewPanel
  -> PullRequestOverviewStore
  -> PullRequestService.editPullRequest
  -> GitCodeClient
  -> PullRequestOverviewStore.refresh
  -> PullRequestTreeStore.refreshRepository
  -> PullRequestOverviewPanel reload
```

Dependency rules:

- `view` may depend on `common`, `authentication`, and `gitcode/services`
- `view` must not depend on raw GitCode DTOs
- `gitcode` must not depend on `view`
- webview messages should carry section-level edit payloads that are converted
  to `EditPullRequestInput`, not raw API field names

The overview store should own edit option loading so the panel only renders
normalized state:

```ts
class PullRequestOverviewStore {
  getEditOptions(repository: GitCodeRepository): Promise<EditPullRequestOptions>;
  editPullRequest(
    repository: GitCodeRepository,
    pullRequestNumber: number,
    input: EditPullRequestInput,
  ): Promise<PullRequestDetail>;
}
```

After `editPullRequest` succeeds, the store should delete the cached detail for
that pull request before returning or immediately refetching. This prevents the
overview from showing stale title/body/state data.

Suggested webview message shape:

```ts
type EditPullRequestSection =
  | 'title'
  | 'body'
  | 'labels'
  | 'milestone'
  | 'state'
  | 'draft'
  | 'closeRelatedIssue';

interface EditPullRequestSectionMessage {
  command: 'savePullRequestSection';
  section: EditPullRequestSection;
  input: EditPullRequestInput;
}
```

## Proposed Files

Create or update:

```text
src/common/models.ts
src/gitcode/mappers/pullRequestMapper.ts
src/gitcode/services/pullRequestService.ts
src/view/overview/pullRequestOverviewStore.ts
src/view/overview/pullRequestOverviewPanel.ts
src/view/overview/overviewHtml.ts
src/view/viewController.ts
```

If the edit UI becomes large enough to make `overviewHtml.ts` hard to maintain,
split the section renderer into:

```text
src/view/overview/editPullRequestHtml.ts
```

## Error Handling

- If the user is not signed in, show the existing sign-in error state.
- If the pull request was deleted or the user lost access, show the API error
  and keep the last loaded overview visible when possible.
- If validation fails, do not call the API; show field-specific messages.
- If option loading fails, allow editing title/body/state/draft while showing
  labels and milestone as unavailable.
- If the API accepts the edit but the follow-up refresh fails, show the success
  notification and then show the refresh error in the overview page.

## Tests

Add focused tests for:

- mapping `EditPullRequestInput` to the API request body
- `PullRequestService.editPullRequest` uses
  `/api/v5/repos/:owner/:repo/pulls/:number`
- overview store invalidates cached detail after edit
- overview webview posts the expected section-save message payload
- validation rejects empty title and invalid state
- successful edit refreshes the overview and pull request tree
