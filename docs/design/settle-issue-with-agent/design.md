# Settle Issue With Agent Design

## Goal

Add a focused issue-settlement entry point that starts from a GitCode issue,
prepares the local branch context, and opens Copilot Agent mode with enough
authenticated context for the model to implement the issue.

The user-facing promise is:

```text
Click Settle with Agent. The extension prepares the issue and branch, then Agent
decides the implementation and next steps.
```

The extension owns only the setup that must be deterministic:

- resolve the GitCode issue
- store selected issue context for read-only Agent tools
- resolve the matching local Git repository
- optionally create and check out an issue branch
- open Agent mode with explicit repository and issue number

Agent mode owns implementation guidance after handoff:

- read issue context through the GitCode Agent tools
- inspect files and local git state
- edit code and tests
- run validation
- inspect recent commit messages
- suggest a repository-style commit message
- decide the next step: continue implementation, commit, publish, or create a
  pull request

## Current State

Implemented or in scope:

- `GitCode: Use Issue as Copilot Context`
- `GitCode: Create Branch for Issue`
- `GitCode: Create Pull Request`
- create-PR view branch publishing for unpublished source branches
- read-only Agent tools:
  - `gitcode_get_selected_issue`
  - `gitcode_get_issue_context`
  - `gitcode_get_selected_pull_request`
  - `gitcode_get_pull_request_context`
  - `gitcode_list_pull_request_files`
  - `gitcode_get_pull_request_file_patch`
  - `gitcode_get_pull_request_comments`
- `GitCode: Settle Issue with Agent`
- PR template discovery for `.gitcode/PULL_REQUEST_TEMPLATE`
- improved Git push auth errors when create-PR branch publishing fails

The settle prompt should use explicit `gitcode_get_issue_context` inputs as the
primary issue-context mechanism.

## Non-Goals

- Do not add workflow state such as `branchReady`, `planReady`, or `commitReady`.
- Do not add extension-owned continuation commands for commit and publish.
- Do not show extension-driven `Commit Changes` or `Publish Branch` actions
  after Agent mode opens.
- Do not generate a commit message in extension UI.
- Do not let an LLM tool commit, push, or create a pull request without user
  approval.
- Do not create one opaque operation that edits code, commits, pushes, and
  creates a PR.
- Do not route the core settle workflow through the GitCode chat participant.

## User Experience

Expose one primary issue action:

```text
GitCode: Settle Issue with Agent
```

Surfaces:

- issue tree item context menu
- issue overview actions
- command palette

Short labels:

```text
Settle with Agent
Create Pull Request
```

Default flow:

```text
1. User clicks Settle with Agent from an issue tree item, issue overview, or
   command palette.
2. Extension resolves the settlement issue from the clicked issue, active issue
   overview, selected Copilot issue context, or a user picker.
3. Extension stores the resolved issue as Copilot issue context.
4. Extension resolves the matching local Git repository.
5. Extension asks for branch setup:
   - Create issue branch
   - Use current branch
   - Cancel
6. If creating a branch, extension asks for:
   - base branch/ref
   - editable issue branch name
7. Extension creates and checks out the branch.
8. Extension opens Agent mode with an implementation prompt that includes the
   explicit `repository`, `issue_number`, and branch name.
9. Agent mode calls `gitcode_get_issue_context`, edits files, updates tests,
   runs validation, inspects recent commits, suggests a commit message, and
   recommends the next step.
10. User decides whether to continue in Agent, commit, publish, or create a PR
    using normal Git / VS Code / extension surfaces.
```

`GitCode: Use Issue as Copilot Context` remains useful for manual chat context,
but it is not a prerequisite for issue settlement. `Settle with Agent` must bind
the issue context itself.

## Issue Resolution

`Settle with Agent` should resolve the issue in this order:

1. Use the issue passed by the clicked issue tree item or issue overview action.
2. Use the active issue overview if it identifies exactly one GitCode issue.
3. Use selected Copilot issue context when it matches the current workspace or
   the user confirms it.
4. Infer from high-confidence editor state, such as a GitCode issue overview
   webview or issue URL, only when there is one clear issue.
5. Ask the user to choose an issue from the current GitCode repository.

If no issue can be resolved, show an actionable prompt:

```text
Choose an issue to settle, or open an issue from the GitCode view and click
Settle with Agent.
```

## Agent Handoff

The extension stops after it opens Agent mode. It should not show notification
buttons or issue-overview actions that force a fixed commit / publish sequence.

The issue overview should not switch the settlement action based on current
repository state. The extension cannot reliably regenerate a prompt that
reflects all current Agent and workspace state, so the visible settlement action
remains the initial `Settle with Agent` entry point.

The Agent prompt should make the model responsible for post-implementation
guidance:

```text
At the end of your response:
- Summarize changed files, validation result, and remaining risk.
- Inspect recent commit messages and suggest a commit message matching this
  repository's style.
- Decide the next settlement step from the current repository state.
- Do not commit, push, or create a pull request unless the user explicitly asks
  and an approved tool or command is available.
```

## Chat Participant Boundary

The settle workflow must not depend on the GitCode chat participant. Copilot
Agent mode is a separate surface: the extension can prepare the prompt and expose
language model tools, but it cannot proxy the final Agent response or inject
reliable continuation buttons into that response through the participant.

Core settle path:

```text
GitCode issue overview / tree
-> Settle with Agent
-> optional issue branch setup
-> Copilot Agent mode with explicit repository / issue_number
-> Agent calls gitcode_get_issue_context
-> Agent edits files and runs validation
-> Agent suggests commit message and next step
```

The chat participant remains optional and read-only. It can answer questions,
summarize the selected issue, or explain a pull request, but it should not own
settlement state, continuation actions, or Agent-mode orchestration.

## Commands

### `GitCode: Settle Issue with Agent`

Command id:

```ts
settleIssueWithAgent: 'gitcode.settleIssueWithAgent'
```

Responsibilities:

- Resolve the settlement issue from the clicked issue, active issue overview,
  selected Copilot issue context, high-confidence editor state, or user picker.
- Store the resolved issue in `CopilotIssueContextStore` for manual chat and
  fallback selected-context tools.
- Resolve the matching local git repository by GitCode remote, not by active
  editor alone.
- Offer branch setup.
- When creating a branch, reuse the existing branch base picker and
  `createAndCheckoutBranch`.
- Open Agent mode with a deterministic prompt.

The command must not commit, push, create a pull request, or surface commit /
publish continuation actions after opening Agent mode.

Agent prompt:

```text
Use authenticated GitCode context for this issue:

Repository: <owner/repo>
Issue: #<number> <title>
Branch: <current branch>

When you need issue details, call gitcode_get_issue_context with:
- repository: "<owner/repo>"
- issue_number: <number>

If related pull requests are listed and you need pull request details, call
gitcode_get_pull_request_context with:
- repository: the related pull request repository shown in the issue context, or
  "<owner/repo>" when no separate repository is shown
- pull_request_number: <pull request number>

Implement the issue in this workspace.

Requirements:
1. Read the authenticated GitCode issue context with explicit tool inputs.
2. Inspect relevant local files before editing.
3. Keep the change scoped to the selected issue.
4. Add or update tests for changed behavior.
5. Run appropriate validation commands.
6. Summarize changed files, validation result, and remaining risk.
7. Inspect recent commit messages and suggest a commit message that matches this
   repository's style.
8. Decide the next settlement step from the current repository state, such as
   continuing implementation, committing, publishing, or creating a pull request.
9. Do not commit, push, or create a pull request unless the user explicitly asks
   and an approved tool or command is available.
```

If the VS Code API cannot reliably open Agent mode, open the best available chat
surface with the prompt copied or prefilled. Avoid asking the user to discover
another GitCode command.

### `GitCode: Create Pull Request`

Keep the existing command and create-PR view behavior:

- Continue to support the current no-argument command behavior.
- Accept optional initial issue and branch context when a caller can provide it.
- Prefill issue context when the selected issue repository matches the target
  repository.
- If the source branch is local-only, ask before publishing it from the create-PR
  view.
- Show GitCode-specific credential guidance when Git push fails because HTTPS or
  SSH credentials are unavailable.

## Pull Request Template Support

Add a PR template discovery service for repository-local templates.

Supported paths:

```text
.gitcode/PULL_REQUEST_TEMPLATE.md
.gitcode/PULL_REQUEST_TEMPLATE/default.md
.gitcode/PULL_REQUEST_TEMPLATE/bugfix.md
.gitcode/PULL_REQUEST_TEMPLATE/feature.md
```

Behavior:

- If one template is found, use it by default.
- If multiple templates are found, ask the user to choose.
- If none are found, use the existing create-PR defaults.
- Copy template content into the create-PR body and keep it editable.
- Apply only explicit placeholders supported by the extension.
- Leave unknown placeholders unchanged.

Supported placeholders:

```text
{{issue_number}}
{{issue_title}}
{{issue_url}}
{{source_branch}}
{{target_branch}}
{{repository}}
```

Do not invent test results. If the template has test sections, leave them for
the user or Agent summary to fill.

## Safety Rules

- Every command must validate the current repository and branch when invoked.
- Never rely only on the active editor in multi-root workspaces when issue
  context identifies a repository.
- Do not pass GitCode tokens to Agent mode.
- Do not add mutating LLM tools for the first implementation.
- Do not add extension-owned commit / publish settlement commands unless the
  product direction changes again.
- Do not create a PR until the source branch exists remotely.

## Implementation Plan

1. Add `gitcode.settleIssueWithAgent`.
2. Add package contributions and issue tree / issue overview actions for
   `Settle with Agent`.
3. Extract repository matching helpers for issue commands and create-PR handoff.
4. Add Agent-mode prompt builder for issue settlement.
5. Add a simplified issue-settlement action resolver that returns only
   `Settle with Agent`.
6. Add optional initial context to `CreatePullRequestHelper.create`.
7. Add PR template discovery and placeholder application.
8. Update create-PR data model to accept template-provided body defaults.
9. Add shared Git push auth error formatting for create-PR branch publishing.

## Tests

Add focused tests for:

- settle command stores selected issue context
- settle command uses the clicked issue as settlement context without requiring
  `GitCode: Use Issue as Copilot Context`
- settle command can resolve the active issue overview as settlement context
- settle command asks the user to choose an issue when invoked without any
  resolvable issue context
- settle command resolves the local repository matching the issue repository
- settle command creates branch only after user chooses branch creation
- settle command opens Agent-mode prompt with explicit `repository` and
  `issue_number`
- settle prompt instructs Agent to call `gitcode_get_issue_context` with
  explicit tool inputs
- settle prompt asks Agent to inspect recent commits before suggesting a commit
  message
- settlement action resolver exposes only the start action
- create-PR command honors explicit repository and branch context
- create-PR command does not switch to the active repository in multi-root
  workspaces when explicit context is provided
- PR template service detects single-file and directory templates
- PR template placeholders are applied conservatively
- Git push auth errors are translated into actionable credential guidance

Manual validation:

```text
1. Click Settle with Agent from an issue tree item or issue overview.
2. Confirm the clicked issue is stored as Copilot issue context automatically.
3. Create an issue branch from a selected base branch.
4. Confirm Agent mode opens with explicit repository and issue number and tells
   Agent to call gitcode_get_issue_context.
5. Let Agent mode make a small change.
6. Confirm the extension does not show Commit Changes or Publish Branch as
   settlement continuation actions.
7. Confirm Agent suggests a commit message based on recent commits and gives the
   next recommended step.
8. Open Create Pull Request manually when ready and confirm issue/template
   defaults are applied.
```

## Open Questions

- What VS Code API path should be used to open Agent mode reliably?
- Should create-PR template discovery support `.github` or `.gitee` fallback
  locations, or only `.gitcode`?
- Should mutating Agent tools for commit, push, or PR creation ever be added
  with explicit approval gates, or should those remain outside Agent tooling?
