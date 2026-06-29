# Copilot Issue Settlement Design

## Goal

Add a manual GitCode issue settlement workflow that starts from an issue, uses
GitHub Copilot Chat for analysis and planning, and hands off write operations to
explicit extension commands.

This design is based on the current extension feature set:

- issue tree, issue overview, issue comments, and related pull requests already
  exist
- pull request Copilot context already exists for `@gitcodePullRequest`
- create-pull-request UI and services already exist
- GitCode branch creation and pull request creation APIs are documented and
  wrapped by services

The issue settlement flow should therefore avoid building a second pull request
creation experience. Copilot should help the user understand and plan the fix;
the extension should use the existing create-pull-request flow to publish the
result.

## User Flow

```text
1. User selects an issue from the GitCode Issues tree.
2. User runs GitCode: Use Issue as Copilot Context.
3. User asks Copilot Chat with @gitcodeIssue analyze this issue.
4. The extension fetches issue detail, comments, and related pull requests.
5. Copilot returns analysis, reproduction notes, implementation plan, and test
   plan.
6. User runs GitCode: Create Branch for Issue if they want a local work branch.
7. User edits and commits code locally.
8. User runs GitCode: Create Pull Request.
9. The create-PR form is prefilled with issue-aware defaults.
10. User reviews the form and explicitly creates the GitCode pull request.
```

## Scope

### In Scope

- Add issue tree command `GitCode: Use Issue as Copilot Context`.
- Store the selected issue in memory.
- Add chat participant `@gitcodeIssue`.
- Build Copilot context from issue detail, issue comments, related pull
  requests, and lightweight workspace git metadata.
- Support analysis, reproduction planning, implementation planning, test
  planning, and PR draft prompts.
- Add `GitCode: Create Branch for Issue` as an explicit local branch command.
- Prefill the existing create-pull-request flow from the selected issue.
- Reuse current GitCode service methods for issue reads, remote branch creation,
  repository metadata, comparison, and pull request creation.

### Out of Scope

- Automatically editing files from Copilot output.
- Automatically creating branches, pushing branches, or creating pull requests
  from a chat response.
- Creating a separate issue-specific pull request form.
- Automatically closing issues outside the existing create-PR
  `closeRelatedIssue` option.
- Persisting selected issue context across VS Code restarts.
- Inferring issue numbers from arbitrary natural language.
- Running a background autonomous coding agent.
- Sending repository source files to the model. This first version sends issue
  context only.

## UX

The issue tree remains the source of truth:

```text
Issues
  owner/repo (origin)
    All Open
      #309 [Bug-Report] Quantization warning for Qwen3.6
        Open Issue
        Open Issue On Web
        Copy Issue URL
        Use Issue as Copilot Context
        Create Branch for Issue
```

Selecting context shows:

```text
GitCode issue #309 selected for Copilot context.
```

The user then invokes Copilot manually:

```text
@gitcodeIssue analyze this issue and suggest an implementation plan
```

If no issue is selected:

```text
Select a GitCode issue first with GitCode: Use Issue as Copilot Context.
```

The branch command remains explicit:

```text
GitCode: Create Branch for Issue
```

The pull request handoff uses the existing command:

```text
GitCode: Create Pull Request
```

When an issue is selected, the create-PR form should receive issue-aware
defaults, but the user must still review and submit the form.

## Package Contributions

Add commands:

```json
{
  "command": "gitcode.useIssueAsCopilotContext",
  "title": "GitCode: Use Issue as Copilot Context",
  "icon": "$(sparkle)"
},
{
  "command": "gitcode.createBranchForIssue",
  "title": "GitCode: Create Branch for Issue",
  "icon": "$(git-branch)"
}
```

Add issue tree menu entries after the existing issue actions:

```json
{
  "command": "gitcode.useIssueAsCopilotContext",
  "when": "view == issues:gitcode && viewItem == issue",
  "group": "inline@4"
},
{
  "command": "gitcode.createBranchForIssue",
  "when": "view == issues:gitcode && viewItem == issue",
  "group": "inline@5"
}
```

Add a chat participant:

```json
{
  "id": "gitcode-issue.context",
  "name": "gitcodeIssue",
  "fullName": "GitCode Issue",
  "description": "Analyzes and plans work for the selected GitCode issue when manually invoked."
}
```

Do not add an issue-specific create-PR command in the first version. Reuse
`gitcode.createPullRequest`.

## Command Identifiers

Extend `COMMAND_ID`:

```ts
useIssueAsCopilotContext: 'gitcode.useIssueAsCopilotContext',
createBranchForIssue: 'gitcode.createBranchForIssue',
```

The participant id and name should be:

```text
participant id: gitcode-issue.context
participant name: gitcodeIssue
```

Avoid short participant names such as `@issue`, `@fix`, or `@settle`.

## Issue Selection State

Add a store that mirrors the existing pull request Copilot context store:

```ts
export interface SelectedCopilotIssue {
  repository: GitCodeRepository;
  issueNumber: number;
  title: string;
  url?: string;
}

export class CopilotIssueContextStore {
  private selected?: SelectedCopilotIssue;

  select(value: SelectedCopilotIssue): void {
    this.selected = value;
  }

  getSelected(): SelectedCopilotIssue | undefined {
    return this.selected;
  }

  clear(): void {
    this.selected = undefined;
  }
}
```

The store is owned by the view layer. Clear it when authentication state changes
or when workspace folders change. Do not persist it in the first version.

## Issue Selection Command

Register the command near the existing issue commands in
`registerIssueCommands`.

Behavior:

1. Resolve `IssueNodeContext` from the direct command argument or `IssueNode`.
2. Store repository, issue number, title, and URL.
3. Show a short confirmation.
4. Do not call Copilot from this command.

Sketch:

```ts
vscode.commands.registerCommand(
  COMMAND_ID.useIssueAsCopilotContext,
  async (context?: IssueNodeContext | IssueNode) => {
    const resolved = resolveIssueContext(context);
    if (!resolved) {
      logger.error('Cannot select issue for Copilot context: invalid command context.');
      return;
    }

    copilotIssueContextStore.select({
      repository: resolved.repository,
      issueNumber: resolved.issue.number,
      title: resolved.issue.title,
      url: resolved.issue.url,
    });

    vscode.window.showInformationMessage(
      `GitCode issue #${resolved.issue.number} selected for Copilot context.`,
    );
  },
);
```

## Chat Participant

Add focused issue Copilot components:

```text
src/view/copilot/
  copilotIssueContextStore.ts
  copilotIssueContextBuilder.ts
  registerCopilotIssueParticipant.ts
```

Register the participant during view controller initialization, following the
same lifecycle as `registerCopilotPullRequestParticipant`.

Behavior:

1. Treat any `@gitcodeIssue` request as an explicit request to use the selected
   issue.
2. Read the selected issue from `CopilotIssueContextStore`.
3. If missing, stream the missing-selection instruction.
4. Fetch issue detail, issue comments, and related pull requests.
5. Build a compact context payload.
6. Send system instruction, issue context, and user prompt to `request.model`.
7. Stream model output back to chat.

Default system instruction:

```text
You are helping settle the selected GitCode issue. Use the supplied issue
details, comments, related pull requests, and workspace metadata. Prioritize
reported behavior, expected behavior, reproduction steps, likely root cause,
implementation plan, test plan, and pull request draft. Do not claim that code
has been changed, branches have been created, commits have been pushed, or pull
requests have been opened unless the extension explicitly reports that action.
```

## Context Builder

Dependencies:

```ts
class CopilotIssueContextBuilder {
  constructor(
    private readonly issueService: IssueService,
    private readonly issueCommentService: IssueCommentService,
    private readonly repositoryContextService: RepositoryContextService,
  ) {}
}
```

The builder should collect:

- repository full name, remote name, and web URL
- issue number, title, state, author, labels, assignees, milestone, type,
  priority, workflow state, created time, and updated time
- issue body
- newest issue comments
- related pull requests with number, title, state, source, target, author, and
  URL
- current local branch name when the active repository matches the selected
  GitCode repository
- local repository root path

Recommended limits:

```text
issue body: 12,000 characters
comments: 50 newest comments
single comment body: 2,000 characters
related pull requests: 20 pull requests
total context: 40,000 characters
```

When content is truncated, include:

```text
[truncated]
```

Issue context fetch failures should be strict for issue detail and lenient for
secondary sections:

- if issue detail fails, fail the chat request
- if comments fail, include a comments error section and continue
- if related pull requests fail, include a related-PR error section and continue
- if local git metadata is unavailable, omit the workspace section

## Branch Creation

`GitCode: Create Branch for Issue` creates and checks out a local branch. It
does not create a remote branch unless the user later publishes through the
create-PR flow.

Behavior:

1. Resolve `IssueNodeContext` or fall back to `CopilotIssueContextStore`.
2. Resolve the active VS Code Git repository.
3. Confirm the selected issue repository matches the active repository remote.
4. Suggest a branch name.
5. Let the user edit the branch name.
6. Create and checkout the local branch.
7. Select the issue as Copilot context if it was invoked from a tree node.

Recommended branch format:

```text
issue/<number>-<slug>
```

Example:

```text
issue/309-quantization-warning-qwen36
```

The current `GitRepository` abstraction only exposes `state.HEAD`, `remotes`,
and optional `push`. Add a local git wrapper before implementing checkout:

```ts
class LocalGitService {
  getCurrentBranch(repository: GitRepository): Promise<string | undefined>;
  hasUncommittedChanges(repository: GitRepository): Promise<boolean>;
  branchExists(repository: GitRepository, branchName: string): Promise<boolean>;
  createAndCheckoutBranch(
    repository: GitRepository,
    branchName: string,
    startPoint?: string,
  ): Promise<void>;
  checkoutBranch(repository: GitRepository, branchName: string): Promise<void>;
}
```

Prefer the VS Code Git extension API when it exposes the needed operation. Use a
narrow `git` command runner only for missing operations, with argument arrays and
clear errors.

Dirty working tree policy:

- allow branch creation when the working tree is clean
- if dirty, ask before checkout because uncommitted changes may carry across
  branches
- if checkout fails, surface the git error and do not modify selection state

## Pull Request Handoff

Do not add `gitcode.createPullRequestForIssue` in the first version. The
extension already has `GitCode: Create Pull Request`, a create-PR webview, and
`PullRequestService.createPullRequest`.

Instead, make the create-PR session issue-aware when
`CopilotIssueContextStore.getSelected()` matches the active repository:

```ts
interface CreatePullRequestInitialIssueContext {
  issueNumber: number;
  issueTitle: string;
  issueUrl?: string;
}
```

Suggested defaults:

```text
title: Fix #<issueNumber>: <issue title>
issue: <issueNumber>
closeRelatedIssue: true only if the user explicitly checks the existing option
body:
  ## Summary

  Fixes #<issueNumber>

  ## Changes

  -

  ## Test Plan

  -
```

If the create-PR model already has stronger defaults from branch comparison,
preserve those and only add the issue reference/body scaffold when the field is
empty.

The existing create-PR flow remains responsible for:

- resolving repository metadata
- listing branches
- creating remote source branches when needed
- comparing source and target branches
- validating duplicates
- pushing or publishing local branches when needed
- submitting `PullRequestService.createPullRequest`
- refreshing the pull request tree
- opening the created PR

## Dependent APIs And Features

### Already Available

| Purpose | Current API or feature |
| --- | --- |
| Issue detail | `IssueService.getIssue` -> `GET /api/v5/repos/:owner/:repo/issues/:number` |
| Issue comments | `IssueCommentService.listIssueComments` -> `GET /api/v5/repos/:owner/:repo/issues/:number/comments` |
| Related PRs | `IssueService.listIssueRelatedPullRequests` -> `GET /api/v5/repos/:owner/:repo/issues/:number/pull_requests` |
| Repository metadata | `RepositoryService.getRepository` -> `GET /api/v5/repos/:owner/:repo` |
| Branch listing | `RepositoryService.listBranches` -> `GET /api/v5/repos/:owner/:repo/branches` |
| Remote branch creation | `RepositoryService.createBranch` -> `POST /api/v5/repos/:owner/:repo/branches` |
| Branch comparison | `RepositoryService.compareBranches` -> `GET /api/v5/repos/:owner/:repo/compare/:base...:head` |
| Pull request creation | `PullRequestService.createPullRequest` -> `POST /api/v5/repos/:owner/:repo/pulls` |
| Existing create PR UX | `GitCode: Create Pull Request` and create-pull-request webview |
| PR Copilot pattern | `@gitcodePullRequest`, context store, context builder, participant |

Relevant docs:

- [Get issue](../get-issue/design.md)
- [Get issue comments](../get-issue-comments/design.md)
- [Issue related pull requests](../issue-related-pull-request/design.md)
- [Create pull request](../create-pull-request/design.md)
- [Create pull request API](../create-pull-request/api.md)
- [Create branch API](../api/create-new-branch-api.md)
- [Copilot pull request context](../copilot-pull-request-context/design.md)

### Required Additions

| Dependency | Needed for | Proposed owner |
| --- | --- | --- |
| `CopilotIssueContextStore` | selected issue memory | `src/view/copilot` |
| `CopilotIssueContextBuilder` | issue prompt payload | `src/view/copilot` |
| `registerCopilotIssueParticipant` | `@gitcodeIssue` chat entry | `src/view/copilot` |
| issue context command | issue tree selection | `registerIssueCommands` |
| local branch checkout service | `Create Branch for Issue` | `src/common/git` or `src/view/git` |
| create-PR initial issue context | issue-aware form defaults | create PR helper/model/provider |

### Open API Or Product Questions

- Should the create-PR `issue` field receive `309`, `#309`, or another GitCode
  issue identifier format?
- Does setting `issue` only prefill title/body, or does it create a durable issue
  linkage?
- Does `close_related_issue` require `issue` to be set, or can GitCode infer
  related issues from the PR body?
- Should issue settlement use `Fixes #309`, `Closes #309`, or a GitCode-specific
  keyword in the PR body?
- Are remote branches created by `POST /branches` useful for issue settlement,
  or should local `git push -u` be the only publish path for branches with local
  commits?
- Does the token scope used by the extension already cover branch creation,
  branch push over git, and pull request creation?

## Error Handling

Use notifications for command failures and streamed markdown for chat failures.

Common messages:

- not signed in: `Sign in to GitCode first.`
- no selected issue: `Select a GitCode issue first with GitCode: Use Issue as Copilot Context.`
- inaccessible issue: `Unable to load issue #<number> from <owner/repo>.`
- active repository mismatch: `Open the matching GitCode repository before creating an issue branch.`
- branch already exists: offer to checkout the existing branch
- dirty working tree: ask whether to continue before checkout
- push rejected: show the remote rejection summary without tokens
- model denied or unavailable: let VS Code surface model access errors where
  possible
- cancellation: stop without an error notification

## Security And Privacy

- Do not include authentication tokens in chat context, logs, URIs, or errors.
- Do not send issue context unless the user manually invokes `@gitcodeIssue`.
- Do not create branches, push branches, or create pull requests from chat
  responses.
- Keep selected issue context in memory only.
- Respect VS Code language model consent prompts.
- Do not include local source file contents in this first version.
- Truncate issue bodies and comments before sending to the model.

## Testing

Add unit tests for:

- resolving issue node command context
- selecting, reading, and clearing `CopilotIssueContextStore`
- issue context builder formatting
- issue context builder truncation
- lenient comments and related-PR failures in the builder
- missing-selection participant response
- participant sending selected issue context without requiring a slash command
- branch name slug generation
- create branch command validation and branch-exists behavior
- create-PR issue defaults when a selected issue matches the active repository
- create-PR defaults not applying when repositories do not match

Manual verification:

1. Open a workspace with a GitCode repository configured.
2. Sign in.
3. Select an issue from the Issues tree.
4. Run `GitCode: Use Issue as Copilot Context`.
5. Send `@gitcodeIssue analyze this issue`.
6. Confirm the answer references the selected issue, comments, and related PRs.
7. Run `GitCode: Create Branch for Issue`.
8. Confirm the local branch is created and checked out.
9. Make and commit a small local change.
10. Run `GitCode: Create Pull Request`.
11. Confirm the form contains issue-aware defaults.
12. Create the PR.
13. Confirm the PR tree refreshes and the created PR opens.

## Implementation Order

1. Add constants and `package.json` contributions.
2. Add `CopilotIssueContextStore`.
3. Wire the store into view controller construction and clear lifecycle.
4. Register `gitcode.useIssueAsCopilotContext`.
5. Add `CopilotIssueContextBuilder`.
6. Register `@gitcodeIssue`.
7. Add tests for selection, builder, and participant behavior.
8. Add local branch name helper and local git service.
9. Register `gitcode.createBranchForIssue`.
10. Add create-PR initial issue context support.
11. Add create-PR issue default tests.
12. Manually verify the full settlement flow.
