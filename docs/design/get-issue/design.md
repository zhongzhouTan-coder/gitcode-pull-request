# Get Issue Design

## Goal

Implement an issue detail page for GitCode issues opened from the existing
`issues:gitcode` tree.

The feature must:

- call the GitCode get issue API documented in [api.md](api.md)
- reuse the existing Issues tree as the entry point
- present issue details in a VS Code webview modeled after the GitHub issue
  overview experience in `vscode-pull-request-github/src/github/issueOverview.ts`
- render the detail page from domain models, not raw GitCode DTOs
- keep API access inside `gitcode/services/*`, not in the view layer
- stay independent from the pull request overview implementation except for
  reusable webview utilities such as markdown rendering and HTML sanitization

The GitHub reference is an information-architecture reference, not a code-copy
target. GitCode should adopt the useful behavior:

- one detail panel per repository issue, keyed by `owner/repo#number`
- a compact tree node that opens a richer detail page
- a header with issue number, title, state, author, and timestamps
- rendered markdown body as the primary content
- a sidebar for assignees, labels, milestone, type, priority, and project state

GitCode should not adopt GitHub-specific project editing, branch-from-issue,
file upload, reactions, GraphQL timeline, or polling behavior in this feature.

## Scope

### In Scope

- Open an issue detail page from an existing issue tree node.
- Fetch issue detail data with
  `GET /api/v5/repos/:owner/:repo/issues/:number`.
- Display the issue header, status, author, body, labels, assignees, milestone,
  type, priority, issue workflow state, comment count, timestamps, and URL.
- Support refresh of the active issue detail page.
- Support opening the current issue on GitCode.
- Reuse the existing authentication, repository resolution, and issue tree flow.
- Define a detail domain model and mapper separate from `IssueSummary`.
- Normalize API inconsistencies such as `number` being returned as a string and
  empty timestamp strings.

### Out of Scope

- Creating, editing, closing, assigning, labeling, or prioritizing issues.
- Displaying issue comments or timeline events.
- Native markdown issue editor.
- Branch-from-issue workflow.
- Reactions, attachments, and file uploads.
- Polling, live subscriptions, or push updates.
- Cross-panel synchronization beyond manual refresh.

The current get-issue endpoint returns a `comments` count but not comment bodies.
Issue comments should be designed separately when a comment-list API is
available.

## User Experience

The entry point remains the Issues tree:

```text
Issues
  owner/repo (origin)
    All Open
      #309 [Bug-Report] Quantization warning for Qwen3.6
```

Selecting `#309` should open a dedicated issue overview page instead of opening
the browser directly. The browser action remains available from the context menu
and from a button inside the webview.

The page layout should follow a GitHub-style issue overview split:

```text
Issue: #309 Quantization warning for Qwen3.6

Header
  state badge | issue state badge | title | number
  author | created time | updated time
  Open on GitCode | Refresh

Main Content
  Description
    rendered markdown body

Sidebar
  Assignees
  Labels
  Milestone
  Type
  Priority
  Workflow state
  Comments
  Created / Updated / Finished time
  Repository
```

Recommended behavior:

- Use a webview page, not tree child expansion, because the issue body is
  markdown-rich and can be long.
- Keep the tree node label compact and use the detail page for full metadata.
- Open external links in the browser only after validating that they target the
  same GitCode origin as the repository URL.
- If the body is empty, show `No description provided`.
- If arrays such as labels or assignees are empty, show `None`.
- If optional fields such as milestone or finished time are absent, show `None`.
- Keep the page read-only for the first version.

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/:repo/issues/:number
```

The service call should be:

```ts
issueService.getIssue(repository, issueNumber);
```

`GitCodeClient` remains responsible for authentication, base URL handling, and
request errors. The view layer must not append `access_token` or construct raw
API URLs.

The response should be mapped to a new `IssueDetail` model.

Minimum fields needed by the page:

- `id`
- `number`
- `title`
- `state`
- `body`
- `author`
- `assignees`
- `labels`
- `comments`
- `createdAt`
- `updatedAt`
- `finishedAt`
- `url`
- `repository`
- `issueState`
- `issueStateDetail`
- `issueType`
- `issueTypeDetail`
- `priority`
- `priorityDetail`
- `milestone`
- `visibilityReason`

## Domain Model

Add a detail model instead of expanding `IssueSummary` with optional fields for
everything. `IssueSummary` should stay optimized for tree rendering.

Suggested types:

```ts
export interface IssueWorkflowState {
  id?: number;
  title: string;
  serial?: number;
}

export interface IssueTypeDetail {
  id?: number;
  title: string;
  isSystem?: boolean;
}

export interface IssuePriorityDetail {
  id?: number;
  title: string;
}

export interface IssueRepositoryRef {
  id?: number;
  fullName: string;
  name?: string;
  path?: string;
  description?: string;
  url?: string;
}

export interface IssueDetail {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  body: string;
  author: IssueUser;
  assignees: IssueUser[];
  labels: IssueLabel[];
  comments: number;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  url?: string;
  repository: IssueRepositoryRef;
  issueState?: string;
  issueStateDetail?: IssueWorkflowState;
  issueType?: string;
  issueTypeDetail?: IssueTypeDetail;
  priority?: number;
  priorityDetail?: IssuePriorityDetail;
  milestone?: IssueMilestone;
  visibilityReason?: string;
}
```

Reuse the existing `IssueUser`, `IssueLabel`, and `IssueMilestone` types from
`src/common/models.ts`.

### Mapping Rules

- Normalize `number` with `Number(dto.number ?? dto.iid ?? dto.id ?? 0)`.
- Normalize `state` to `'closed'` only when the raw state is exactly `closed`;
  otherwise use `'open'`.
- Map `user` to `author`; tolerate `author` as a fallback.
- Prefer `assignees`; fall back to a single `assignee` when the array is absent.
- Normalize empty strings from `finished_at`, `created_at`, and `updated_at` to
  `undefined` only for optional fields. Required date fields can remain empty
  strings if the API omits them.
- Prefer `html_url` for the user-facing URL; fall back to `web_url` or `url`.
- Preserve both the short fields (`issue_state`, `issue_type`, `priority`) and
  their detail objects when provided.
- Map missing arrays to empty arrays and missing numeric values to `0`.
- Do not pass raw nested DTOs into the webview.

## Architecture

Follow the same dependency direction as the pull request overview:

```text
Issue tree node command
  -> IssueOverviewPanel
  -> IssueOverviewStore
  -> IssueService
  -> GitCodeClient
  -> issueDetailMapper
  -> Issue overview HTML renderer
```

Dependency rules:

- `view` may depend on `common`, `authentication`, and `gitcode/services`.
- `view` must not depend on raw GitCode issue DTOs.
- `gitcode` must not depend on `view`.
- The overview panel consumes `IssueDetail`, not `any`.
- The issue detail store should be separate from `IssueTreeStore`; the tree
  cache and detail cache have different lifetimes and payload sizes.
- Shared rendering helpers should stay generic. Do not import pull-request-only
  detail types into issue rendering.

## Proposed Files

Create:

```text
src/gitcode/mappers/issueDetailMapper.ts
src/view/issueOverview/issueOverviewStore.ts
src/view/issueOverview/issueOverviewPanel.ts
src/view/issueOverview/issueOverviewHtml.ts
```

Update existing files:

```text
src/common/models.ts
src/common/constants.ts
src/gitcode/services/issueService.ts
src/view/commands/registerIssueCommands.ts
src/view/tree/nodes/issueNode.ts
src/view/viewController.ts
package.json
```

The implementation may later merge PR and issue overview HTML helpers if a
clean shared abstraction emerges, but the first version should keep issue
overview files explicit. This avoids coupling issue metadata to pull request
metadata such as branches and mergeability.

## Command Design

### `gitcode.openIssue`

Change behavior from "open browser directly" to "open issue overview page".

Input:

```ts
export interface IssueNodeContext {
  repository: GitCodeRepository;
  issue: IssueSummary;
}
```

Behavior:

1. Resolve the context from either an `IssueNodeContext` or an `IssueNode`.
2. Call:

   ```ts
   IssueOverviewPanel.createOrShow(
     {
       repository: context.repository,
       issueNumber: context.issue.number,
       url: context.issue.url,
     },
     issueOverviewStore,
     logger,
   );
   ```

3. The panel fetches fresh detail from the get-issue endpoint through the store.

### `gitcode.openIssueOnWeb`

Keep this command as the explicit browser action. Use the detail URL when a
panel is active; otherwise use the tree summary URL:

```text
issue.url ?? `${repository.webUrl}/issues/${issue.number}`
```

### `gitcode.refreshIssue`

Add an active-panel refresh command for the issue detail page. This should
invalidate only the active issue detail cache entry.

The existing `gitcode.refreshIssues` command should continue to refresh the
Issues tree list and should not automatically reload every open issue detail
panel.

## Store Design

`IssueOverviewStore` owns detail caching:

```ts
export class IssueOverviewStore {
  private readonly detailPromises = new Map<string, Promise<IssueDetail>>();

  async getDetail(repository: GitCodeRepository, issueNumber: number): Promise<IssueDetail>;
  async refresh(repository: GitCodeRepository, issueNumber: number): Promise<void>;
}
```

Rules:

- Check `AuthService.getSession()` before calling the service.
- Use cache key `${repository.fullName}#${issueNumber}`.
- Share concurrent requests for the same issue.
- Remove a failed request from the cache so retry works.
- Fire a lightweight change event after refresh for future consumers.

## Panel Design

`IssueOverviewPanel` should mirror the proven PR overview panel lifecycle:

- static `panels: Map<string, IssueOverviewPanel>` keyed by
  `${repository.fullName}#${issueNumber}`
- static `activePanel` for refresh and open-on-web commands
- `createOrShow()` reveals an existing panel or creates a new one
- initial loading HTML before the API call
- detail HTML after a successful response
- targeted error HTML for unauthenticated, unauthorized, and generic failures
- `onDidReceiveMessage` handlers for `refresh`, `openOnWeb`, and trusted
  `openUrl`
- dispose cleanup that removes the panel from the static map

The panel title should be compact:

```text
Issue #309
```

After detail loads, it may be updated to:

```text
#309 Quantization warning...
```

Use truncation so tab titles remain readable.

## HTML Rendering

Use the same security posture as the PR overview:

- render markdown through `src/view/webview/markdown.ts`
- escape all non-markdown text before injecting it into HTML
- never inject API-provided HTML directly
- use a per-render nonce for scripts
- only post messages with small command payloads
- validate URLs before opening them externally

Suggested sections:

```text
Header
Description
Details sidebar
```

Badges:

- `Open` / `Closed` from `state`
- workflow state such as `TODO` from `issueState`
- type such as `Bug-Report` from `issueType`

Sidebar field order:

1. Assignees
2. Labels
3. Milestone
4. Type
5. Priority
6. Workflow state
7. Comments
8. Dates
9. Repository

## Error and Empty States

Use explicit page states:

- loading: `Loading issue` / `Fetching issue details from GitCode.`
- unauthenticated: `Sign in to GitCode`
- unauthorized: `Your GitCode session is not authorized to read this issue.`
- not found or repository mismatch: `Unable to load issue`
- empty body: `No description provided.`
- empty metadata arrays: `None`

The tree should remain usable when a detail page fails to load.

## Testing

Add focused unit tests:

- `issueDetailMapper.test.ts`
  - maps the sample response from [api.md](api.md)
  - normalizes string issue numbers to numbers
  - maps `assignee` and `assignees`
  - maps labels, milestone, state detail, type detail, and priority detail
  - converts empty `finished_at` to `undefined`
- `issueOverviewStore.test.ts`
  - requires authentication
  - shares concurrent requests
  - clears failed promises
  - invalidates one issue on refresh
- `issueOverviewHtml.test.ts`
  - escapes title and metadata
  - renders markdown body through the sanitized markdown renderer
  - renders empty body and empty sidebar states
  - includes refresh and open-on-web actions
- command tests for `gitcode.openIssue`
  - resolves an `IssueNodeContext`
  - opens the issue overview instead of directly opening the browser

Manual verification:

1. Open the Issues tree.
2. Select an issue.
3. Confirm a webview opens with full issue detail.
4. Refresh the issue detail page.
5. Open the issue on GitCode.
6. Confirm `gitcode.openIssueOnWeb` still opens the browser from the tree
   context menu.

## Future Extensions

This design leaves room for:

- issue comments once a list-comments-for-issue API exists
- edit title/body/state actions
- assign, label, milestone, type, and priority actions
- configurable issue queries that open the same detail page
- branch-from-issue workflow
- project or kanban state rendering if GitCode exposes richer issue workflow APIs
