# Pull Request Diff View Design

## Recommendation

Use Option B as the primary implementation:

1. Keep the existing [list pull request files API](../list-pull-request-files/api.md)
   for the sidebar tree, file status, paths, statistics, and web fallbacks.
2. Use the [file-changes API](api.md) once per pull request to obtain the exact
   comparison refs: `diff_refs.base_sha` and `diff_refs.head_sha`.
3. Use the [raw file content API](file-content-api.md) to load the complete base
   and head files.
4. Pass both complete documents to VS Code's native `vscode.diff` editor. VS Code
   compares them and highlights the changed lines while still displaying the
   full file content.

This directly satisfies the requirement to display both complete files and the
changed lines. The unified patch remains useful for tree metadata, validation,
and fallback, but it is not used to construct the normal diff documents.

## Why Option B

The APIs provide different parts of the required result:

| Required data | Source |
| --- | --- |
| Changed-file tree and status | list-files API |
| Exact PR base and head commits | `files.json` `diff_refs` |
| Complete base document | raw content at `base_sha` and `old_path` |
| Complete head document | raw content at `head_sha` and `new_path` |
| Changed-line presentation | VS Code `vscode.diff` |

The list-files API already provides useful diff information:

- head SHA
- old and new paths
- added/deleted/renamed status
- additions and deletions
- unified patch hunks
- too-large state
- source and target repository identities

However, it does not provide the base SHA. The base cannot be fetched as an
immutable document using only the documented list-files and raw-content
contracts.

It is possible to reverse-apply `patch.diff` to the complete head file and
reconstruct a base document. That approach reduces requests, but it makes the
extension responsible for correctly handling patch completeness, multiple
hunks, line endings, final-newline markers, binary files, and malformed or
truncated responses. It is a reasonable fallback or optimization only after a
robust patch applicator exists; it should not be the primary source of the two
documents.

Fetching the target branch is not an acceptable replacement for `base_sha`.
The branch is mutable and its current tip may not be the merge base used by
GitCode for the pull request comparison.

## Goal

Replace the current unified-patch editor with the native VS Code diff experience
used by `vscode-pull-request-github/src/view`.

The implementation must:

- show the complete base and head files
- highlight added, removed, and modified lines
- compare the exact snapshot represented by the GitCode pull request
- work without checking out the pull request locally
- handle added, deleted, modified, and renamed files
- reuse the existing lazy file tree and list-files cache
- keep remote content read-only
- provide clear fallbacks for binary, oversized, or unavailable content

## Scope

### In Scope

- Open a native `vscode.diff` editor from a pull request file node.
- Load `diff_refs` lazily when the first file diff is opened.
- Load complete base and head content lazily through virtual documents.
- Use different paths for the two sides of a renamed file.
- Use an empty virtual document for the missing side of additions and deletions.
- Cache PR comparison refs and immutable file content.
- Preserve the existing patch editor and GitCode web actions as fallbacks.

### Out of Scope

- Checking out a pull request branch.
- Editing or applying changes from the diff editor.
- Inline review comments and commenting ranges.
- Viewed/unviewed state.
- Custom image or binary diff rendering.
- Reconstructing complete documents from partial patch hunks in the primary
  flow.

## Current Implementation

The current flow is:

```text
PullRequestFilesNode
  -> PullRequestTreeStore.getPullRequestFiles()
  -> PullRequestService.listPullRequestFiles()
  -> PullRequestFileChange[]
  -> PullRequestFileNode
  -> PullRequestPatchContentProvider
  -> unified patch editor
```

The list-files data is already mapped into `PullRequestFileChange` and cached by
`PullRequestTreeStore`. Keep this flow for tree expansion. Opening the tree must
not request `files.json` or raw content.

The new diff flow begins only when the user selects a file.

## Reference Design

Reuse these concepts from `vscode-pull-request-github/src/view`:

- `fileChangeModel.ts`: a file change resolves separate base and head URIs
- `treeNodes/fileChangeNode.ts`: a file node invokes `vscode.diff`
- `inMemPRContentProvider.ts`: virtual documents provide remote PR content
- `common/uri.ts`: URI parameters identify the PR, commit, path, and side

Do not copy GitHub-specific checkout, repository-manager, comment-controller,
or viewed-state behavior.

## API Plan

### 1. List Files for the Tree

```text
GET /api/v5/repos/:owner/:repo/pulls/:pull_number/files
```

Continue using this API for:

- file status
- old and new paths
- additions and deletions
- `too_large`
- patch and web fallback
- source and target repository identity
- the sidebar tree

No change is required to the existing lazy tree-loading behavior.

### 2. Resolve the Comparison Snapshot

```text
GET /api/v5/repos/:owner/:repo/pulls/:pull_number/files.json
```

Use this API for:

- `diff_refs.base_sha`
- `diff_refs.head_sha`
- `diff_refs.start_sha` for diagnostics and possible future review features
- optional file type information

Request it only when the first file diff for a PR is opened. Cache the response
by repository and pull request number. Concurrent opens share the same in-flight
request.

The paths and statuses from list-files remain authoritative for the view because
that response has explicit added/deleted/renamed and too-large fields. The
`files.json` entries can be used as a consistency check but do not replace the
existing file model.

### 3. Fetch Complete Documents

```text
GET https://raw.gitcode.com/:owner/:repo/raw/:sha/:path
```

For each supported file, request:

- left side: `base_sha` plus the old path
- right side: `head_sha` plus the new path

Return `Uint8Array` from the transport layer. Do not decode content in the API
client, because decoding can corrupt binary or non-UTF-8 data.

### 4. Render with VS Code

Invoke:

```ts
vscode.commands.executeCommand(
  'vscode.diff',
  baseUri,
  headUri,
  `${fileName} (Pull Request #${pullRequestNumber})`,
  { preview: true },
);
```

VS Code reads both virtual documents, displays their complete contents, computes
the line diff, and highlights changes. The extension does not need to render
patch lines itself.

## File Status Rules

| Status | Left side | Right side |
| --- | --- | --- |
| modified | raw `base_sha` at `old_path` | raw `head_sha` at `new_path` |
| renamed | raw `base_sha` at `old_path` | raw `head_sha` at `new_path` |
| added | empty document | raw `head_sha` at `new_path` |
| deleted | raw `base_sha` at `old_path` | empty document |

Rules:

- For a rename, the base URI uses the old filename and the head URI uses the new
  filename.
- Do not issue a raw request for an explicitly empty side.
- Treat a 404 as an empty document only when the list-files status explicitly
  says `added` or `deleted`. Other 404 responses are errors.
- Do not silently use the local working tree or current target branch.

## Domain Model

Keep `PullRequestFileChange` as the file input model. Add only the comparison
snapshot needed by the diff controller:

```ts
export interface PullRequestDiffRefs {
  baseSha: string;
  startSha?: string;
  headSha: string;
}

export interface PullRequestDiffSnapshot {
  refs: PullRequestDiffRefs;
  fileTypes: ReadonlyMap<string, string>;
}
```

The service surface should be:

```ts
pullRequestService.getPullRequestDiffSnapshot(repository, pullRequestNumber);
rawContentService.getFileContent(repository, sha, path);
```

Validate that base/head SHAs are non-empty commit identifiers. Normalize paths
at one boundary and reject absolute paths, `..` segments, and invalid encodings.

## Architecture

```text
PullRequestFileNode
  -> gitcode.openPullRequestFile
  -> PullRequestDiffController
       -> PullRequestDiffStore
            -> PullRequestService (files.json)
       -> GitCodePullRequestFileSystemProvider
            -> RawContentService (base/head bytes)
  -> vscode.diff(baseUri, headUri, title)
```

Responsibilities:

- `PullRequestFileNode` carries repository, PR number, and the existing
  `PullRequestFileChange`.
- `PullRequestDiffController` resolves refs and constructs both virtual URIs.
- `PullRequestDiffStore` shares and caches the `files.json` request.
- `PullRequestService` maps the response to `PullRequestDiffSnapshot`.
- `RawContentService` fetches immutable content and knows nothing about VS Code.
- `GitCodePullRequestFileSystemProvider` parses a URI and returns bytes.
- `PullRequestPatchContentProvider` remains available as a fallback.

Tree nodes and providers must not consume raw GitCode DTOs.

## Virtual Document URIs

Register a read-only `FileSystemProvider` so VS Code receives byte content and
the URI retains the real file extension for language detection.

Recommended identity:

```text
gitcode-pr://owner/repo/path/to/file.ts?
  {"pr":597,"side":"base","sha":"0844e...","path":"path/to/file.ts"}
```

Include:

- repository owner and name
- pull request number
- side: `base`, `head`, or `empty`
- commit SHA for non-empty sides
- repository-relative path

Do not include access tokens, authorization headers, raw URLs, patches, or file
content. Mutation methods throw `FileSystemError.NoPermissions`; register the
provider with `isReadonly: true`.

## Request Flow

When the user selects a file:

1. Reuse the `PullRequestFileChange` already loaded for the tree.
2. Reject an explicitly unsupported or too-large file before loading content.
3. Read the cached `PullRequestDiffSnapshot`, or request `files.json` once.
4. Verify that the selected file head SHA agrees with `diff_refs.head_sha`. If
   it does not, invalidate stale list data and ask the user to retry.
5. Construct base/head/empty URIs according to file status.
6. Execute `vscode.diff` immediately; VS Code requests each non-empty document
   lazily from the file-system provider.
7. Fetch base and head content independently, allowing concurrent requests.
8. If either document fails, show patch and web fallback actions.

## Caching and Refresh

Use two bounded caches:

- snapshot key: `owner/repo#pullRequestNumber`
- raw-content key: `repository@sha:path`

Store in-flight promises as well as successful values so concurrent editor reads
share requests. Do not cache failures.

Commit-addressed raw content is immutable and may remain cached for the extension
session within an entry-count or byte-size limit. The snapshot cache is
invalidated when the PR file list is refreshed.

`gitcode.refreshPullRequestFiles` must invalidate:

- the existing list-files cache
- the `files.json` snapshot for that PR
- content entries reachable only through the previous refs, when practical

Already-open SHA-addressed documents may remain valid as historical snapshots.
Newly opened diffs use the refreshed refs.

## HTTP, Authentication, and Security

Extend the client layer to support:

- JSON requests against the configured GitCode API base URL
- byte responses from the trusted GitCode raw origin
- private-repository authentication
- redirects only between trusted GitCode hosts
- cancellation, timeouts, and response-size limits

Construct raw URLs from validated repository identity, SHA, and percent-encoded
path segments, or validate an API-provided raw URL before using it. Never send an
authorization header to an arbitrary host.

Logs may include repository, PR number, SHA prefix, path, status code, and
duration. They must not include tokens, headers, URLs containing credentials, or
file content.

## Binary, Image, and Large Files

- Use `statistic.type` and `PullRequestFileChange.tooLarge` as early signals.
- Preserve bytes in the transport and provider layers.
- Confirm VS Code's behavior for supported image diffs in a focused spike.
- Enforce a response-size limit before buffering both documents.
- If either side is unsupported or exceeds the limit, use the GitCode web
  fallback rather than showing an empty or partial diff.

The initial release may support text files only. The architecture still keeps
raw content as bytes so supported binary/image handling can be added later.

## Error Handling

| Failure | Behavior |
| --- | --- |
| Authentication failure | Ask the user to sign in again |
| Missing/invalid diff refs | Report that GitCode returned no usable snapshot |
| List head SHA differs from `diff_refs.head_sha` | Refresh list data and retry |
| Raw 404 on an expected file | Show retry and web fallback |
| Rate limit/server failure | Show retry, patch, and web actions |
| Invalid URI/path | Reject before issuing a request |
| Binary/oversized unsupported | Open on GitCode |

Do not display one real side against a silently empty failed side. An empty side
is valid only for an explicit addition or deletion.

## Alternative: List Files + Patch Reconstruction

This remains a possible optimization:

```text
head = raw(listFile.sha, newPath)
base = reverseApply(head, listFile.patch)
verify apply(base, patch) == head
```

It can remove the `files.json` request and one raw request per modified file.
Before adopting it, the implementation must prove correct handling of complete
patches, multiple hunks, CRLF/LF, final-newline markers, additions, deletions,
renames, and malformed/truncated patches. Any failure must fall back to the
direct base/head plan or web view.

This optimization does not change the recommended primary data flow.

## Testing

### Mapper Tests

- maps all three diff refs
- rejects missing base/head refs
- maps file type by path
- handles missing optional fields
- detects malformed paths and SHAs

### URI and Provider Tests

- round-trips repository, PR, SHA, side, and Unicode paths
- returns exact base and head bytes
- returns empty bytes only for explicit empty URIs
- rejects traversal, invalid side, and missing SHA
- keeps documents read-only
- never serializes credentials

### Controller Tests

- modified file opens base old path against head new path
- renamed file uses different paths on each side
- added and deleted files use exactly one empty side
- stale list head SHA triggers refresh instead of an incorrect diff
- `files.json` is requested once per PR and shared concurrently
- raw reads are lazy and cached by SHA/path
- failures offer patch/web fallbacks

### Manual Verification

Verify public and private repositories with modified, added, deleted, renamed,
empty, Unicode-path, large, binary, image, and forked files. Confirm that the
editor shows unchanged content around the highlighted changes and that line
numbers match both complete revisions.

## Open API Questions

Resolve these before implementation is considered complete:

1. Does the raw endpoint accept both `diff_refs.base_sha` and `head_sha`?
2. How are private raw files authenticated?
3. For fork PRs, which repository contains each SHA?
4. Does an API-provided raw URL redirect, and may authorization follow safely?
5. How does `files.json` represent binary, added, deleted, renamed, and too-large
   files?
6. Are `diff_refs` stable until the PR head changes?
7. What raw-content response-size and rate limits apply?

If base and head commits live in different repositories, extend the snapshot
model with explicit base/head repository identities. Do not assume both SHAs are
available under the target repository.

## Implementation Sequence

1. Validate raw access for both refs, private repositories, and fork PRs.
2. Add typed `files.json` DTOs, mapper, service, and snapshot cache.
3. Add secure raw-byte fetching and immutable content caching.
4. Add virtual URI helpers and the read-only file-system provider.
5. Add `PullRequestDiffController` and switch the file command to `vscode.diff`.
6. Preserve patch/web fallback and add the complete status test matrix.
7. Validate binary/image behavior and enforce memory limits.

## Acceptance Criteria

- Selecting a supported file opens `vscode.diff`.
- Both sides display complete file content at `base_sha` and `head_sha`.
- VS Code highlights the changed lines with correct line numbers.
- Added, deleted, modified, and renamed files use the correct paths and sides.
- Expanding the file tree makes no `files.json` or raw-content request.
- The first diff opens one cached `files.json` snapshot; repeated opens reuse it.
- Raw content is fetched lazily and cached by immutable SHA/path.
- The feature never reads mutable branch-tip or working-tree content.
- Unsupported content presents a patch or web fallback, not a misleading diff.
- Authentication data never appears in URIs or logs.
