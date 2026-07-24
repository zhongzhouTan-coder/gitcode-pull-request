# GitCode Agent Tools Design

## Goal

Expose authenticated GitCode issue and pull request data to Copilot Agent mode
through VS Code language model tools.

The tools should behave like a small, read-only GitCode context API for agents.
They should not depend on a GitCode chat participant and should not require the
user to run `Use Issue/Pull Request as Copilot Context` before Agent mode can do
useful work.

For guided workflows such as `Settle with Agent`, the extension should pass
explicit repository and issue or pull request numbers in the prepared Agent
prompt. Tools should use those explicit inputs first, then fall back to selected
context only when explicit inputs are absent.

## Problem

Sandboxed agents can edit local files and run validation, but they cannot read
VS Code secret storage or directly reuse the extension's authenticated GitCode
session. Passing GitCode tokens into the sandbox would be the wrong security
boundary.

The extension already runs in the VS Code extension host, owns the GitCode
session, and can call authenticated GitCode services. Language model tools are
the bridge:

```text
Copilot Agent mode -> VS Code language model tool -> extension host -> GitCode service
```

The sandbox receives only scoped, task-shaped tool results. It never receives
the access token.

## Design Principles

- Register GitCode-specific language model tools with `vscode.lm.registerTool`.
- Name tools as `{verb}_{noun}` and use clear snake_case parameter names.
- Prefer explicit `repository`, `issue_number`, and `pull_request_number`
  parameters over selected editor context.
- Keep selected-context tools only as small convenience and fallback tools.
- Provide higher-level composed context tools before granular detail tools.
- Return curated, bounded, task-shaped Markdown or text, not raw API JSON.
- Page, filter, and summarize large result sets. Never dump a large pull request
  file list or all patches by default.
- Require targeted patch retrieval for file-level patch detail.
- Describe each tool's purpose, when to use it, when not to use it, parameter
  constraints, and output limits.
- Provide context-specific invocation and confirmation messages so users can see
  what authenticated data each tool reads.
- Keep authentication, repository resolution, and API access inside the
  extension host.
- Keep the first tool set read-only.
- Do not expose a generic `gitcode_api_request` tool.
- Do not expose mutating tools that commit, push, edit GitCode resources, or
  create pull requests until the confirmation UX is explicit and tested.

## Tool Set

Contribute these tools through `contributes.languageModelTools` in
`package.json` and register implementations with `vscode.lm.registerTool`.

### Discovery Tools

| Tool | Purpose | Writes |
| ---- | ------- | ------ |
| `gitcode_search_issues` | Search issues in a resolved or explicit GitCode repository | No |
| `gitcode_search_pull_requests` | Search pull requests in a resolved or explicit GitCode repository | No |

### Primary Context Tools

| Tool | Purpose | Writes |
| ---- | ------- | ------ |
| `gitcode_get_issue_context` | Return curated issue detail, bounded comments, related PRs, and repository metadata | No |
| `gitcode_get_pull_request_context` | Return curated PR detail, file summary, review summary, related issues, merge state, and repository metadata | No |

### Pull Request Drill-Down Tools

| Tool | Purpose | Writes |
| ---- | ------- | ------ |
| `gitcode_list_pull_request_files` | Return a paged and filterable changed-file list without patches | No |
| `gitcode_get_pull_request_file_patch` | Return bounded patch detail for one file or a small explicit file list | No |
| `gitcode_get_pull_request_comments` | Return bounded and filterable PR comments or review discussions | No |

### Selection Fallback Tools

| Tool | Purpose | Writes |
| ---- | ------- | ------ |
| `gitcode_get_selected_issue` | Return the selected issue identity, when selected context exists | No |
| `gitcode_get_selected_pull_request` | Return the selected PR identity, when selected context exists | No |

The selected-resource tools are intentionally small. They are useful for manual
chat and fallback discovery, but Agent workflows should not depend on them.

## Context Resolution

Tools should resolve repository and resource identity in this order:

1. Use explicit tool input:
   - `repository`
   - `issue_number`
   - `pull_request_number`
2. Use selected GitCode issue or pull request context.
3. Infer from high-confidence editor state, such as an active GitCode overview,
   focused GitCode tree item, GitCode PR diff URI, or branch name that clearly
   encodes one issue number.
4. Return a short actionable error if no resource can be resolved confidently.

Tools cannot read the Agent prompt by themselves. Prepared prompts should tell
the model to pass explicit `repository`, `issue_number`, or
`pull_request_number` inputs when calling GitCode tools.

Automatic inference must be conservative. A tool should never silently choose
among multiple plausible repositories, issues, or pull requests.

Recommended error:

```text
No GitCode pull request could be resolved. Provide repository and
pull_request_number, or open a GitCode pull request and try again.
```

## Tool Definitions

### `gitcode_search_issues`

This tool searches issues in a GitCode repository.

Use it when the user refers to an issue by keywords, title, author, state, label,
or when a command-palette flow needs the user to choose an issue. Do not use it
when the issue number is already known; use `gitcode_get_issue_context` instead.

Input:

```json
{
  "type": "object",
  "properties": {
    "repository": {
      "type": "string",
      "description": "The repository parameter specifies the GitCode repository in owner/repo form. If omitted, the current workspace repository is used only when it can be resolved unambiguously."
    },
    "query": {
      "type": "string",
      "description": "The query parameter specifies keywords to search in issue titles and bodies. It should be a concise search phrase, not a full implementation prompt."
    },
    "state": {
      "type": "string",
      "enum": ["open", "closed", "all"],
      "description": "The state parameter narrows results by issue state. Use open by default for implementation work."
    },
    "page": {
      "type": "number",
      "description": "The page parameter specifies the 1-based result page to return. It defaults to 1."
    },
    "page_size": {
      "type": "number",
      "description": "The page_size parameter controls how many issues are returned. It defaults to 20 and must not exceed 50."
    }
  }
}
```

Output limits:

- Return at most `page_size` issues.
- Include issue number, title, state, author, labels, updated time, and URL.
- Do not include full issue bodies or full comments.

### `gitcode_get_issue_context`

This tool retrieves curated authenticated context for one GitCode issue.

Use it when an agent needs enough issue information to implement, explain, or
triage the issue. Do not call separate issue-comment tools by default; comments
and related pull requests should be composed into this context.

Input:

```json
{
  "type": "object",
  "properties": {
    "repository": {
      "type": "string",
      "description": "The repository parameter specifies the GitCode repository in owner/repo form. If omitted, the current workspace or selected issue repository is used only when it can be resolved unambiguously."
    },
    "issue_number": {
      "type": "number",
      "description": "The issue_number parameter specifies the GitCode issue number to retrieve. Prefer passing it explicitly from the Agent prompt or user request."
    },
    "comment_limit": {
      "type": "number",
      "description": "The comment_limit parameter controls how many issue comments are included. It defaults to 20 and must not exceed 50."
    }
  }
}
```

Output:

```text
Repository: owner/repo
Issue: #123 Fix login redirect
State: open
URL: https://gitcode.com/owner/repo/issues/123

Issue detail:
...

Comments:
- ...

Related pull requests:
- ...

Omitted:
- 14 older comments not shown
```

Output limits:

- Include title, body, state, author, assignees, labels, milestone, timestamps,
  repository metadata, and URL.
- Include bounded comments with truncation notes.
- Include related pull request summaries when available.
- Do not include unrelated repository data.
- Do not edit issues, comments, branches, or files.

### `gitcode_search_pull_requests`

This tool searches pull requests in a GitCode repository.

Use it when the user refers to a PR by keywords, branch, author, state, or when
the PR number is unknown. Do not use it when the PR number is already known; use
`gitcode_get_pull_request_context` instead.

Input:

```json
{
  "type": "object",
  "properties": {
    "repository": {
      "type": "string",
      "description": "The repository parameter specifies the GitCode repository in owner/repo form. If omitted, the current workspace repository is used only when it can be resolved unambiguously."
    },
    "query": {
      "type": "string",
      "description": "The query parameter specifies keywords to search in pull request titles, bodies, or branch names. It should be concise."
    },
    "state": {
      "type": "string",
      "enum": ["open", "closed", "merged", "all"],
      "description": "The state parameter narrows results by pull request state. Use open by default for review and fix work."
    },
    "page": {
      "type": "number",
      "description": "The page parameter specifies the 1-based result page to return. It defaults to 1."
    },
    "page_size": {
      "type": "number",
      "description": "The page_size parameter controls how many pull requests are returned. It defaults to 20 and must not exceed 50."
    }
  }
}
```

Output limits:

- Return at most `page_size` pull requests.
- Include PR number, title, state, source branch, target branch, author, updated
  time, and URL.
- Do not include full PR bodies, comments, file lists, or patches.

### `gitcode_get_pull_request_context`

This tool retrieves curated authenticated context for one GitCode pull request.

Use it when an agent needs a review-ready or fix-ready PR overview. This should
be the default PR tool for agent tasks. Do not use it to fetch all patches for a
large PR; use `gitcode_list_pull_request_files` and
`gitcode_get_pull_request_file_patch` for drill-down.

Input:

```json
{
  "type": "object",
  "properties": {
    "repository": {
      "type": "string",
      "description": "The repository parameter specifies the GitCode repository in owner/repo form. If omitted, the current workspace or selected pull request repository is used only when it can be resolved unambiguously."
    },
    "pull_request_number": {
      "type": "number",
      "description": "The pull_request_number parameter specifies the GitCode pull request number to retrieve. Prefer passing it explicitly from the Agent prompt or user request."
    },
    "include_patch_summary": {
      "type": "boolean",
      "description": "The include_patch_summary parameter controls whether a compact patch summary is included for the most relevant changed files. It does not return full patches."
    },
    "comment_limit": {
      "type": "number",
      "description": "The comment_limit parameter controls how many review or timeline comments are included. It defaults to 20 and must not exceed 50."
    },
    "file_limit": {
      "type": "number",
      "description": "The file_limit parameter controls how many changed-file summaries are included. It defaults to 50 and must not exceed 100."
    }
  }
}
```

Output:

```text
Repository: owner/repo
Pull request: #456 Fix merge button reset
State: open
Source: user:fix-merge-button
Target: owner:main
URL: https://gitcode.com/owner/repo/pulls/456

Pull request detail:
...

Changed file summary:
- Total files: 438
- Statuses: modified 390, added 31, deleted 17
- Returned: 50 most relevant files

Review summary:
- 8 unresolved discussions
- 3 outdated discussions

Related issues:
- #123 Fix login redirect

Omitted:
- 388 files not shown. Use gitcode_list_pull_request_files with page: 2 or path_filter.
- Full patches omitted. Use gitcode_get_pull_request_file_patch for specific paths.
```

Output limits:

- Include PR detail, branches, state, author, reviewers/testers/assignees when
  available, merge state, related issues, repository metadata, and URL.
- Include changed-file summary and at most `file_limit` file entries.
- Include bounded comments or review discussion summaries.
- Do not include full patches by default.
- Always report omitted files, comments, and patches.
- Do not edit comments, resolve discussions, push branches, or create PRs.

### `gitcode_list_pull_request_files`

This tool returns a paged changed-file list for one GitCode pull request without
patches.

Use it when the PR context says files were omitted, when the agent needs to
inspect a directory or file type, or when a large PR needs incremental review.
Do not use it for patch content; use `gitcode_get_pull_request_file_patch`.

Input:

```json
{
  "type": "object",
  "properties": {
    "repository": {
      "type": "string",
      "description": "The repository parameter specifies the GitCode repository in owner/repo form. If omitted, the current workspace or selected pull request repository is used only when it can be resolved unambiguously."
    },
    "pull_request_number": {
      "type": "number",
      "description": "The pull_request_number parameter specifies the GitCode pull request number whose changed files should be listed."
    },
    "path_filter": {
      "type": "string",
      "description": "The path_filter parameter narrows results to changed file paths containing this case-insensitive substring. It is not a regular expression or glob pattern."
    },
    "status_filter": {
      "type": "string",
      "enum": ["added", "modified", "removed", "renamed", "all"],
      "description": "The status_filter parameter narrows results by changed-file status. Use all when no status narrowing is needed."
    },
    "page": {
      "type": "number",
      "description": "The page parameter specifies the 1-based result page to return. It defaults to 1."
    },
    "page_size": {
      "type": "number",
      "description": "The page_size parameter controls how many files are returned. It defaults to 50 and must not exceed 100."
    }
  }
}
```

Output limits:

- Return no patches.
- Return at most `page_size` files.
- Include total count, returned count, page count, status counts, path, status,
  additions, deletions, previous path for renames, and truncation notes.
- Sort important files first by default: unresolved-comment files, source files,
  tests, then other files.

### `gitcode_get_pull_request_file_patch`

This tool returns bounded patch detail for one file or a small explicit file
list in a GitCode pull request.

Use it only after `gitcode_get_pull_request_context` or
`gitcode_list_pull_request_files` identifies specific paths that need patch
inspection. Do not use it with broad path filters or for an entire large PR.

Input:

```json
{
  "type": "object",
  "properties": {
    "repository": {
      "type": "string",
      "description": "The repository parameter specifies the GitCode repository in owner/repo form. If omitted, the current workspace or selected pull request repository is used only when it can be resolved unambiguously."
    },
    "pull_request_number": {
      "type": "number",
      "description": "The pull_request_number parameter specifies the GitCode pull request number whose patch should be retrieved."
    },
    "file_paths": {
      "type": "array",
      "items": { "type": "string" },
      "description": "The file_paths parameter specifies one or more exact changed file paths to retrieve patches for. It must contain no more than 10 paths."
    },
    "max_patch_lines_per_file": {
      "type": "number",
      "description": "The max_patch_lines_per_file parameter limits patch output per file. It defaults to 120 and must not exceed 300."
    }
  },
  "required": ["file_paths"]
}
```

Output limits:

- Require exact changed file paths.
- Reject more than 10 paths.
- Return at most `max_patch_lines_per_file` patch lines per file.
- Omit patches for too-large files and report that omission.
- Include path, status, additions, deletions, previous path for renames, and
  bounded diff snippets.

### `gitcode_get_pull_request_comments`

This tool returns bounded and filterable pull request timeline comments and
review discussions.

Use it when the primary PR context omitted comment detail or when the agent needs
unresolved review feedback. Do not use it to create, edit, resolve, unresolve,
or delete comments.

Input:

```json
{
  "type": "object",
  "properties": {
    "repository": {
      "type": "string",
      "description": "The repository parameter specifies the GitCode repository in owner/repo form. If omitted, the current workspace or selected pull request repository is used only when it can be resolved unambiguously."
    },
    "pull_request_number": {
      "type": "number",
      "description": "The pull_request_number parameter specifies the GitCode pull request number whose comments should be retrieved."
    },
    "unresolved_only": {
      "type": "boolean",
      "description": "The unresolved_only parameter controls whether only unresolved diff review discussions are returned."
    },
    "path_filter": {
      "type": "string",
      "description": "The path_filter parameter narrows diff review discussions to paths containing this case-insensitive substring. It does not affect general timeline comments unless unresolved_only is false."
    },
    "page": {
      "type": "number",
      "description": "The page parameter specifies the 1-based result page to return. It defaults to 1."
    },
    "page_size": {
      "type": "number",
      "description": "The page_size parameter controls how many comments are returned. It defaults to 30 and must not exceed 50."
    }
  }
}
```

Output limits:

- Return at most `page_size` comments.
- Sort unresolved diff comments first, then newest activity.
- Include author, timestamp, resolved state, outdated state, file location,
  bounded body, bounded replies, and truncation notes.

### `gitcode_get_selected_issue`

This fallback tool returns the currently selected GitCode issue identity.

Use it only when explicit issue input is unavailable and selected context may
help orient the agent. Do not use it as the primary settle workflow mechanism.

Output:

```text
Selected issue:
Repository: owner/repo
Issue: #123 Fix login redirect
URL: https://gitcode.com/owner/repo/issues/123
```

### `gitcode_get_selected_pull_request`

This fallback tool returns the currently selected GitCode pull request identity.

Use it only when explicit pull request input is unavailable and selected context
may help orient the agent. Do not use it as the primary PR review or fix
mechanism.

Output:

```text
Selected pull request:
Repository: owner/repo
Pull request: #456 Fix merge button reset
Source: user:fix-merge-button
Target: owner:main
URL: https://gitcode.com/owner/repo/pulls/456
```

## Large Pull Request Strategy

Large PRs are normal. Tool output must stay useful and bounded.

Rules:

- `gitcode_get_pull_request_context` returns a summary and the most relevant
  file entries, not every changed file.
- `gitcode_list_pull_request_files` pages through file summaries without
  patches.
- `gitcode_get_pull_request_file_patch` requires exact paths and returns bounded
  patches.
- Patch output is never included by default for large PRs.
- Every truncated result reports what was omitted and which tool/input to use
  next.

Recommended agent path for a large PR:

```text
1. Call gitcode_get_pull_request_context.
2. Read changed-file and review summaries.
3. Call gitcode_list_pull_request_files with path_filter or page when more file
   discovery is needed.
4. Call gitcode_get_pull_request_file_patch for exact paths that need diff
   inspection.
5. Call gitcode_get_pull_request_comments with unresolved_only when review
   feedback detail is needed.
```

## Package Contributions

Each contributed tool should include:

- unique `name`
- short `displayName`
- stable `toolReferenceName`
- clear `modelDescription` covering what the tool does, when to use it, when not
  to use it, and output limits
- concise `userDescription`
- JSON schema with detailed parameter descriptions

Example:

```json
{
  "name": "gitcode_get_pull_request_file_patch",
  "displayName": "Get GitCode Pull Request File Patch",
  "toolReferenceName": "gitcodePullRequestFilePatch",
  "canBeReferencedInPrompt": true,
  "icon": "$(diff)",
  "modelDescription": "This tool retrieves bounded patch detail for exact changed file paths in a GitCode pull request. Use it after gitcode_get_pull_request_context or gitcode_list_pull_request_files identifies specific files that need diff inspection. Do not use it to fetch every file in a large pull request. The tool is read-only and does not edit files, comments, branches, or pull requests.",
  "userDescription": "Get bounded patch detail for selected pull request files.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "repository": {
        "type": "string",
        "description": "The repository parameter specifies the GitCode repository in owner/repo form."
      },
      "pull_request_number": {
        "type": "number",
        "description": "The pull_request_number parameter specifies the GitCode pull request number whose patch should be retrieved."
      },
      "file_paths": {
        "type": "array",
        "items": { "type": "string" },
        "description": "The file_paths parameter specifies exact changed file paths to retrieve patches for. It must contain no more than 10 paths."
      },
      "max_patch_lines_per_file": {
        "type": "number",
        "description": "The max_patch_lines_per_file parameter limits patch output per file. It defaults to 120 and must not exceed 300."
      }
    },
    "required": ["file_paths"]
  }
}
```

## Implementation Notes

- Keep GitCode API calls in `src/gitcode/services/*`.
- Keep context formatting in `src/view/copilot/*` builders so participants,
  Agent tools, and prompt builders share budgeting behavior.
- Add a shared context resolver for repository, issue, and pull request
  identity. It should prefer explicit inputs, then selected context, then
  high-confidence editor/tree/webview state.
- Do not duplicate authentication logic; tools should call services that already
  use `GitCodeClientImpl` and `SessionStore`.
- Tool errors should be short and actionable.
- Context tools should tolerate partially unavailable data and report omitted
  sections instead of failing the whole invocation.
- Search tools should return compact identity rows and never return full bodies,
  full comments, or patches.
- Drill-down tools should require explicit narrowing inputs before returning
  large or expensive details.

## Settle Issue Workflow

The settle issue workflow should not depend on selected-context tools. The
prepared Agent prompt should include explicit identity:

```text
Repository: owner/repo
Issue: #123 Fix login redirect

Use gitcode_get_issue_context with repository: "owner/repo" and
issue_number: 123 when authenticated issue details are needed.
```

The extension should still store the resolved issue as selected Copilot issue
context so manual chat and fallback tools work, but that selected context is not
the primary mechanism.

## Pull Request Tasks

PR review and PR-fix tasks should use the same explicit-first tool layer:

- `gitcode_search_pull_requests` when the PR number is unknown.
- `gitcode_get_pull_request_context` when the PR number is known.
- `gitcode_list_pull_request_files` when the context omits files or a path needs
  filtering.
- `gitcode_get_pull_request_file_patch` for exact paths that need patch detail.
- `gitcode_get_pull_request_comments` for unresolved review detail or paged
  comment drill-down.

## Deferred Mutating Tools

Add mutating tools only after the confirmation UX is explicit and tested.

| Tool | Purpose | Confirmation |
| ---- | ------- | ------------ |
| `gitcode_add_pull_request_comment` | Add a PR timeline or diff comment | Required |
| `gitcode_resolve_pull_request_comment` | Resolve a PR review discussion | Required |
| `gitcode_create_pull_request` | Create a pull request from prepared defaults | Required |

Commit creation and branch publishing should remain extension commands because
the UI must show changed-file scope, commit message, remote, and branch before
running local git operations.

## Tests

Add focused tests for:

- all contributed tool names are registered on activation
- search issue tool returns compact paged identity rows
- search PR tool returns compact paged identity rows
- issue context tool prefers explicit `repository` and `issue_number`
- issue context tool includes bounded comments and related PR summaries
- PR context tool prefers explicit `repository` and `pull_request_number`
- PR context tool returns file summary without full patches by default
- PR context tool reports omitted files, comments, and patches
- PR file list tool pages and filters large changed-file sets
- PR file list tool never returns patches
- PR file patch tool rejects more than 10 paths
- PR file patch tool limits patch lines per file
- PR comments tool pages comments and supports `unresolved_only`
- selected-resource tools remain available as fallback tools
- context resolution reports ambiguity instead of silently guessing
- each tool returns a useful error when its required resource cannot be resolved

## Migration Plan

1. Keep existing selected-context tools for compatibility.
2. Rename `gitcode_get_pull_request_files` to
   `gitcode_list_pull_request_files` or add the new list tool while preserving
   the old name as a compatibility alias.
3. Add `gitcode_get_pull_request_file_patch`.
4. Add `repository`, `issue_number`, and `pull_request_number` inputs to primary
   context tools.
5. Add `gitcode_search_issues` and `gitcode_search_pull_requests`.
6. Update Agent prompts to pass explicit repository and issue or PR numbers.
7. Update package contributions with detailed descriptions and bounded schemas.
8. Add paging, filtering, truncation notes, and large-PR tests.

## Open Questions

- Should `repository` be required for explicit-number tools, or optional with
  unambiguous workspace resolution?
- Should `gitcode_get_issue_context` expose a `comment_limit`, or always rely on
  the shared prompt budget?
- Should PR context include a tiny patch summary for the most relevant files, or
  only file metadata and review summaries?
- Should the old `gitcode_get_pull_request_files` name remain as an alias for
  compatibility?
