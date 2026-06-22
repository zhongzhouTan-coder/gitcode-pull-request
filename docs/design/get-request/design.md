# Get Pull Request Design

## Goal

Implement a pull request detail page for GitCode pull requests opened from the existing `pr:gitcode` tree.

The feature must:

- call the GitCode get pull request API documented in [api.md](api.md)
- reuse the existing pull request tree as the entry point
- present pull request details in a VS Code page modeled after the GitHub pull request overview experience in `vscode-pull-request-github`
- render the detail page from domain models, not raw GitCode DTOs
- keep API access inside `gitcode/services/*`, not in the view layer

The GitHub reference is not the exact implementation target. The goal is to copy the information architecture that works well in VS Code:

- open a dedicated PR overview page from the tree
- show title, state, author, branches, metadata, and description first
- keep room for later actions and detail sections such as files, commits, and comments

## Scope

### In Scope

- Open a PR detail page from an existing pull request tree node.
- Fetch pull request detail data with `GET /api/v5/repos/:owner/:repo/pulls/:pull_number`.
- Display the PR header, status, author, branches, labels, assignees, reviewers, timestamps, mergeability, and body content.
- Support refresh of the active detail page.
- Reuse the existing authentication and repository resolution flow.
- Define a detail domain model and mapper separate from `PullRequestSummary`.

### Out of Scope

- File changes view.
- Commits list.
- Review threads and inline comments.
- Merge, close, checkout, approve, request changes, or comment actions.
- Live subscriptions or push updates.
- Cross-panel synchronization beyond manual refresh.

Those features need more APIs than the current get-request endpoint provides.

## User Experience

The entry point remains the pull request tree:

```text
Pull Requests
  owner/repo (origin)
    All Open
      #567 [Doc] Add unit testing guide
```

Selecting `#567` should open a dedicated PR overview page instead of directly opening the browser.

The page layout should follow a GitHub-style overview split:

```text
Pull Request: #567 [Doc] Add unit testing guide

Header
  state badge | draft badge | title | number
  author | source branch -> target branch | updated time
  Open on GitCode

Main Content
  Description
    rendered markdown body

Sidebar
  Reviewers
  Assignees
  Labels
  Source / Target branches
  Created / Updated / Closed / Merged time
  Mergeability
```

Recommended behavior:

- Use a webview page, not a tree child expansion, because the PR body is markdown-rich and can be long.
- Keep the tree node label compact and use the detail page for full metadata.
- Open external links in the browser.
- If the body is empty, show `No description provided`.
- If arrays such as labels or assignees are empty, show a compact empty state like `None`.

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/:repo/pulls/:pull_number
```

The service call should be:

```ts
pullRequestService.getPullRequest(repository, pullRequestNumber);
```

The response should be mapped to a new `PullRequestDetail` model.

Minimum fields needed by the page:

- `number`
- `title`
- `state`
- `body`
- `url`
- `htmlUrl`
- `draft`
- `createdAt`
- `updatedAt`
- `closedAt`
- `mergedAt`
- `author`
- `sourceBranch`
- `sourceSha`
- `sourceRepository`
- `targetBranch`
- `targetSha`
- `targetRepository`
- `labels`
- `assignees`
- `reviewers`
- `testers`
- `canMergeCheck`
- `mergeable`
- `mergeableState`

## Domain Model

Add a detail model instead of expanding `PullRequestSummary` with optional fields for everything.

Suggested types:

```ts
export interface PullRequestParticipant {
  login: string;
  name?: string;
  avatarUrl?: string;
  htmlUrl?: string;
}

export interface PullRequestLabel {
  id: number;
  name: string;
  color?: string;
}

export interface PullRequestBranchRef {
  label: string;
  ref: string;
  sha?: string;
  repositoryFullName?: string;
  repositoryUrl?: string;
  owner?: string;
}

export interface PullRequestMergeabilityState {
  mergeable: boolean;
  canMergeCheck?: boolean;
  hasConflicts?: boolean;
  ciPassed?: boolean;
  reviewPassed?: boolean;
  reason?: string[];
}

export interface PullRequestDetail {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  body: string;
  url?: string;
  htmlUrl?: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  mergedAt?: string;
  author: PullRequestParticipant;
  source: PullRequestBranchRef;
  target: PullRequestBranchRef;
  assignees: PullRequestParticipant[];
  reviewers: PullRequestParticipant[];
  testers: PullRequestParticipant[];
  labels: PullRequestLabel[];
  mergeability: PullRequestMergeabilityState;
}
```

Mapping rules:

- `mergedAt` present means the displayed state should be `merged` even if the API `state` field is still only `open/closed`.
- `user`, `head.user`, and list participants should be normalized to one participant shape.
- `mergeable_state.reason` should be flattened into human-readable strings for UI display.
- Empty strings from GitCode timestamps should be normalized to `undefined`.

## Architecture

Follow this flow:

```text
PR tree node command
  -> PullRequestOverviewController
  -> PullRequestDetailStore
  -> PullRequestService
  -> GitCodeClient
  -> PullRequestOverviewPanel
  -> Webview HTML renderer
```

Dependency rules:

- `view` may depend on `common`, `authentication`, and `gitcode/services`.
- `view` must not depend on raw GitCode DTOs.
- `gitcode` must not depend on `view`.
- The overview panel consumes `PullRequestDetail`, not `any`.

## Proposed Files

Create or update:

```text
src/common/
  models.ts

src/gitcode/
  mappers/
    pullRequestDetailMapper.ts
  services/
    pullRequestService.ts

src/view/
  commands/
    registerTreeCommands.ts
    registerOverviewCommands.ts
  overview/
    pullRequestOverviewPanel.ts
    pullRequestOverviewSerializer.ts
    pullRequestOverviewStore.ts
    overviewHtml.ts
    overviewProtocol.ts
  webview/
    markdown.ts
```

Update existing files:

- `src/common/constants.ts`
- `src/view/tree/nodes/pullRequestNode.ts`
- `src/view/viewController.ts`
- `package.json`

## Command Design

### `gitcode.openPullRequest`

Change behavior from "open browser directly" to "open PR overview page".

Input:

- `PullRequestNodeContext`

Flow:

1. Resolve the PR repository and number from the node context.
2. Open or reveal the matching overview panel.
3. Fetch detail data if the panel cache is empty or stale.
4. Render the page.

### `gitcode.openPullRequestOnWeb`

Add a dedicated browser command for:

- overview page action button
- tree item context menu

This keeps the detail page as the default open behavior while preserving the old web jump.

### `gitcode.refreshPullRequest`

Refresh the active overview page only.

## Panel Design

Use one webview panel per `owner/repo#number`, similar to the GitHub overview behavior.

Panel responsibilities:

- load PR detail data
- render the HTML
- handle link clicks and button commands
- maintain lightweight per-panel cache

The panel should not:

- call `GitCodeClient` directly
- know about authentication tokens
- parse GitCode DTOs

Suggested render states:

- loading
- loaded
- empty body
- error
- unauthenticated

## Webview Content Design

The page should render these sections in order.

### Header

- state badge: `Open`, `Closed`, or `Merged`
- draft badge when `draft === true`
- PR title and number
- author identity
- source branch -> target branch
- last updated time
- `Open on GitCode` action

### Status Summary

Render a compact summary card from mergeability fields:

- mergeable or blocked
- conflict state
- CI state
- review requirement state
- merge restriction reason when present

This is the closest GitCode equivalent to the GitHub overview status block.

### Description

- render `body` as markdown
- preserve code fences, lists, and links
- sanitize rendered HTML through VS Code webview-safe output

### Sidebar Metadata

- reviewers
- assignees
- testers
- labels
- source repository and branch
- target repository and branch
- created time
- updated time
- closed time
- merged time

## Store Design

`PullRequestOverviewStore` is the source of truth for one PR detail page.

Suggested class surface:

```ts
export class PullRequestOverviewStore {
  readonly onDidChange: vscode.Event<void>;

  getDetail(
    repository: GitCodeRepository,
    pullRequestNumber: number,
  ): Promise<PullRequestDetail>;

  refresh(
    repository: GitCodeRepository,
    pullRequestNumber: number,
  ): Promise<void>;
}
```

Cache policy:

- cache by `${repository.fullName}#${pullRequestNumber}`
- share in-flight requests for the same PR
- clear only that PR entry on refresh
- do not cache failed responses as success

## Error Handling

Expected failure cases:

- unauthenticated user
- PR not found
- repository override points to the wrong GitCode repository
- API schema mismatch
- markdown rendering failure

UI behavior:

- show a user-readable error page inside the panel
- keep the panel open so the user can retry
- expose `Open on GitCode` only when `htmlUrl` exists
- log raw error details to the extension output channel

## Configuration

No new mandatory configuration is required for the first detail page.

Optional future settings:

- `gitcode.pullRequests.openMode`: `overview | browser`
- `gitcode.pullRequests.description.maxPreviewLength`

These should not be added until a real use case appears.

## Implementation Steps

1. Add `PullRequestDetail` domain types.
2. Add `pullRequestService.getPullRequest`.
3. Add `pullRequestDetailMapper`.
4. Add the overview store and panel classes.
5. Change `gitcode.openPullRequest` to open the panel.
6. Add `gitcode.openPullRequestOnWeb`.
7. Add refresh wiring for the panel.
8. Render markdown body and metadata sidebar.
9. Add tests.

## Test Plan

Unit tests:

- `pullRequestDetailMapper` maps the GitCode response into `PullRequestDetail`
- merged, closed, draft, and empty-body states map correctly
- mergeability reason flattening is stable
- empty timestamps become `undefined`
- panel cache reuses in-flight requests

Integration tests:

- tree node command opens the overview panel
- second open of the same PR reveals the existing panel
- refresh reloads data for only that PR
- unauthenticated state renders a recoverable error view

Manual validation:

- open a PR with markdown-heavy body
- open a merged PR
- open a PR with no labels, no assignees, and no reviewers
- verify links open correctly in the browser

## Future Extensions

- files-changed section backed by a dedicated diff API
- commits section
- discussion timeline
- review actions
- checkout branch action
- merge action
- tree and panel synchronization for active PR state
