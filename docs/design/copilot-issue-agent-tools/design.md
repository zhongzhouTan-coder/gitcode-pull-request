# GitCode Agent Tools Design

## Goal

Expose authenticated GitCode context to sandboxed LLM agents through VS Code
language model tools.

The tool layer should be a general GitCode agent API, not an implementation
detail of any higher-level user flow.

## Problem

Sandboxed agents can edit files and run validation, but they cannot read VS Code
secret storage or directly reuse the extension's authenticated GitCode session.
Passing GitCode tokens into the sandbox would be the wrong security boundary.

The extension already runs in the VS Code extension host, owns the GitCode
session, and can call authenticated GitCode services. Language model tools are
the bridge:

```text
Agent mode -> VS Code language model tool -> extension host -> GitCode service
```

The sandbox receives only scoped tool results. It never receives the access
token.

## Design Principles

- Register GitCode-specific language model tools with `vscode.lm.registerTool`.
- Keep authentication, repository resolution, and API access inside the
  extension host.
- Return task-shaped context, not raw tokens or arbitrary API access.
- Support both selected issues and selected pull requests.
- Keep the first tool set read-only.
- Require explicit user confirmation for local git writes, commits, pushes, and
  pull request creation.
- Do not expose a generic `gitcode_api_request` tool.
- Do not expose a tool that combines code edits, commit creation, branch push,
  and pull request creation into one opaque operation.

## Initial Tool Set

Contribute these tools through `contributes.languageModelTools` in
`package.json` and register implementations with `vscode.lm.registerTool`.

| Tool | Purpose | Writes |
| ---- | ------- | ------ |
| `gitcode_get_selected_issue` | Return the currently selected GitCode issue identity and repository metadata | No |
| `gitcode_get_selected_pull_request` | Return the currently selected GitCode pull request identity and repository metadata | No |
| `gitcode_get_issue_context` | Return selected issue detail, comments, related PRs, and repository metadata | No |
| `gitcode_get_pull_request_context` | Return selected PR detail, files, comments, review discussions, related issues, merge state, and repository metadata | No |
| `gitcode_get_pull_request_files` | Return selected PR changed-file summaries and optional patch snippets | No |
| `gitcode_get_pull_request_comments` | Return selected PR timeline comments and diff review discussions | No |

The selected-resource tools are intentionally small. Agents can call them first
to understand whether issue or PR context is available before requesting larger
context payloads.

## Deferred Tool Set

Add these only after the confirmation UX is explicit and tested.

| Tool | Purpose | Confirmation |
| ---- | ------- | ------------ |
| `gitcode_create_issue_branch` | Create and check out an issue branch | Required |
| `gitcode_prepare_pull_request` | Build title/body defaults from issue context and templates | Not required for preview |
| `gitcode_publish_branch` | Push the current branch to GitCode | Required |
| `gitcode_create_pull_request` | Create a pull request from prepared defaults | Required |
| `gitcode_add_pull_request_comment` | Add a PR timeline or diff comment | Required |

Commit creation should remain an extension command until the UI can show a
clear commit message, changed-file scope, and confirmation prompt.

## Tool Definitions

### `gitcode_get_selected_issue`

Input:

```json
{
  "type": "object",
  "properties": {}
}
```

Output:

```text
Selected issue:
Repository: owner/repo
Issue: #309 Fix branch publishing
State: open
URL: https://gitcode.com/owner/repo/issues/309
```

Behavior:

- Reads the current issue selection from the GitCode issue context store.
- Returns repository identity, issue number, title, state, and web URL.
- Throws a model-readable error when no GitCode issue is selected.
- Does not call GitCode if the selected issue snapshot is already available.

### `gitcode_get_selected_pull_request`

Input:

```json
{
  "type": "object",
  "properties": {}
}
```

Output:

```text
Selected pull request:
Repository: owner/repo
Pull request: #660 Fix merge button reset
State: open
Source: user:fix-merge-button
Target: owner:main
URL: https://gitcode.com/owner/repo/pulls/660
```

Behavior:

- Reads the current pull request selection from the PR tree, active PR overview,
  or Copilot PR context store.
- Returns repository identity, PR number, title, state, branches, and web URL.
- Throws a model-readable error when no GitCode pull request is selected.
- Does not return file patches or comments.

### `gitcode_get_issue_context`

Input:

```json
{
  "type": "object",
  "properties": {}
}
```

Output:

```text
Repository: owner/repo
Issue: #309 Fix branch publishing
Issue detail:
...

Comments:
...

Related pull requests:
...

```

Behavior:

- Uses the selected issue from the issue context store.
- Uses the existing issue context builder and GitCode services to return
  authenticated issue detail.
- Includes comments, related pull requests, labels, assignees, milestone,
  and repository metadata.
- Applies the shared prompt budget so the result is useful but bounded.
- Throws a model-readable error when no GitCode issue is selected.

### `gitcode_get_pull_request_context`

Input:

```json
{
  "type": "object",
  "properties": {
    "includePatches": {
      "type": "boolean",
      "description": "Include bounded patch snippets for changed files."
    }
  }
}
```

Output:

```text
Repository: owner/repo
Pull request: #660 Fix merge button reset
State: open
Source: user:fix-merge-button
Target: owner:main

Pull request detail:
...

Changed files:
...

Review discussions:
...

Related issues:
...

Merge state:
...
```

Behavior:

- Uses the selected pull request from the PR tree, active PR overview, or Copilot
  PR context store.
- Uses authenticated GitCode services for PR detail, changed files, comments,
  review discussions, related issues, operation logs, permissions, and merge
  state where available.
- Includes bounded patch snippets only when `includePatches` is true.
- Applies the shared prompt budget and prefers unresolved discussions, recent
  activity, and files with comments when trimming.
- Throws a model-readable error when no GitCode pull request is selected.

### `gitcode_get_pull_request_files`

Input:

```json
{
  "type": "object",
  "properties": {
    "includePatches": {
      "type": "boolean",
      "description": "Include bounded patch snippets."
    },
    "pathFilter": {
      "type": "string",
      "description": "Optional substring filter for changed file paths."
    }
  }
}
```

Behavior:

- Returns changed-file paths, statuses, additions/deletions, previous paths, raw
  file URLs when available, and bounded patch snippets when requested.
- Uses `pathFilter` only as a narrowing hint; it must not fail when no file
  matches.
- Does not open local files or edit workspace files.

### `gitcode_get_pull_request_comments`

Input:

```json
{
  "type": "object",
  "properties": {
    "unresolvedOnly": {
      "type": "boolean",
      "description": "Return only unresolved review discussions when supported."
    }
  }
}
```

Behavior:

- Returns PR timeline comments, diff review discussions, authors, timestamps,
  resolved state, paths, positions, and reply relationships where available.
- Prefers unresolved comments first when trimming for budget.
- Does not create, resolve, unresolve, or delete comments.

## Package Contributions

Keep `gitcode_get_issue_context` focused on authenticated GitCode issue
context, not extension flow internals.

Add PR entries:

```json
{
  "name": "gitcode_get_pull_request_context",
  "displayName": "Get GitCode Pull Request Context",
  "toolReferenceName": "gitcodePullRequestContext",
  "canBeReferencedInPrompt": true,
  "icon": "$(git-pull-request)",
  "modelDescription": "Returns the currently selected GitCode pull request context from the extension, including pull request detail, changed files, comments, review discussions, related issues, merge state, repository metadata, and permissions. Use this instead of web search or public pull request pages when reviewing or fixing a selected GitCode pull request. This tool does not edit files, commit, push, or create pull requests.",
  "userDescription": "Get selected GitCode pull request context.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "includePatches": {
        "type": "boolean",
        "description": "Include bounded patch snippets for changed files."
      }
    }
  }
}
```

Use the same contribution pattern for the selected-resource, PR files, and PR
comments tools.

## Implementation Notes

- Keep GitCode API calls in `src/gitcode/services/*`.
- Keep context formatting in `src/view/copilot/*` builders so participants and
  tools share prompt budgeting.
- Introduce a PR selection source equivalent to `CopilotIssueContextStore` if
  the existing PR context store is not sufficient.
- Do not duplicate authentication logic; all tools should call services that
  already use `GitCodeClientImpl` and `SessionStore`.
- Tool errors should be short and actionable, for example:
  `No GitCode pull request is selected. Use GitCode: Use Pull Request as
  Copilot Context first.`
- Context tools should tolerate partially unavailable data and report omitted
  sections instead of failing the whole invocation.

## Pull Request Tasks

PR review and PR-fix tasks should use the same tool layer:

- `#gitcodePullRequestContext` for the selected PR summary.
- `gitcode_get_pull_request_files` when the agent needs changed-file detail.
- `gitcode_get_pull_request_comments` when the agent needs review discussion
  detail.
This lets a sandboxed agent work on authenticated PR review or feedback-fix
tasks without receiving GitCode credentials.

## Tests

Add focused tests for:

- all contributed tool names are registered on activation
- issue selected-resource tool returns the current issue identity
- PR selected-resource tool returns the current PR identity
- issue context tool includes authenticated issue details
- PR context tool includes PR detail, changed files, comments, and merge state
- PR files tool honors `includePatches` and `pathFilter`
- PR comments tool prefers unresolved discussions when `unresolvedOnly` is true
- each tool returns a useful error when its required selected resource is absent

## Migration Plan

1. Keep the existing issue context tool working.
2. Add selected-resource tools for issue and PR context.
3. Add `gitcode_get_pull_request_context`,
   `gitcode_get_pull_request_files`, and `gitcode_get_pull_request_comments`.
4. Keep `gitcode_get_issue_context` focused on GitCode issue data.
5. Add PR review and PR-fix prompts that use the PR tools.
6. Consider guarded mutating tools only after read-only tools are stable.

## Open Questions

- Should selected-resource tools accept an optional explicit repository and
  issue or PR number later, or remain selection-only?
- Should PR context include raw patch content by default for small PRs, or only
  when `includePatches` is true?
