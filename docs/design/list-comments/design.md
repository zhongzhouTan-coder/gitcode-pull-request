# Pull Request Comments Display Design

## Recommendation

Use one normalized comments store with two presentation adapters:

1. Render `pr_comment` and `diff_comment` in a `Conversation` section on the
   pull request overview page.
2. Also project locatable `diff_comment` threads into VS Code's native Comments
   API when a pull request diff document is opened.

This follows the useful separation in `vscode-pull-request-github/src/view`:

- the pull request model owns normalized comment and review-thread state
- the overview projects that state into a conversation timeline
- a comment controller projects review threads into open diff editors
- editor comment threads are disposable view objects, not the source of truth

GitCode should adopt that separation without copying GitHub-specific checkout,
pending-review, reaction, suggestion, or GraphQL review behavior.

## Goals

- Display every comment returned by the [list comments API](api.md).
- Preserve the distinction between PR-level comments and code review threads.
- Display replies as part of their parent discussion.
- Display resolved state for diff discussions.
- Show diff comments inline in the native diff editor when their file and side
  can be identified.
- Share a single request and cache between the overview and diff editor.
- Keep API DTOs, mapping, state, and rendering in separate layers.
- Leave a clear path for later reply and resolve actions without requiring those
  actions in the first read-only version.

## Scope

### In Scope

- Fetch comments for one pull request on demand.
- Normalize `pr_comment` and `diff_comment` into discriminated domain models.
- Group a diff comment and its `reply` array into one discussion thread.
- Add a conversation timeline to the existing pull request overview.
- Render author, avatar, timestamp, markdown body, comment kind, location, reply
  count, and resolved state where available.
- Create read-only native `vscode.CommentThread` instances for locatable diff
  comments.
- Refresh comment state from the overview and existing PR refresh commands.
- Dispose inline comment threads when their PR editors and overview are closed.

### Out of Scope

- Creating, editing, or deleting comments.
- Replying to a discussion.
- Resolving or reopening a discussion.
- Reactions and review submission state.
- Suggested-change application.
- Polling or push updates.
- Guessing a file path from comment text or URLs.
- Opening historical diff snapshots for outdated comments.

## API Composition and Remaining Constraints

The captured API response distinguishes comments with `comment_type` and gives
diff comments new-file line positions:

```json
{
  "comment_type": "diff_comment",
  "discussion_id": "9035cc...",
  "resolved": true,
  "diff_position": {
    "start_new_line": 13,
    "end_new_line": 13,
    "position_type": "text"
  }
}
```

The list response in `api.md` does not provide the changed file path, diff side,
or commit SHA. A line number alone cannot identify an editor location because
many changed files can contain line 13.

The [get-comment endpoint](get-comment-api.md) supplies the missing identity for
one comment:

```json
{
  "id": 176157991,
  "comment_type": "DiffNote",
  "is_outdated": false,
  "position": {
    "base_sha": "9c64e8d...",
    "start_sha": "4a77d9d...",
    "head_sha": "50f2a19...",
    "old_path": "lab_practice/glm_5/config.yaml",
    "new_path": "lab_practice/glm_5/config.yaml",
    "position_type": "text",
    "new_line": 35
  }
}
```

Together, the two endpoints are sufficient for current, new-side, single-line
inline comments:

| Required data | Source |
| --- | --- |
| Timeline body, author, dates, replies, resolved state | list comments |
| File identity (`new_path`, `old_path`) | get comment |
| Current line (`new_line`) | get comment |
| Optional multiline range (`start_new_line`, `end_new_line`) | list comments |
| Snapshot identity and outdated state | get comment |

Join the responses by comment `id`, not `discussion_id`. Normalize
`comment_type: "diff_comment"` from the list response and
`comment_type: "DiffNote"` from the detail response to the same domain kind.

The get-comment sample does not establish old-side fields such as `old_line`,
`start_old_line`, and `end_old_line`. Therefore, the initial inline
implementation supports only head-side comments. If multiline fields from the
list response are present, use them only when they contain the detail
response's `new_line`; otherwise treat the location as single-line and log the
inconsistent payload.

Do not infer paths from reply body URLs. The detail endpoint is authoritative
for paths and snapshot refs.

If detail enrichment fails, the comment remains visible in the overview with
its list-provided line range. It is not bound inline because its file is
unknown.

## User Experience

### Pull Request Overview

Add `Conversation` after the description in the main column:

```text
Conversation (10)

  @ascend-robot                                      Jun 17, 16:13
  Thanks for your pull request ...

  Code comment · lab_practice/glm_5/config.yaml · line 13   Resolved
  @yejiajun                                          Jun 17, 19:12
  Suggest changing this to True ...
    @qq_46439621                                     Jun 17, 19:15
    changed this line on 50f2a196 ...
```

Rules:

- Sort top-level discussions by `createdAt`, oldest first.
- Keep API reply order; if not guaranteed, sort replies by `createdAt`.
- Render `pr_comment` as a normal timeline card.
- Render `diff_comment` as a code-comment card with location and state badges.
- Keep replies visually nested under the parent, but use a shallow layout so
  long discussions remain readable.
- Render bodies through the existing sanitized markdown pipeline.
- Never inject the API's HTML directly. Some captured comments contain raw HTML.
- Show `No comments yet` for an empty response.
- Show comment loading errors within the Conversation section; the PR header and
  description must continue to render.

### Native Diff Editor

When a `gitcode-pr` base or head document is opened:

- parse the repository, pull request number, side, SHA, and path from its URI
- request the normalized comment snapshot from the shared store
- select diff threads matching the document path and side
- convert one-based API lines to zero-based `vscode.Range` values
- clamp or reject invalid ranges after the document has loaded
- create one `vscode.CommentThread` per `discussionId`
- put the parent comment and replies in that thread
- map `resolved` to `vscode.CommentThreadState.Resolved`
- keep threads read-only in the first version

For the current API sample, only new-file positions exist, so the side is
`head`. Bind the thread only when the detail response's `head_sha` matches the
open PR diff snapshot. Keep `is_outdated: true` comments in the overview, but do
not bind them to the current editor. Historical diff display is a separate
feature.

## Architecture

```text
GitCode list-comments endpoint
          |
          +-- per diff comment --> get-comment endpoint
          |                              |
          +------------------------------+
                         |
                         v
CommentService -> commentMapper -> PullRequestCommentsStore
                                      |             |
                         snapshot/change event      |
                                      |             |
                                      v             v
                         Overview Conversation   DiffCommentController
                              (webview DTOs)       (VS Code Comments API)
```

The store is the source of truth. The overview and native comment controller are
independent projections and must not own separate API caches.

### Proposed Files

```text
src/
  common/
    models.ts                         # comment domain types
  gitcode/
    services/commentService.ts        # endpoint access
    mappers/commentMapper.ts           # DTO validation and normalization
  view/
    state/pullRequestCommentsStore.ts  # cache, refresh, change events
    overview/
      overviewHtml.ts                 # conversation markup
      pullRequestOverviewPanel.ts      # loads detail + comments independently
    comments/
      diffCommentController.ts         # editor lifecycle/orchestration
      commentThreadFactory.ts           # domain -> vscode comment objects
```

`ViewController` constructs one `PullRequestCommentsStore`, gives it to the
overview panel and diff comment controller, and disposes the controller with the
rest of the view infrastructure.

## Domain Model

Use a discriminated union. Do not make all diff fields optional on one flat
comment type.

```ts
export interface PullRequestCommentAuthor {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
  htmlUrl?: string;
}

export interface PullRequestCommentReply {
  id: string;
  body: string;
  author: PullRequestCommentAuthor;
  createdAt: string;
  updatedAt: string;
}

interface PullRequestCommentBase {
  id: string;
  discussionId: string;
  body: string;
  author: PullRequestCommentAuthor;
  createdAt: string;
  updatedAt: string;
  replies: PullRequestCommentReply[];
}

export interface PullRequestGeneralComment extends PullRequestCommentBase {
  kind: 'pullRequest';
}

export interface PullRequestDiffComment extends PullRequestCommentBase {
  kind: 'diff';
  resolved: boolean;
  isOutdated: boolean;
  location: PullRequestDiffCommentLocation;
}

export interface PullRequestDiffCommentLocation {
  path?: string;
  previousPath?: string;
  side: 'base' | 'head';
  startLine: number;
  endLine: number;
  baseSha?: string;
  startSha?: string;
  headSha?: string;
  positionType: string;
}

export interface PullRequestDiffCommentDetail {
  id: string;
  discussionId: string;
  isOutdated: boolean;
  location: PullRequestDiffCommentLocation;
}

export type PullRequestComment =
  | PullRequestGeneralComment
  | PullRequestDiffComment;

export interface PullRequestCommentsSnapshot {
  repositoryKey: string;
  pullRequestNumber: number;
  comments: readonly PullRequestComment[];
  loadedAt: number;
}
```

`location.path` remains optional so a list result can be rendered when its
get-comment enrichment request fails. `DiffCommentController` requires `path`,
`headSha`, and a valid line before binding; the overview does not.

Use strings for IDs. GitCode currently returns numeric comment IDs and string
discussion IDs, but converting identifiers to strings prevents accidental
arithmetic and keeps thread keys uniform.

## Service and Mapper

`CommentService` owns the endpoint and returns domain data:

```ts
class CommentService {
  async listPullRequestComments(
    repository: GitCodeRepository,
    pullRequestNumber: number,
  ): Promise<PullRequestComment[]>;

  async getPullRequestComment(
    repository: GitCodeRepository,
    commentId: string,
  ): Promise<PullRequestDiffCommentDetail>;
}
```

The service calls both documented endpoints:

```text
GET /api/v5/repos/:owner/:repo/pulls/:pull_number/comments
GET /api/v5/repos/:owner/:repo/pulls/comments/:id
```

Loading is a list-and-enrich operation:

1. Fetch the list once.
2. Map and expose all `pr_comment` records without enrichment.
3. Fetch get-comment details for each `diff_comment` ID.
4. Limit detail request concurrency to avoid an unbounded N+1 request burst.
   Start with four concurrent requests.
5. Cache detail promises by repository and comment ID. Share them across the
   overview and diff controller.
6. Merge each successful detail into its list record by comment ID.
7. Keep a partially enriched diff comment when its detail request fails.

The detail endpoint does not include a pull request number, so the cache key
must still include `repository.fullName`; a numeric ID must not be treated as
globally unique across repositories.

The mapper must:

- explicitly normalize list `diff_comment` and detail `DiffNote`
- reject or skip records without an ID, discussion ID, body, author, or dates
- normalize a missing `reply` array to `[]`
- normalize and validate line numbers as positive integers
- ensure `startLine <= endLine`
- map `new_path`, `old_path`, all three SHAs, and `is_outdated`
- verify that detail `id` matches the requested/list comment ID before merging
- prefer the detail endpoint for path, snapshot refs, and the anchor line
- use the list endpoint for replies, resolved state, and an optional line range
- preserve unknown `position_type` values for diagnostics
- log and skip unknown comment types instead of treating them as PR comments
- avoid leaking raw access tokens through logs or model fields

A malformed individual record should not make the entire Conversation section
unavailable. Return valid records and log a bounded diagnostic for skipped
records.

## Store and Refresh Model

`PullRequestCommentsStore` follows the promise-cache pattern already used by
`PullRequestOverviewStore` and `PullRequestDiffStore`.

```ts
type CommentKey = `${string}#${number}`;

class PullRequestCommentsStore implements vscode.Disposable {
  readonly onDidChange: vscode.Event<CommentChangeEvent>;

  getOrFetch(
    repository: GitCodeRepository,
    pullRequestNumber: number,
  ): Promise<PullRequestCommentsSnapshot>;

  refresh(repositoryKey: string, pullRequestNumber: number): Promise<void>;
  invalidate(repositoryKey: string, pullRequestNumber: number): void;
  clear(): void;
}
```

Cache behavior:

- key by `repository.fullName` and pull request number
- share concurrent requests through a cached promise
- remove rejected promises so retry is possible
- keep successful snapshots until explicit refresh or auth/repository change
- emit a targeted change event after invalidation or replacement
- clear all snapshots when the authentication session changes

The existing overview refresh should invalidate both detail and comment stores,
then load them independently. A failed comments request must not discard a
successfully loaded PR detail.

## Overview Integration

Change `PullRequestOverviewPanel` to hold separate detail and comments state:

```ts
interface PullRequestOverviewData {
  detail: PullRequestDetail;
  comments: AsyncSection<PullRequestCommentsSnapshot>;
}

type AsyncSection<T> =
  | { state: 'loading' }
  | { state: 'ready'; value: T }
  | { state: 'error'; message: string };
```

The detail request remains required. Comments are an optional section request.
The panel can first render detail plus a loading Conversation section and then
rerender when comments finish. Preserve scroll position with
`webview.getState()`/`setState()` or send a typed update message rather than
replacing the whole document after initial render.

Keep a narrow webview boundary. Convert the domain snapshot to serializable view
data before rendering; do not expose services or DTOs to the webview script.

## Diff Comment Controller

The controller is intentionally smaller than the GitHub reference's
`PullRequestCommentController` and `ReviewCommentController`.

Responsibilities:

- own one `vscode.CommentController`
- watch opened and closed `gitcode-pr` diff documents/tabs
- parse documents with `parsePrUri`
- fetch the matching snapshot from `PullRequestCommentsStore`
- maintain a cache keyed by PR, path, side, and discussion ID
- update existing threads in place after refresh to avoid UI flicker
- dispose threads that disappear, move, or no longer match an open document
- dispose all resources when `ViewController` is disposed

It must not:

- call GitCode directly
- own canonical comments state
- open every changed file merely to create comment threads
- create a second thread when both sides of the same diff cause tab events
- assume that a line range is valid before the target document loads

Suggested cache key:

```text
owner/repo#prNumber:path:side:discussionId
```

Thread update algorithm:

1. Compute desired threads for the currently open PR documents.
2. Reuse existing threads with the same cache key.
3. Update range, comments, label, and resolved state in place.
4. Create missing threads.
5. Dispose existing threads absent from the desired set.

This mirrors the reference extension's stable cache/update behavior while
avoiding its GitHub-specific pending-comment machinery.

## Comment Rendering and Security

Both projections use the same plain-text/markdown source body, but different
renderers:

- overview: existing `renderMarkdown`, with raw HTML disabled or sanitized
- editor: `vscode.MarkdownString` with `isTrusted = false`

Additional rules:

- permit `https` links; reject executable and command URIs
- load avatars only over `https`, subject to the webview CSP
- provide author initials when an avatar is missing or fails
- use `updatedAt` to display an `edited` marker when it differs from `createdAt`
- do not parse reply text for location, identity, or permissions

## Loading and Failure Behavior

| Condition | Overview | Diff editor |
| --- | --- | --- |
| Loading | Conversation skeleton/status | No thread until ready |
| Empty | `No comments yet` | No threads |
| Unauthorized | Inline section error with sign-in guidance | Log once; no threads |
| List API failure | Retry action in Conversation | Keep existing snapshot threads if available |
| One detail API failure | Render the unenriched code comment | Do not bind that comment inline |
| Malformed record | Render remaining valid records | Skip invalid thread |
| Missing file path | Render code comment without file link | Do not bind inline |
| Invalid line or SHA mismatch | Render location text | Do not bind; provide web fallback |
| Outdated comment | Render with an `Outdated` badge | Do not bind to current diff |

## Testing Strategy

### Mapper Tests

- maps a `pr_comment`
- maps a list `diff_comment` with replies and resolved state
- maps a detail `DiffNote` with paths, refs, line, and outdated state
- joins list and detail records by comment ID
- preserves a list record when detail enrichment fails
- rejects a detail response whose ID differs from the requested comment ID
- normalizes missing replies
- distinguishes numeric comment IDs from discussion IDs
- rejects invalid or inconsistent line ranges and unknown comment types
- tolerates missing optional avatar and location fields

### Store Tests

- deduplicates concurrent requests
- limits concurrent get-comment enrichment requests
- caches comment details by repository and comment ID
- isolates cache entries by repository and pull request
- retries after a rejected request
- emits targeted invalidation events
- clears state on authentication change

### Overview Tests

- renders both comment kinds in chronological order
- nests replies under the correct discussion
- renders markdown without executing raw HTML or command links
- displays empty, loading, and error states without hiding PR detail
- displays resolved and location badges

### Controller Tests

- binds a head-side thread to the matching `gitcode-pr` URI
- binds only when the comment and open diff head SHAs match
- converts one-based lines to zero-based ranges
- ignores comments without a path or with an invalid range
- ignores outdated comments in the current diff
- does not bind a thread to another file with the same line number
- updates a thread in place after refresh
- removes disposed/stale threads when tabs close or snapshots change

## Delivery Plan

### Phase 1: Conversation

- add domain models, mapper, service, and shared store
- display both comment kinds and replies in the overview
- enrich diff comments with get-comment location data
- add independent loading/error handling and refresh
- tolerate partial detail-enrichment failures

### Phase 2: Inline Read-only Threads

- implement `DiffCommentController` and thread factory
- bind non-outdated, SHA-matching head-side comments to native diff documents
- add stable update and disposal behavior
- add base-side binding only after GitCode old-line fields are confirmed

### Phase 3: Mutations

Only after create/reply/resolve API contracts and permissions are documented:

- reply to a thread
- resolve and reopen a thread
- add PR-level comments
- apply optimistic updates followed by authoritative refresh

## Acceptance Criteria

- Opening a pull request overview displays all valid `pr_comment` and
  `diff_comment` list records, even if one get-comment enrichment request fails.
- Diff-comment detail requests are bounded, cached, and deduplicated.
- Replies are grouped under the correct `discussionId` and are not duplicated as
  top-level timeline entries.
- A comments API failure does not prevent PR detail from rendering.
- Refresh invalidates and reloads comments without duplicating cards or native
  comment threads.
- A locatable, non-outdated diff comment appears only on its matching file,
  side, and head SHA.
- An unlocatable diff comment remains visible in the overview and is never bound
  by line number alone.
- Comment bodies cannot execute API-provided HTML, scripts, command URIs, or
  trusted markdown commands.
