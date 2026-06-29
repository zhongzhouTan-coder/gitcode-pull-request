# Create Pull Request Design

## Goal

Add a GitCode pull request creation flow for the current workspace repository.

The feature must:

- resolve the target GitCode repository from the current git repository using
  the same repository resolution rules as the pull request tree
- use the create pull request API documented in [api.md](api.md)
- use the supporting repository, branch, compare, label, milestone,
  repository member, and list pull request APIs documented under [../api](../api) and
  [../list-pull-requests/api.md](../list-pull-requests/api.md)
- provide a VS Code command and view for entering pull request details
- prefill sensible defaults from the active git branch and repository metadata
- keep API access inside `gitcode/services/*`, not in the view layer
- refresh the pull request tree and open the created pull request after success
- use `vscode-pull-request-github/src/view/createPullRequestHelper.ts`,
  `vscode-pull-request-github/src/view/createPullRequestDataModel.ts`, and
  `vscode-pull-request-github/src/github/createPRViewProvider.ts` as UX and
  lifecycle references

GitCode should keep the useful GitHub extension shape: a create helper owns the
active create session, a data model owns branch and diff state, and a view
provider owns the form. GitCode should avoid importing GitHub-specific GraphQL,
reviewer/team/project, merge queue, Copilot generation, template, and GitHub
remote abstractions in the first version.

## Scope

### In Scope

- Add a `GitCode: Create Pull Request` command.
- Add a create action in the pull request view title.
- Resolve the target repository from `GitCodeRepositoryResolver.resolveAll()`.
- Use the active local branch as the source branch by default.
- Use the repository detail and branch APIs to determine the target default
  branch.
- Allow users to edit title, body, source branch, target branch, draft state,
  labels, milestone, assignees, testers, source branch deletion, squash, squash
  commit message, and close-related-issue options.
- Provide branch, label, milestone, assignee, and tester picker/autocomplete
  data from GitCode APIs.
- Allow creating a new remote source branch from an existing GitCode ref before
  creating the pull request.
- Use the compare API to detect whether the source branch has commits relative
  to the target branch and to prefill title/body.
- Use the list pull requests API to warn when an open pull request already
  exists for the selected base/head pair.
- Detect and handle missing upstream branches before calling the API.
- Create same-repository pull requests.
- Support cross-repository pull requests only when the local remotes provide
  enough owner/repository information to build `head` and `fork_path`.
- Show loading, validation, unauthenticated, unsupported repository, and API
  error states.
- Refresh the pull request tree after successful creation.
- Open the created pull request overview panel when the response can be mapped
  to a pull request number.

### Out of Scope

- Full GitHub-style create experience parity.
- Reviewers selected from GitCode teams or project metadata beyond GitCode user
  search results.
- Projects, merge queue, auto merge, and pre-review.
- Pull request templates.
- AI-generated title or description.
- Creating branches from issues.
- Editing local files from the create view before creation.
- Revert pull request flow.
- A complete fork discovery API. Cross-repository creation should stay
  conservative until GitCode fork metadata is modeled.

## User Experience

The pull request view title should expose a create action:

```text
Pull Requests        +   refresh
```

The command should also be available from the command palette:

```text
GitCode: Create Pull Request
```

The create flow should use a focused side bar webview form instead of a
multi-step QuickPick flow or a main-editor webview panel. This matches the
GitHub extension's create webview pattern and keeps the editor area available
for code, diffs, and review context while advanced options remain visible.

Recommended form fields:

```text
Create Pull Request

Repository      owner/repo
Source          feature-branch
Target          main
Title           Add login callback validation
Description     ...

[ ] Draft
[ ] Delete source branch after merge
[ ] Squash commits
[ ] Close related issue after merge

Labels          bug,performance
Milestone       MindStudio 26.2.0
Assignees       user1,user2
Testers         user3
Squash message  ...

[Create Pull Request]
```

Validation should run before submission:

- repository must resolve to exactly one selected GitCode repository or the user
  must choose from the resolved repositories
- source branch and target branch are required
- source branch and target branch cannot be equal
- source branch and target branch must exist in the relevant GitCode branch
  list when the branch APIs return results, except that the active local branch
  may be shown as an unpublished source branch and must be published before the
  create API is called
- title is required unless an issue ID is provided and GitCode can autofill the
  title from that issue
- comma-separated user and label fields should be trimmed and sent without empty
  values
- selected labels and milestones should be sent using the GitCode API field
  format documented by the create endpoint
- draft, squash, prune-source-branch, and close-related-issue values should be
  sent as booleans

If no GitCode repository is resolved:

```text
This workspace is not connected to a GitCode repository.
Configure gitcode.repository or add a GitCode remote.
```

If the active branch has unpushed commits, ask before creation:

```text
The source branch has unpushed commits. Push before creating the pull request?
```

Actions:

- `Push Commits`
- `Continue Without Pushing`
- `Cancel`

If the source branch has no upstream remote branch, ask whether to publish it:

```text
There is no remote branch for feature-branch. Publish it before creating the pull request?
```

Actions:

- `Publish Branch`
- `Cancel`

The create API should only be called after required branch publishing or after
the user explicitly continues without pushing.

If the user types a source branch that does not exist on GitCode but should be
created from an existing remote ref, ask whether to create it:

```text
Source branch new-feature does not exist on GitCode. Create it from main?
```

Actions:

- `Create Branch`
- `Cancel`

This branch creation path is for remote-only branch creation from an existing
GitCode ref. If the user has local commits on the active branch, the extension
must still use git push to publish those commits.

After success:

- show `GitCode pull request #123 created`
- refresh the pull request tree
- open the created pull request overview panel when the response includes `iid`,
  `number`, or `id`
- otherwise open the created pull request URL in the browser if `web_url` is
  present

## Supporting API Contract

The create flow should use these APIs before calling the create endpoint:

| Purpose                                   | API doc                                                                  | Endpoint                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| Repository metadata and default branch    | [get-a-repository-api.md](../api/get-a-repository-api.md)                   | `GET /api/v5/repos/:owner/:repo`                       |
| Source/target branch pickers              | [list-all-branch-api.md](../api/list-all-branch-api.md)                     | `GET /api/v5/repos/:owner/:repo/branches`              |
| Create remote source branch               | [create-new-branch-api.md](../api/create-new-branch-api.md)                 | `POST /api/v5/repos/:owner/:repo/branches`             |
| Commit comparison and title/body defaults | [compare-branch-api.md](../api/compare-branch-api.md)                       | `GET /api/v5/repos/:owner/:repo/compare/:base...:head` |
| Label picker                              | [list-labels-api.md](../api/list-labels-api.md)                             | `GET /api/v5/repos/:owner/:repo/labels`                |
| Milestone picker                          | [list-repository-milestone-api.md](../api/list-repository-milestone-api.md) | `GET /api/v5/repos/:owner/:repo/milestones`            |
| Assignee/tester picker                    | [list-members-api.md](../api/list-members-api.md)                           | `GET /api/v5/repos/:owner/:repo/collaborators`         |
| Existing pull request warning             | [../list-pull-requests/api.md](../list-pull-requests/api.md)                | `GET /api/v5/repos/:owner/:repo/pulls`                 |

The view layer should not call these APIs directly. Add service methods and
mappers so the create model works with normalized domain models.

Suggested service surface:

```ts
repositoryService.getRepository(repository): Promise<GitCodeRepositoryDetail>;
repositoryService.listBranches(repository, options): Promise<GitCodeBranch[]>;
repositoryService.createBranch(repository, { refs, branchName }): Promise<GitCodeBranch[]>;
repositoryService.compareBranches(repository, base, head): Promise<GitCodeCompareResult>;
repositoryService.listLabels(repository): Promise<GitCodeLabel[]>;
repositoryService.listMilestones(repository, { state: 'open' }): Promise<GitCodeMilestone[]>;
repositoryService.listMembers(repository, options): Promise<GitCodeUser[]>;
pullRequestService.listPullRequests(repository, { state: 'open', base });
```

Use repository collaborators from the selected target repository for assignee
and tester pickers. The picker can filter loaded members client-side by `login`,
`username`, `name`, or `nick_name`; it should not call the global user search
endpoint for create-PR assignee/tester choices.

Use `GET /repos/:owner/:repo/pulls?state=open&base=<targetBranch>` to find
possible duplicates, then filter client-side by `source_branch`, `head.ref`, or
equivalent mapped source branch fields because the documented list API supports
`base` but does not document a `head` filter.

## API Contract

Use the endpoint from [api.md](api.md):

```text
POST /api/v5/repos/:owner/:repo/pulls
```

The service call should be:

```ts
pullRequestService.createPullRequest(repository, {
  title,
  head,
  base,
  body,
  milestoneNumber,
  labels,
  issue,
  assignees,
  testers,
  pruneSourceBranch,
  draft,
  squash,
  squashCommitMessage,
  forkPath,
  closeRelatedIssue,
});
```

`GitCodeClient` remains responsible for authentication and base URL handling.
The view layer must not pass `access_token` or construct raw URLs.

Request mapping:

```text
title                 -> title
head                  -> head
base                  -> base
body                  -> body
milestoneNumber       -> milestone_number
labels                -> labels
issue                 -> issue
assignees             -> assignees
testers               -> testers
pruneSourceBranch     -> prune_source_branch
draft                 -> draft
squash                -> squash
squashCommitMessage   -> squash_commit_message
forkPath              -> fork_path
closeRelatedIssue     -> close_related_issue
```

Same-repository pull requests should send:

```text
head = sourceBranch
base = targetBranch
fork_path omitted
```

Cross-repository pull requests should send:

```text
head = sourceOwner:sourceBranch
base = targetBranch
fork_path = sourceOwner/sourceRepo
```

The create response should be mapped to a normalized
`CreatedPullRequestSummary`. Minimum fields needed after creation:

- `id`
- `number`
- `title`
- `state`
- `url`
- `sourceBranch`
- `targetBranch`
- `isDraft`
- `author`

The mapper should tolerate GitCode's merge-request-shaped response:

- `iid` is the user-visible pull request number
- `description` or `body` is the pull request body
- `source_branch` and `target_branch` are branch names
- `web_url` is the browser URL
- `work_in_progress` can imply draft/WIP when `draft` is missing

## Architecture

Follow this flow:

```text
VS Code command / view title
  -> CreatePullRequestHelper
  -> CreatePullRequestDataModel
  -> Repository/User/PullRequest services for initialization data
  -> CreatePullRequestViewProvider side bar webview
  -> PullRequestService
  -> GitCodeClient
  -> PullRequestTreeStore refresh
  -> PullRequestOverviewPanel
```

Dependency rules:

- `view` may depend on `common`, `authentication`, and `gitcode/services`.
- `view` must not depend on raw GitCode create response DTOs.
- `gitcode` must not depend on `view`.
- Branch and repository selection state belongs in the create data model.
- API request construction belongs in `PullRequestService`.
- Response normalization belongs in a GitCode mapper.

The GitHub extension reference splits responsibilities well:

- `CreatePullRequestHelper` owns the active create session, context keys,
  command registrations, and disposal.
- `CreatePullRequestDataModel` owns base/compare branch state, change events,
  commit/diff defaults, and branch-derived title/body hints.
- `CreatePullRequestViewProvider` owns webview initialization, form messages,
  validation, push/publish prompts, and post-create behavior.

GitCode should use the same split with GitCode names and simplified behavior.

## Proposed Files

Create or update:

```text
src/
  common/
    constants.ts
    models.ts
    git/gitTypes.ts
  gitcode/
    mappers/
      pullRequestMapper.ts
      repositoryMapper.ts
      branchMapper.ts
      compareMapper.ts
      labelMapper.ts
      milestoneMapper.ts
      userMapper.ts
    services/
      pullRequestService.ts
      repositoryService.ts
  view/
    createPullRequest/
      createPullRequestHelper.ts
      createPullRequestDataModel.ts
      createPullRequestViewProvider.ts
      createPullRequestHtml.ts
    commands/
      registerCreatePullRequestCommands.ts
    viewController.ts
package.json
```

Suggested constants:

```ts
createPullRequest: 'gitcode.createPullRequest',
createPullRequestView: 'gitcode:createPullRequestWebview',
```

The webview can initially use inline generated HTML from
`createPullRequestHtml.ts`. A bundled frontend entry can be added later if the
form grows complex.

## Domain Model

Suggested model additions:

```ts
export interface CreatePullRequestInput {
  title: string;
  head: string;
  base: string;
  body?: string;
  milestoneNumber?: number;
  labels?: string;
  issue?: string;
  assignees?: string;
  testers?: string;
  pruneSourceBranch?: boolean;
  draft?: boolean;
  squash?: boolean;
  squashCommitMessage?: string;
  forkPath?: string;
  closeRelatedIssue?: boolean;
}

export interface CreatedPullRequestSummary {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author: PullRequestParticipant;
  sourceBranch: string;
  targetBranch: string;
  body: string;
  url?: string;
  isDraft: boolean;
}

export interface GitCodeRepositoryDetail {
  id: number;
  fullName: string;
  name: string;
  path: string;
  defaultBranch: string;
  webUrl: string;
  fork: boolean;
}

export interface GitCodeBranch {
  name: string;
  sha?: string;
  isDefault: boolean;
  isProtected: boolean;
  lastCommitMessage?: string;
}

export interface GitCodeCompareResult {
  baseSha?: string;
  mergeBaseSha?: string;
  commits: GitCodeCompareCommit[];
  files: GitCodeCompareFile[];
  truncated: boolean;
}

export interface GitCodeCompareCommit {
  sha: string;
  message: string;
  authorName?: string;
}

export interface GitCodeCompareFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
}

export interface GitCodeLabel {
  id: number;
  name: string;
  color?: string;
  description?: string;
}

export interface GitCodeMilestone {
  number: number;
  title: string;
  state: string;
  dueOn?: string;
}

export interface GitCodeUser {
  id: string;
  login: string;
  name?: string;
  htmlUrl?: string;
}
```

`CreatedPullRequestSummary` can be merged with `PullRequestDetail` later if the
create endpoint response proves stable enough to reuse the full detail mapper.

## Create Data Model

`CreatePullRequestDataModel` should be the source of truth for the active form.

Suggested class surface:

```ts
export interface CreatePullRequestDefaults {
  repository: GitCodeRepository;
  repositoryDetail: GitCodeRepositoryDetail;
  sourceBranches: GitCodeBranch[];
  targetBranches: GitCodeBranch[];
  labels: GitCodeLabel[];
  milestones: GitCodeMilestone[];
  sourceBranch: string;
  targetBranch: string;
  title: string;
  body: string;
  duplicateWarning?: string;
}

export interface CreatePullRequestStateChange {
  repository?: GitCodeRepository;
  sourceBranch?: string;
  targetBranch?: string;
  title?: string;
  body?: string;
  warning?: string;
}

export class CreatePullRequestDataModel {
  readonly onDidChange: vscode.Event<CreatePullRequestStateChange>;

  initialize(): Promise<CreatePullRequestDefaults>;
  setRepository(repository: GitCodeRepository): Promise<void>;
  setSourceBranch(branch: string): Promise<void>;
  setTargetBranch(branch: string): Promise<void>;
  createSourceBranch(refs: string, branchName: string): Promise<GitCodeBranch[]>;
  listMembers(): Promise<GitCodeUser[]>;
  validate(input: CreatePullRequestInput): string[];
  ensureSourceBranchPublished(input: CreatePullRequestInput): Promise<boolean>;
}
```

Default title/body rules:

1. Call the compare API for `targetBranch...sourceBranch`.
2. If the compare result has exactly one non-merge commit, use that commit
   title and body.
3. If there are multiple commits, use a readable source branch name as the
   title.
4. If the compare API is unavailable or returns no usable commits, use the
   source branch name as the title.
5. Leave body empty unless a single commit body is available.

This mirrors the useful GitHub extension behavior while using GitCode's compare
API instead of local-only git logs.

Initialization data should be cached for the lifetime of the create session:

- repository detail
- branch lists for target and source repositories
- labels
- open milestones

User search should be debounced and query-driven instead of preloading all
users.

## Branch And Remote Handling

Repository resolution should start with `GitCodeRepositoryResolver.resolveAll()`.

The create flow should model GitHub Pull Requests' terminology and interaction:

- **Base repository**: the repository receiving the pull request.
- **Base branch**: the target branch that changes will merge into.
- **Compare repository**: the repository containing the source branch.
- **Compare branch**: the source branch being proposed for merge.

The side bar form should expose both repository selectors and both branch
selectors, not hide repository choice behind remote priority. Defaults can be
inferred, but the user must be able to change them before submitting.

Recommended selector layout:

```text
Base      org/project        main
Compare   owner/fork         feature-branch
```

Default selection rules:

1. Resolve all GitCode remotes from the active repository.
2. Use the active local branch as the default compare branch.
3. Use the active branch upstream remote as the default compare repository when
   it resolves to a GitCode repository.
4. If there is no upstream remote, use `origin` as the default compare
   repository when it resolves to GitCode.
5. Use `upstream` as the default base repository when present and different from
   compare; otherwise use the compare repository.
6. Use the base repository default branch from `GET /repos/:owner/:repo` as the
   default base branch.
7. If several plausible base or compare repositories exist, preselect the best
   default but leave the selector editable.

Branch data should come from both the VS Code Git API and GitCode APIs:

- active local branch: `repository.state.HEAD.name`
- upstream remote: `repository.state.HEAD.upstream`
- local remotes: `repository.state.remotes`
- push/publish: `repository.push(remoteName, branchName, true)` using the VS Code
  Git API repository for the active workspace
- base branch picker: `GET /repos/:baseOwner/:baseRepo/branches`
- compare branch picker: `GET /repos/:compareOwner/:compareRepo/branches`

Remote branch data for pickers and validation should come from the selected base
and compare repositories. The active local branch is still the default compare
branch because the user is creating a pull request from their current work. If
the active local branch is missing from the compare repository branch list,
include it in the compare branch picker as an unpublished local branch so
validation can proceed to the publish prompt instead of blocking submission.

Remote priority should only be used to choose defaults, not to remove user
choice:

1. branch upstream remote
2. `origin`
3. `upstream`
4. all other remotes

Same-repository PRs are represented by selecting the same repository for base
and compare. Cross-repository PRs are represented by selecting different base
and compare repositories. The create request should be built from the selected
repositories:

```text
same repository:
  head = compareBranch
  base = baseBranch
  fork_path omitted

cross repository:
  head = compareOwner:compareBranch
  base = baseBranch
  fork_path = compareOwner/compareRepo
```

When either repository selector changes:

- refresh the branch list for that repository
- preserve the currently selected branch when it still exists
- otherwise select the repository default branch for base, or the active local
  branch/first available branch for compare
- recompute compare data, title/body defaults, changed files, and duplicate PR
  warnings for the selected base/compare pair

Duplicate PR detection should use the selected base repository and branch, then
filter returned open pull requests by compare repository and compare branch when
the API response includes source repository metadata. If the response only
includes `source_branch`, warn on branch-name matches and phrase the warning as
best-effort.

If the selected compare branch does not exist remotely, the extension has two
different paths:

1. For local branches with local commits, use git push to publish the local
   branch and preserve the user's commits.
2. For remote-only branch creation, call
   `POST /repos/:owner/:repo/branches` with:

```json
{
  "refs": "main",
  "branch_name": "new-feature"
}
```

The create-branch API response is a branch list, so the mapper should reuse the
same `GitCodeBranch[]` mapping as the list-branches API and refresh the
create-session branch cache after success.

For cross-repository branch pickers:

- base branches come from the selected base repository
- compare branches come from the selected compare repository
- compare should use the base repository endpoint with
  `base = baseBranch` and `head = compareOwner:compareBranch` if GitCode accepts
  owner-qualified heads; otherwise skip compare and rely on create API
  validation for cross-repository PRs

If the active branch is missing, show:

```text
Cannot create a pull request because there is no active branch.
```

If the selected compare repository does not match any local push remote and the
compare branch is unpublished, show:

```text
Cannot publish the compare branch because no matching GitCode push remote was found.
```

## View Provider

`CreatePullRequestViewProvider` should register a contributed side bar
`WebviewViewProvider` with the ID `gitcode:createPullRequestWebview`.

The create UI must live in the GitCode Pull Requests activity bar container, not
in the main editor area. Opening Create Pull Request should reveal and focus the
side bar create view so users can keep source files, diffs, and pull request
context open in editor tabs while filling out the form.

Implementation requirements:

- contribute a `gitcode:createPullRequestWebview` view under the existing
  `gitcode-pull-requests` views container
- register it with `vscode.window.registerWebviewViewProvider`
- use `WebviewView.resolveWebviewView` lifecycle semantics instead of
  `vscode.window.createWebviewPanel`
- initialize or refresh form state when the command reveals the view
- keep the active create session owned by `CreatePullRequestHelper`
- reset transient create state when the active repository or source branch
  changes

Message protocol:

```ts
type CreatePullRequestMessage =
  | { command: 'initialize' }
  | { command: 'changeSourceBranch'; branch: string }
  | { command: 'changeTargetBranch'; branch: string }
  | { command: 'createSourceBranch'; refs: string; branchName: string }
  | { command: 'filterMembers'; query: string }
  | { command: 'refreshMetadata' }
  | { command: 'submit'; input: CreatePullRequestInput }
  | { command: 'openExternal'; url: string };
```

Provider responsibilities:

- send initialization data to the webview
- render branch, label, milestone, assignee, and tester options from normalized
  service results
- receive form updates and submit messages
- call data-model validation
- ask push/publish prompts through VS Code UI
- call the create-branch service when the user explicitly creates a remote
  branch from an existing ref
- call `PullRequestService.createPullRequest`
- show progress while creating
- notify helper when creation completes
- dispose or reset the active create session when the side bar view is disposed
  or reinitialized

## Commands And Contributions

Add command:

```json
{
  "command": "gitcode.createPullRequest",
  "title": "GitCode: Create Pull Request",
  "icon": "$(add)"
}
```

Add pull request view title menu item:

```json
{
  "command": "gitcode.createPullRequest",
  "when": "view == pr:gitcode",
  "group": "navigation@1"
}
```

Move refresh to `navigation@2` so create is the first action.

Add a contributed side bar view under `gitcode-pull-requests`:

```json
{
  "id": "gitcode:createPullRequestWebview",
  "name": "Create Pull Request",
  "type": "webview"
}
```

The command must reveal this view when the user runs
`GitCode: Create Pull Request`.

`ViewController` should construct one `CreatePullRequestHelper`, register the
side bar webview provider, and register the create command with the command
registration disposable set.

## Service Design

Add to `PullRequestService`:

```ts
async createPullRequest(
  repository: GitCodeRepository,
  input: CreatePullRequestInput,
): Promise<CreatedPullRequestSummary> {
  const response = await this.client.post<any>(
    `/api/v5/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls`,
    mapCreatePullRequestInput(input),
  );

  return mapCreatedPullRequest(response);
}
```

`GitCodeClient` currently has `get` usage in the service layer. If it does not
already expose `post`, add a generic `post<T>(path, body, query?)` method that
uses the same authentication, base URL, error handling, and tracing behavior as
`get`.

Do not put create-specific URL or token logic in the command or view provider.
The API docs show both `access_token` query usage and `private-token` header
usage for different endpoints. Keep that difference behind `GitCodeClient` so
feature code uses one authenticated client abstraction.

Add supporting service methods:

```ts
export class RepositoryService {
  getRepository(repository: GitCodeRepository): Promise<GitCodeRepositoryDetail>;
  listBranches(repository: GitCodeRepository, options?: PageOptions): Promise<GitCodeBranch[]>;
  createBranch(
    repository: GitCodeRepository,
    input: { refs: string; branchName: string },
  ): Promise<GitCodeBranch[]>;
  compareBranches(
    repository: GitCodeRepository,
    base: string,
    head: string,
  ): Promise<GitCodeCompareResult>;
  listLabels(repository: GitCodeRepository, options?: PageOptions): Promise<GitCodeLabel[]>;
  listMilestones(
    repository: GitCodeRepository,
    options?: { state?: 'open' | 'closed' | 'all' } & PageOptions,
  ): Promise<GitCodeMilestone[]>;
  listMembers(repository: GitCodeRepository, options?: PageOptions): Promise<GitCodeUser[]>;
}
```

`RepositoryService` can be one service for the first implementation because the
metadata is used by one feature. Split it later only if these APIs become shared
widely across tree, overview, and create flows.

## State And Refresh

After a successful create:

1. Clear the active create helper session.
2. Call `PullRequestTreeStore.refreshRepository(repository.fullName)` when the
   repository is still available in the tree.
3. Fall back to `PullRequestTreeStore.refreshAll()`.
4. Open `PullRequestOverviewPanel` with the created PR number when possible.

The create flow does not need its own long-lived store. Its state is short-lived
and belongs to the helper/data-model/provider session.

## Error Handling

Show user-facing messages for:

- unauthenticated session
- no active git repository
- no active branch
- no GitCode repository resolved
- missing matching push remote for publish
- remote branch creation failure
- source branch equals target branch
- missing title
- no branch comparison commits when the compare API returns an empty commit list
- duplicate open pull request warning when the list PR API finds the same base
  and source branch
- API validation failure
- network or authentication failure

Log diagnostic details through `Logger`, but keep webview error text concise.

API errors should preserve GitCode response messages when available. If the
server returns a duplicate/open-existing-PR error, show the server message and do
not refresh the tree unless the response includes a created pull request.

## Testing

Unit tests:

- create request payload maps camelCase fields to GitCode API field names
- create response maps `iid`, `description`, `source_branch`, `target_branch`,
  `web_url`, and `work_in_progress`
- repository detail maps `default_branch` and `web_url`
- branch list maps `name`, `commit.sha`, `default_branch`, and `protected`
- create branch maps the returned branch list and refreshes the session branch
  cache
- compare maps commit messages, files, and `truncated`
- labels map `name` and `color`
- milestones map `number`, `title`, `state`, and `due_on`
- repository member mapping uses `login`, `username`, `name`, `nick_name`, and `web_url`
- validation rejects missing title, missing branches, and identical branches
- validation rejects branches absent from loaded branch lists
- repository selection uses the resolver output and handles multiple repos
- same-repository `head` omits owner
- cross-repository `head` includes `owner:branch` and sends `fork_path`
- duplicate PR detection filters list results by source branch after requesting
  open PRs for the selected base branch

Command/provider tests:

- unauthenticated command triggers sign-in or shows sign-in state
- initialization loads repository detail, branches, labels, milestones, and
  duplicate warning data
- creating a remote source branch calls the create-branch service with `refs`
  and `branchName`
- assignee/tester filtering uses the repository member list for the selected
  target repository
- successful create refreshes the tree store
- successful create opens the overview when a PR number is available
- API failure leaves the create panel open and shows an error

Manual verification:

1. Sign in with a GitCode PAT.
2. Open a workspace with a GitCode remote.
3. Create a local branch with one commit.
4. Run `GitCode: Create Pull Request`.
5. Confirm target branch, labels, milestones, assignee/tester member pickers, and
   title/body defaults.
6. Confirm duplicate warning behavior by creating from a branch with an existing
   open PR.
7. Publish/push when prompted.
8. Submit the form.
9. Confirm the pull request appears in the tree and opens in the overview.

## Implementation Order

1. Add models and mapper coverage for create request/response.
2. Add models and mapper coverage for repository detail, branches, compare,
   labels, milestones, and repository members.
3. Add `GitCodeClient.post` if missing.
4. Add `PullRequestService.createPullRequest`.
5. Add `RepositoryService`, including list/create branch support and repository
   member loading for assignee/tester pickers.
6. Add `CreatePullRequestDataModel` with repository, branch, metadata defaults,
   duplicate detection, and validation.
7. Add `CreatePullRequestViewProvider` and simple webview HTML.
8. Add `CreatePullRequestHelper` and command registration.
9. Wire side bar view contribution, command contribution, provider registration,
   and `ViewController`.
10. Add tests.
11. Manually verify same-repository creation from the side bar while editor tabs
    remain open.

## Open Questions

- Should `issue` be exposed as a first-version field, or deferred until issue
  linking behavior is verified against GitCode? Yes
- Does `draft: true` always map to `work_in_progress: true` in the response, or
  can GitCode return both fields? No
- What exact Git API push signature is available in the minimum supported VS
  Code version for publishing a new upstream branch? no
- Does the compare API accept `owner:branch` for cross-repository comparisons,
  or only branch names in the target repository? Treat owner-qualified compare
  as best-effort; if it fails, leave changed files empty and let the create API
  validate the cross-repository PR. Not support now
