# List Pull Request Files Tree View Design

## Goal

Display the files changed by a GitCode pull request in the existing `pr:gitcode` sidebar tree.

The feature must:

- call the list pull request files API documented in [api.md](api.md)
- load files only when the pull request's `Files` node is expanded
- support directory and flat file layouts
- show file status and line statistics
- open the API-provided unified patch in a read-only VS Code editor
- keep API DTOs and HTTP access outside the view layer
- preserve the existing pull request overview command on the PR node

The implementation should reuse the useful interaction patterns from
`vscode-pull-request-github/src/view` without copying GitHub-specific review-mode,
checkout, viewed-state, or comment-controller behavior.

## Scope

### In Scope

- Add a `Files` child section to every pull request node.
- Fetch changed files for one repository and pull request number.
- Map the GitCode response to a typed domain model.
- Cache changed files per pull request and share concurrent requests.
- Render files as a compact directory tree by default.
- Allow users to switch between tree and flat layouts.
- Show added, modified, deleted, and renamed file states.
- Show additions and deletions in labels, descriptions, and tooltips.
- Open available patch text in a virtual read-only document.
- Open the file on GitCode when no patch can be displayed.
- Refresh one pull request's file cache independently.

### Out of Scope

- Checking out a pull request branch.
- A separate active-review tree such as GitHub's `prStatus:github` view.
- Full two-sided `vscode.diff` editors.
- Reconstructing complete files from partial unified patches.
- File viewed/unviewed checkboxes.
- Inline review comments and commenting ranges.
- Binary or image diff rendering.
- Fetching commits or review threads.

## Reference Design

The relevant GitHub extension concepts are:

- `prChangesTreeDataProvider.ts` for a thin VS Code tree provider
- `treeNodes/pullRequestNode.ts` for lazy file loading
- `treeNodes/filesCategoryNode.ts` for a files section
- `treeNodes/directoryTreeNode.ts` for path grouping and directory compaction
- `treeNodes/fileChangeNode.ts` for file status, commands, and tooltips
- `inMemPRContentProvider.ts` for read-only virtual content

GitCode should adopt the provider/node separation, lazy loading, compact directory
tree, and virtual document concepts. It should not adopt the GitHub extension's
repository manager graph or review-mode lifecycle because this feature works for
any listed remote pull request and does not require a local checkout.

## User Experience

The existing pull request tree becomes expandable:

```text
Pull Requests
  owner/repo (origin)
    All Open
      #597 Add Step3.5 loader
        Files (2)  +8 -1
          config
            config.ini  M  +1 -1
          msmodelslim/model/step3_5_flash
            loader.py  A  +7
```

Single-child directory chains are compacted:

```text
msmodelslim/model/step3_5_flash
  loader.py  A  +7
```

In flat layout, the same files are direct children of `Files`:

```text
Files (2)  +8 -1
  config/config.ini  M  +1 -1
  msmodelslim/model/step3_5_flash/loader.py  A  +7
```

Interaction rules:

- Selecting the PR label continues to open the PR overview page.
- Expanding the PR reveals the `Files` section without making an API request.
- Expanding `Files` fetches changed files on demand.
- Selecting a file opens its unified patch in a read-only editor when `patch.diff`
  is available.
- If the patch is absent or marked `too_large`, selecting the file opens
  `blob_url` in the browser.
- A context action always allows `Open File on GitCode` when a usable URL exists.
- Refreshing the `Files` node invalidates and reloads only that PR's files.

## Tree Shape Decision

Use the existing `pr:gitcode` view instead of adding a second sidebar view.

Reasons:

- Files are available for every listed remote PR, not only a checked-out PR.
- The repository, category, and PR context already exist in the current tree.
- A second view would need active-PR selection and lifecycle state that this API
  does not provide.
- A `Files` section leaves room for later `Commits` and `Conversation` siblings.

The tree hierarchy is:

```text
RepositoryNode
  PullRequestCategoryNode
    PullRequestNode
      PullRequestFilesNode
        DirectoryNode | PullRequestFileNode
```

## API Contract

Use the endpoint from [api.md](api.md):

```text
GET /api/v5/repos/:owner/:repo/pulls/:pull_number/files
```

The service surface should be:

```ts
pullRequestService.listPullRequestFiles(repository, pullRequestNumber);
```

`GitCodeClient` remains responsible for authentication, base URL handling, and
request errors. The view layer must not append `access_token` or construct the API
URL.

Fields consumed from each response item:

- `sha`
- `filename`
- `status`
- `additions`
- `deletions`
- `blob_id`
- `blob_url`
- `raw_url`
- `patch.diff`
- `patch.old_path`
- `patch.new_path`
- `patch.new_file`
- `patch.renamed_file`
- `patch.deleted_file`
- `patch.too_large`
- `source_branch`
- `target_branch`
- `source_project.full_name`
- `target_project.full_name`

## Domain Model

Add a view-independent file change model to `src/common/models.ts`:

```ts
export type PullRequestFileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed';

export interface PullRequestFileChange {
  sha: string;
  path: string;
  previousPath?: string;
  status: PullRequestFileStatus;
  additions: number;
  deletions: number;
  blobId?: string;
  blobUrl?: string;
  rawUrl?: string;
  patch?: string;
  tooLarge: boolean;
  sourceBranch?: string;
  targetBranch?: string;
  sourceRepository?: string;
  targetRepository?: string;
}
```

Keep the model independent of `vscode.Uri` and tree nodes so it can later be
shared by an overview page or a full diff controller.

### Mapping Rules

Resolve the path as:

```text
patch.new_path -> filename -> patch.old_path
```

Resolve `previousPath` only for renamed files from `patch.old_path`.

Resolve status in this order:

1. `patch.deleted_file === true` -> `deleted`
2. `patch.renamed_file === true` -> `renamed`
3. `patch.new_file === true` -> `added`
4. recognized response `status` -> normalized status
5. otherwise -> `modified`

Normalize missing numeric values to `0`, empty URLs to `undefined`, and empty
patch strings to `undefined`. Preserve `too_large` even when a patch string is
unexpectedly present so the UI does not attempt to render an unreliable patch.

## Architecture

Use this flow:

```text
PullRequestNode
  -> PullRequestFilesNode
  -> PullRequestTreeStore
  -> PullRequestService
  -> GitCodeClient
  -> pullRequestFileMapper
  -> DirectoryNode / PullRequestFileNode
  -> PullRequestPatchContentProvider
```

Dependency rules:

- `view` consumes `PullRequestFileChange`, never raw GitCode responses.
- `gitcode/services` owns endpoint construction.
- `gitcode/mappers` owns response normalization.
- the store owns caching and invalidation.
- nodes own labels, icons, tooltips, context values, and child construction.
- the content provider only serves already-loaded domain data; it does not call
  the API.

## Proposed Files

Create:

```text
src/gitcode/mappers/pullRequestFileMapper.ts
src/view/tree/nodes/pullRequestFilesNode.ts
src/view/tree/nodes/directoryNode.ts
src/view/tree/nodes/pullRequestFileNode.ts
src/view/diff/pullRequestPatchContentProvider.ts
```

Update:

```text
src/common/configuration.ts
src/common/constants.ts
src/common/models.ts
src/gitcode/services/pullRequestService.ts
src/view/commands/registerTreeCommands.ts
src/view/state/pullRequestTreeStore.ts
src/view/tree/nodes/pullRequestNode.ts
src/view/viewController.ts
package.json
```

## Store Design

Extend `PullRequestTreeStore` with:

```ts
getPullRequestFiles(
  repository: GitCodeRepository,
  pullRequestNumber: number,
): Promise<PullRequestFileChange[]>;

refreshPullRequestFiles(
  repositoryKey: string,
  pullRequestNumber: number,
): Promise<void>;
```

Cache key:

```text
${repository.fullName}#${pullRequestNumber}:files
```

Cache behavior:

- Load only when `PullRequestFilesNode.getChildren()` runs.
- Share one in-flight promise for concurrent requests with the same key.
- Cache successful arrays, including an empty array.
- Do not cache failed requests as successful results.
- `refreshPullRequestFiles()` clears only one files entry and emits a targeted
  refresh event.
- `refreshRepository()` clears all PR lists and file entries for that repository.
- `refreshAll()` clears every repository, PR list, and file entry.

Extend `TreeRefreshTarget` with:

```ts
| {
    type: 'pullRequestFiles';
    repositoryKey: string;
    pullRequestNumber: number;
  }
```

The provider may initially translate all store events to a full tree refresh. A
later optimization can retain a node index and fire only the matching
`PullRequestFilesNode`; the store event should be precise from the start.

## Node Design

### Pull Request Node

Change `PullRequestNode` to
`vscode.TreeItemCollapsibleState.Collapsed` and return one child:

```text
Files
```

The node keeps its current `gitcode.openPullRequest` command. VS Code's disclosure
arrow expands the node while selecting the label opens the overview page.

### Files Node

Stable ID:

```text
pullRequestFiles:${repository.fullName}:${pullRequestNumber}
```

Context value:

```text
pullRequestFiles
```

Initial label:

```text
Files
```

After loading:

```text
Files (2)
```

Description:

```text
+8 -1
```

The node starts collapsed. Its first expansion calls the store. An empty response
returns an `EmptyStateNode` labeled `No changed files`. API failures return a
non-collapsible error node and log the underlying error.

### Directory Node

Directory nodes:

- use `ThemeIcon.Folder`
- start expanded for the first rendered level and collapsed below it
- sort before files, case-insensitively
- merge chains containing only one directory child
- maintain correct `parent` references after compaction
- have stable IDs based on repository, PR number, and full directory path

Example compaction:

```text
a
  b
    c
      file.ts
```

becomes:

```text
a/b/c
  file.ts
```

### File Node

Tree layout label:

```text
loader.py
```

Flat layout label:

```text
msmodelslim/model/step3_5_flash/loader.py
```

Description examples:

```text
M  +1 -1
A  +7
D  -12
R  old/path.ts -> new/path.ts  +2 -2
```

Context values:

```text
pullRequestFile:added
pullRequestFile:modified
pullRequestFile:deleted
pullRequestFile:renamed
pullRequestFile:tooLarge
```

Use VS Code file icons by assigning a synthetic `resourceUri` whose path matches
the changed file. Do not use the real workspace URI because a remote PR file may
not match the local checkout. Add a status-colored `ThemeIcon` only if file icon
resolution is unavailable.

Tooltip content:

- full current path
- previous path for renames
- status
- additions and deletions
- source and target branches
- `Patch unavailable: file is too large` when applicable

## Directory Tree Algorithm

Build the directory structure from normalized `/`-separated repository paths,
independent of the operating system path separator.

Algorithm:

1. Split each file path on `/` and discard empty segments.
2. Insert directory segments into an internal trie.
3. Attach the file at the final segment.
4. Recursively compact a directory that has exactly one directory child and no
   direct file child.
5. Sort directories first and files second using case-insensitive labels.
6. Convert the internal structure to nodes and set rendered parent references.

Do not mutate file node parents while building both layouts. Construct the nodes
for the selected layout so `getParent()` always matches what VS Code renders.

## Patch Editor Design

Register a `vscode.TextDocumentContentProvider` for:

```text
gitcode-pr-diff:
```

Suggested URI:

```text
gitcode-pr-diff://owner/repo/597/config/config.ini?sha=<sha>
```

The command `gitcode.openPullRequestFile` receives a typed node context containing
the repository, PR number, and `PullRequestFileChange`. It registers the loaded
patch in the content provider, opens the URI with `vscode.open`, and sets the
document language to `diff`.

Document title:

```text
config.ini (Pull Request #597)
```

The provider should key content by repository, PR number, file path, and SHA. This
prevents collisions when users open the same path from multiple PRs.

### Why Not `vscode.diff` in This Phase

The files endpoint provides a unified patch and a head `raw_url`, but it does not
guarantee complete base and head document contents. A unified patch can omit most
unchanged lines, so reconstructing full files from it would produce incorrect
documents.

The first implementation therefore opens the patch as a `diff` language document.
A later true side-by-side diff can be added after a documented content endpoint
can fetch:

- the old path at the target SHA
- the new path at the source SHA
- binary content metadata

## Commands and Menus

Add commands:

```text
gitcode.openPullRequestFile
gitcode.openPullRequestFileOnWeb
gitcode.refreshPullRequestFiles
gitcode.setPullRequestFilesLayoutTree
gitcode.setPullRequestFilesLayoutFlat
```

Menu placement:

- File click: `gitcode.openPullRequestFile`.
- File inline action: `Open File on GitCode` when `blobUrl` exists.
- File context menu: both open commands where applicable.
- Files node context menu: `Refresh Files`.
- View title menu: tree/flat layout toggle when `view == pr:gitcode`.

Command payload:

```ts
export interface PullRequestFileNodeContext {
  repository: GitCodeRepository;
  pullRequestNumber: number;
  file: PullRequestFileChange;
}
```

Commands must consume this payload directly and must not search the tree to
recover repository or PR identity.

## Configuration

Add:

```json
{
  "gitcode.pullRequests.fileListLayout": {
    "type": "string",
    "enum": ["tree", "flat"],
    "default": "tree",
    "description": "Controls whether pull request files are shown as directories or a flat list."
  }
}
```

Set a VS Code context key when configuration changes:

```text
gitcodePullRequestFilesLayout == tree | flat
```

Changing the setting refreshes only the rendered tree. It must not clear or
refetch the files cache.

## Loading and Error States

Recommended node states:

| Condition | Display |
| --- | --- |
| Loading | VS Code tree progress for `pr:gitcode` |
| Empty response | `No changed files` |
| 401/403 | `GitCode authentication failed` |
| 404 | `Pull request or repository not found` |
| Other API error | `Unable to load changed files` |
| Missing patch | Open on GitCode when possible |
| `too_large` | `Patch unavailable: file is too large` |

Use `vscode.window.withProgress({ location: { viewId: 'pr:gitcode' } })` around an
explicit refresh command. Routine expansion failures should render as tree state
and be written to the extension logger instead of showing repeated notifications.

## Security and Reliability

- Never put access tokens in virtual document URIs, logs, tooltips, or commands.
- Treat `blob_url` and `raw_url` as untrusted API data and allow only `https:` URLs
  before opening them.
- Encode every URI path and query component.
- Do not render patch text as Markdown or HTML.
- Limit retained patch entries to the same lifecycle as the file cache.
- Dispose the content provider and configuration listeners in `ViewController`.

## Implementation Steps

1. Add `PullRequestFileChange` and status types.
2. Add and unit-test `mapPullRequestFile` mapping rules.
3. Add `PullRequestService.listPullRequestFiles()`.
4. Extend `PullRequestTreeStore` with per-PR file caching and invalidation.
5. Make `PullRequestNode` collapsible and add `PullRequestFilesNode`.
6. Implement directory and file nodes with tree/flat layouts.
7. Add the patch content provider and file open commands.
8. Add layout configuration, context keys, and menu contributions.
9. Register and dispose new components in `ViewController`.

## Test Plan

Unit tests:

- map modified files when `status` is absent
- give patch flags precedence over the top-level status
- map added, deleted, and renamed paths correctly
- normalize missing counts, URLs, and patch text
- share concurrent file-list requests for one PR
- isolate caches for different repositories and PR numbers
- targeted refresh clears only one files cache
- directory builder compacts single-child paths
- directory builder sorts directories before files
- flat layout uses full paths and correct parent nodes
- file command payload includes repository, PR number, and file model
- unsafe file URLs are rejected

Manual verification:

1. Sign in and expand a repository and `All Open` category.
2. Expand a PR and confirm no files request occurs until `Files` is expanded.
3. Expand `Files` and compare paths and line counts with GitCode.
4. Open modified, added, deleted, and renamed patches.
5. Confirm a too-large or patchless file falls back to GitCode.
6. Switch between tree and flat layouts without another API request.
7. Refresh one `Files` node and confirm other expanded PR caches remain intact.
8. Refresh the whole pull request view and confirm all file caches reload lazily.

## Future Extension

When complete base and head content APIs are available, add a content resolver that
produces two virtual URIs and opens:

```ts
vscode.commands.executeCommand(
  'vscode.diff',
  baseUri,
  headUri,
  `${fileName} (Pull Request #${pullRequestNumber})`,
);
```

That resolver can reuse `PullRequestFileChange` and the existing file nodes without
changing the tree structure.
