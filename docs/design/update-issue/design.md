# Edit Issue Design

## Goal

Add a GitCode issue basic information edit flow from the existing issue overview
page.

The feature must:

- call the GitCode edit issue API documented in [api.md](api.md)
- let users update issue title, description, assignees, labels,
  milestone, and private/security flag when supported by the API
- let users close or reopen the issue through an explicit state action button
- expose pencil edit buttons in each editable issue information block, following
  the same section-based pattern as [../edit-pull-request/design.md](../edit-pull-request/design.md)
- prefill inline section editors from the currently loaded `IssueDetail`
- keep API access inside `gitcode/services/*`, not in the view layer
- refresh the active issue overview page and issue tree after a successful edit
- preserve the existing issue overview, comments, related pull request, and tree
  architecture

This feature is intentionally scoped to issue basic information. Comments,
related pull requests, issue type, priority, workflow state, project state, and
template selection are not included in the first version unless the patch API
adds explicit fields for them.

## Scope

### In Scope

- Add pencil icon buttons to editable issue overview blocks.
- Prefill inline section editors from `IssueDetail`.
- Support editing:
  - title
  - body
  - assignees selected from the repository member API
  - labels selected from the repository label API
  - milestone selected from the repository milestone API
  - security/private issue flag
- Support a primary state action:
  - open issue shows `Close issue`
  - closed issue shows `Reopen issue`
- Load labels, milestones, and members through existing repository APIs so issue
  edit controls use the same option data as create issue.
- Validate required fields before submitting.
- Submit changes through `IssueService`.
- Map the edit response back into `IssueDetail`.
- Invalidate the issue overview store cache after success.
- Refresh the issue tree because title, state, assignees, labels, milestone, and
  visibility can affect tree rendering or filtering.
- Keep issue comments and related pull requests visible when possible while
  editing issue basics.
- Show loading, validation, unauthenticated, and API error states.

### Out of Scope

- Editing issue comments or comment threads.
- Editing related pull requests or link relationships.
- Editing issue type, priority, workflow state, project state, or settlement
  metadata unless a separate API contract is added.
- Creating a branch from the edit form.
- Editing issue templates after creation.
- Bulk editing multiple issues.
- Optimistic updates before the API call succeeds.
- Opening a separate edit page, modal, or webview panel.

## User Experience

The issue overview should keep users on the same page. It should not open a
separate edit page, modal, or full-page form. Instead, each editable information
block should expose a small icon-only pencil button, matching the pull request
overview edit pattern.

Recommended layout:

```text
Issue #309
Open - author opened this issue

Title
  Quantization warning for Qwen3.6              [pencil]

Description
  Markdown-rendered issue body                  [pencil]

Sidebar
  Assignees                                    [pencil]
    @alice  @bob

  Labels                                       [pencil]
    bug  performance

  Milestone                                    [pencil]
    MindStudio 26.2.0

  Security issue                               [pencil]
    No

Actions
  [Close issue]
```

Use icon buttons rather than text buttons:

```text
pencil icon, aria-label="Edit title"
pencil icon, aria-label="Edit description"
pencil icon, aria-label="Edit assignees"
pencil icon, aria-label="Edit labels"
pencil icon, aria-label="Edit milestone"
```

When the user clicks an edit icon, only that block changes into edit mode. Other
blocks remain readable.

Title edit mode:

```text
Title
  [input with current title]
  [Save] [Cancel]
```

Description edit mode:

```text
Description
  [textarea with current markdown body]
  [Save] [Cancel]
```

Sidebar metadata edit mode should stay compact:

```text
Assignees
  [x] alice
  [x] bob
  [ ] charlie
  [Save] [Cancel]
```

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
Security issue
  [ ] Private/security issue
  [Save] [Cancel]
```

State should not be edited through a pencil-driven metadata editor. Render it as
an explicit action near the issue header or action area:

```text
Open issue:   [Close issue]
Closed issue: [Reopen issue]
```

Behavior:

- Opening a block edit mode should not refetch the issue if the overview already
  has a loaded `IssueDetail`.
- Only one block should be in edit mode at a time. Opening another edit block
  should first cancel the current unsaved block edit.
- The assignee block must render members from the repository member API as
  selectable options. Users should not type raw comma-separated logins.
- The labels block must render labels from the list labels API as selectable
  options. Users should not type raw comma-separated label names.
- The milestone block must render milestones from the list repository milestones
  API as selectable options, plus a `No milestone` option. Users should not type
  a raw milestone number.
- If assignee, label, or milestone options are still loading, the block can show
  the current value and disable save until option loading finishes.
- Cancel should restore that block's read-only rendering without refreshing.
- Save should disable the submit button and show an inline saving state.
- Close and reopen should disable the action button and show an inline running
  state while the PATCH request is in progress.
- On success, show `GitCode issue #309 updated`, close the edit mode, refresh
  the overview, and refresh the issue tree.
- On close or reopen success, show `GitCode issue #309 closed` or
  `GitCode issue #309 reopened`, refresh the overview, and refresh the issue
  tree.
- On block edit failure, keep that block in edit mode and show the API error
  message near the block.
- On close or reopen failure, keep the action button visible and show the API
  error near the action area.
- Pencil buttons should be visible on hover and keyboard focus, with stable
  space reserved so the layout does not shift.
- Icons must be real buttons with accessible labels and keyboard activation.

Validation rules:

- title is required after trimming
- close action must send state `close`
- reopen action must send state `reopen`
- selected assignees must come from the loaded member option list
- selected labels must come from the loaded label option list
- selected milestone must come from the loaded milestone option list or the
  explicit `No milestone` option
- security/private issue flag must be sent as a boolean when present
- labels are stored in the view state as `GitCodeLabel[]` and converted to the
  API's comma-separated `labels` string only when building `EditIssueInput`
- assignees are stored in the view state as `GitCodeUser[]` and converted to the
  API's comma-separated `assignee` string only when building `EditIssueInput`
- milestone is stored in the view state as `GitCodeMilestone | undefined` and
  converted to `milestoneNumber` only when building `EditIssueInput`
- milestone must be omitted when `No milestone` is selected unless the API later
  documents an explicit clear value
- unchanged submissions should be allowed only if the user explicitly presses
  save; the API response still becomes the refreshed source of truth

Section submit behavior:

- Title block sends `repo` and the edited title.
- Description block sends `repo`, current title, and the edited body.
- Assignees block sends `repo`, current title, and selected member logins.
- Labels block sends `repo`, current title, and selected label names.
- Milestone block sends `repo`, current title, and the selected milestone
  number, or omits milestone when `No milestone` is selected.
- Security issue block sends `repo`, current title, and the selected boolean.
- Close issue action sends `repo`, current title, and `state: 'close'`.
- Reopen issue action sends `repo`, current title, and `state: 'reopen'`.

The edit issue API examples include `repo` and `title` in the request body, so
every block save should include the repository path and current title even when
the title block is not being edited.

## API Contract

Use the endpoint from [api.md](api.md):

```text
PATCH /api/v5/repos/:owner/:repo/issues/:number
```

The service call should be:

```ts
issueService.editIssue(repository, issueNumber, input);
```

Suggested input model:

```ts
export interface EditIssueInput {
  title: string;
  body?: string;
  state?: 'reopen' | 'close';
  assignees?: string;
  milestoneNumber?: number;
  labels?: string;
  securityHole?: boolean;
}
```

Mapping rules:

- `repository.name` -> `repo`
- `title` -> `title`
- `body` -> `body`
- `state` -> `state`
- `assignees` -> `assignee`
- `milestoneNumber` -> `milestone`
- `labels` -> `labels`
- `securityHole` -> `security_hole`

`EditIssueInput` is the service/API input, not the webview editing state. The
webview should keep selected member, label, and milestone objects from option
APIs until submit time, then map them into the API shape:

```ts
selectedAssignees.map((user) => user.login).join(',');
selectedLabels.map((label) => label.name).join(',');
selectedMilestone?.number;
```

The API response should be mapped through `mapIssueDetail` when the response
contains enough detail fields. If the response is partial, merge the returned
fields over the previously loaded `IssueDetail` and then refresh from
`getIssue` so the overview returns to a complete model.

The view layer must not pass `access_token` or construct raw URLs.
`GitCodeClient` remains responsible for authentication and base URL handling.

## Supporting API Contract

Editable metadata blocks should use existing option APIs before or while
rendering section edit controls:

| Purpose          | API doc                                                                  | Endpoint                                      |
| ---------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| Assignee picker  | [../api/list-repo-members-api.md](../api/list-repo-members-api.md)       | `GET /api/v5/repos/:owner/:repo/members`      |
| Label picker     | [../api/list-labels-api.md](../api/list-labels-api.md)                   | `GET /api/v5/repos/:owner/:repo/labels`       |
| Milestone picker | [../api/list-repository-milestone-api.md](../api/list-repository-milestone-api.md) | `GET /api/v5/repos/:owner/:repo/milestones` |

These calls should be exposed through existing `RepositoryService` methods
rather than called from the webview.

Option-driven controls:

- assignees: multi-select from `GitCodeUser[]`, displayed with login/name and
  avatar when available
- labels: multi-select from `GitCodeLabel[]`, displayed with label name and
  color when available
- milestone: single-select from `GitCodeMilestone[]`, with an additional
  `No milestone` option
- no raw text input for assignees or labels
- no raw numeric input for milestone

## Domain Model

Add an edit input model to `src/common/models.ts` rather than reusing
`CreateIssueInput`. Create and edit have different API contracts, and reusing
the create input would hide the edit-specific `state` field while exposing
template fields that the edit endpoint does not support.

Suggested supporting state:

```ts
export interface EditIssueOptions {
  assignees: GitCodeUser[];
  labels: GitCodeLabel[];
  milestones: GitCodeMilestone[];
}

export interface EditIssueSnapshot {
  detail: IssueDetail;
  options: EditIssueOptions;
}

export type EditIssueSection =
  | 'title'
  | 'body'
  | 'assignees'
  | 'labels'
  | 'milestone'
  | 'securityHole';
```

`IssueDetail` already contains the current assignees, labels, milestone, title,
body, and state needed to prefill edit blocks and state actions. If the get
issue API returns the private/security flag, add an optional field to
`IssueDetail`:

```ts
securityHole?: boolean;
```

If the get issue API does not return the private/security value in practice, the
security block should be hidden or disabled until the value can be loaded
reliably. Do not default it to `false` and risk changing a private issue to
public on save.

## Architecture

Follow this flow:

```text
Issue block pencil icon or close/reopen action
  -> IssueOverviewPanel
  -> IssueOverviewStore
  -> IssueService.editIssue
  -> GitCodeClient
  -> IssueOverviewStore.refresh
  -> IssueTreeStore.refreshRepository
  -> IssueOverviewPanel reload
```

Dependency rules:

- `view` may depend on `common`, `authentication`, and `gitcode/services`
- `view` must not depend on raw GitCode DTOs
- `gitcode` must not depend on `view`
- webview messages should carry section-level edit payloads that are converted
  to `EditIssueInput`, not raw API field names
- close and reopen messages should carry the requested action, not a generic
  editable state form payload
- comments and related pull request stores should not be required for a basic
  issue edit to succeed

The issue overview store should own edit option loading so the panel only
renders normalized state:

```ts
class IssueOverviewStore {
  getEditOptions(repository: GitCodeRepository): Promise<EditIssueOptions>;
  editIssue(
    repository: GitCodeRepository,
    issueNumber: number,
    input: EditIssueInput,
  ): Promise<IssueDetail>;
}
```

After `editIssue` succeeds, the store should delete the cached detail for that
issue before returning or immediately refetching. This prevents the overview
from showing stale title, body, state, or metadata.

Suggested webview message shape:

```ts
interface EditIssueSectionMessage {
  command: 'saveIssueSection';
  section: EditIssueSection;
  input: EditIssueInput;
}

interface ChangeIssueStateMessage {
  command: 'changeIssueState';
  state: 'close' | 'reopen';
}
```

`IssueOverviewPanel` should handle `saveIssueSection` by:

1. validating the payload against the current `IssueDetail` and loaded options
2. calling `IssueOverviewStore.editIssue`
3. refreshing the active issue detail cache
4. refreshing the issue tree for `repository.fullName`
5. rerendering issue detail, comments, and related pull requests

`IssueOverviewPanel` should handle `changeIssueState` by building an
`EditIssueInput` from the current issue title plus the requested `state`, then
running the same store edit, cache invalidation, tree refresh, and rerender
path. The webview should only offer `close` when `IssueDetail.state` is `open`
and only offer `reopen` when it is `closed`.

If comments or related pull requests fail during the post-save reload, the issue
basic information should still render successfully with the same inline error
treatment already used by the issue overview page.

## Proposed Files

Create or update:

```text
src/common/models.ts
src/gitcode/mappers/issueDetailMapper.ts
src/gitcode/services/issueService.ts
src/view/issueOverview/issueOverviewStore.ts
src/view/issueOverview/issueOverviewPanel.ts
src/view/issueOverview/issueOverviewHtml.ts
src/view/state/issueTreeStore.ts
src/view/viewController.ts
```

If the edit UI becomes large enough to make `issueOverviewHtml.ts` hard to
maintain, split the section renderer into:

```text
src/view/issueOverview/editIssueHtml.ts
```

## Error Handling

- If the user is not signed in, show the existing sign-in error state.
- If the issue was deleted or the user lost access, show the API error and keep
  the last loaded overview visible when possible.
- If validation fails, do not call the API; show field-specific messages.
- If option loading fails, allow editing title and body and allow close/reopen
  actions while showing assignees, labels, and milestone as unavailable.
- If the API accepts the edit but the follow-up refresh fails, show the success
  notification and then show the refresh error in the overview page.
- If the private/security flag cannot be loaded, do not submit a default value
  for `security_hole`.

## Tests

Add focused tests for:

- mapping `EditIssueInput` to the API request body, including `repo`
- `IssueService.editIssue` uses
  `/api/v5/repos/:owner/:repo/issues/:number`
- close/reopen action mapping to API `state: 'close'` and `state: 'reopen'`
- overview store invalidates cached detail after edit
- overview webview posts the expected section-save message payload
- overview webview posts the expected close/reopen action message payload
- validation rejects empty title and invalid close/reopen state values
- assignee, label, and milestone saves only accept loaded options
- successful edit refreshes the overview and issue tree
- comments and related pull requests remain non-blocking during post-save reload
