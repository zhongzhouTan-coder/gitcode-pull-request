# Create Issue Design

## Goal

Add a GitCode issue creation flow for the current workspace repository.

The feature must:

- resolve the target GitCode repository from the current git repository using
  the same repository resolution rules as the issue and pull request trees
- use the create issue API documented in [api.md](api.md)
- open a create form in the main editor area when the user clicks the create
  issue action
- allow the user to enter issue title, description, assignees, milestone,
  labels, private issue state, and issue template
- auto-detect common issue templates and let the user select one before
  submitting
- keep API access inside `gitcode/services/*`, not in the view layer
- refresh the issue tree after successful creation
- open the created issue overview panel after success when the response can be
  mapped to an issue number

The implementation should reuse the existing issue list/detail architecture and
the create pull request flow where useful. GitCode should keep a smaller create
issue surface than create pull request because issue creation does not require
branch, diff, duplicate pull request, or local git publishing state.

## Scope

### In Scope

- Add a `GitCode: Create Issue` command.
- Add a create action in the Issues view title.
- Resolve repositories with `GitCodeRepositoryResolver.resolveAll()`.
- If multiple GitCode repositories are available, ask the user to choose the
  target repository before opening the form.
- Open a `vscode.WebviewPanel` in the main editor area for the create form.
- Load labels, milestones, and repository members for form pickers from existing
  repository APIs.
- Auto-detect issue templates from documented GitCode template locations.
- Allow selecting one detected issue template from the form.
- Prefill the description from the selected template when template content can
  be read.
- Support manually typed comma-separated labels and assignees.
- Support optional `security_hole` and `template_path` fields from the API.
- Validate required fields before submitting.
- Create issues in the selected repository.
- Show loading, validation, unauthenticated, unsupported repository, and API
  error states.
- Refresh the issue tree after successful creation.
- Open the created issue overview panel when the response includes a usable
  `number`, `iid`, or `id`.
- Fall back to opening the created issue URL in the browser when only a URL is
  available.

### Out of Scope

- Editing issue templates.
- Creating or editing issue template files.
- Full organization-template discovery when no documented organization template
  listing API is available.
- Creating labels, milestones, or users from the create form.
- Issue type, priority, workflow state, or custom field editing unless the
  create API later documents those fields.
- Attachment upload.
- Draft issue support.
- Branch-from-new-issue workflow.
- AI-generated title or description.
- Offline draft persistence.

## User Experience

The Issues view title should expose a create action:

```text
Issues        +   refresh
```

The command should also be available from the command palette:

```text
GitCode: Create Issue
```

When invoked, repository resolution runs first. If one GitCode repository is
resolved, the form opens immediately. If multiple repositories are resolved, the
user selects one:

```text
Select a repository to create the issue in
  owner/repo-a (origin)
  owner/repo-b (upstream)
```

If no GitCode repository is resolved:

```text
This workspace is not connected to a GitCode repository.
Configure gitcode.repository or add a GitCode remote.
```

The form should open as a main editor webview panel, not as a sidebar webview
view. This matches the requested journey and gives the markdown description
editor enough space.

Recommended form:

```text
Create Issue

Repository      owner/repo
Title           Issue title
Description     ...

Labels          bug,performance
Milestone       MindStudio 26.2.0
Assignees       user1,user2
Template        Bug report
Template path   .gitcode/ISSUE_TEMPLATE/bug.md

[ ] Private issue

[Create Issue] [Cancel]
```

Validation should run before submission:

- repository is required
- title is required after trimming
- description is optional and should submit as an empty string when omitted
- labels should be trimmed, deduplicated, and sent as a comma-separated string
  without empty values
- assignees should be trimmed, deduplicated, and sent as a comma-separated
  string without empty values
- milestone should be omitted or sent as the selected milestone `number`
- `security_hole` should submit as a boolean
- selected template path should be sent as `template_path`
- manually entered `template_path` should be trimmed and omitted when empty

Template behavior:

- show a template picker when one or more templates are detected
- show `No template` as the first option
- keep an advanced/manual `Template path` field for paths that auto-detection
  misses
- when a detected template is selected, fill `template_path` with that path
- when template content is available and the description is empty, prefill the
  description with the template markdown
- when the description already has user edits, ask before replacing it with a
  newly selected template
- when the user chooses `No template`, clear `template_path` and leave the
  current description unchanged

After the user submits:

- disable the create button while the request is in flight
- keep the form open on validation or API failure
- show an inline error in the form and a VS Code error notification for
  submission failures
- close or replace the form after success

After success:

```text
GitCode issue #123 created
```

Then:

- refresh the selected repository in the issue tree, falling back to full issue
  tree refresh when repository-specific refresh fails
- open the issue overview panel for the created issue when possible
- otherwise open `html_url`, `web_url`, or the derived web URL in the browser

## Supporting API Contract

Use these APIs to populate the form before calling the create endpoint:

| Purpose | API doc | Endpoint |
| --- | --- | --- |
| Repository metadata, default branch, and template source hint | [../api/get-a-repository-api.md](../api/get-a-repository-api.md) | `GET /api/v5/repos/:owner/:repo` |
| Label picker | [../api/list-labels-api.md](../api/list-labels-api.md) | `GET /api/v5/repos/:owner/:repo/labels` |
| Milestone picker | [../api/list-repository-milestone-api.md](../api/list-repository-milestone-api.md) | `GET /api/v5/repos/:owner/:repo/milestones` |
| Assignee picker | [../api/list-members-api.md](../api/list-members-api.md) | `GET /api/v5/repos/:owner/:repo/collaborators` |
| Template content, best effort | [../get-file-changes/file-content-api.md](../get-file-changes/file-content-api.md) | `GET https://raw.gitcode.com/:owner/:repo/raw/:sha/:path` |

The view layer should not call these APIs directly. Existing
`RepositoryService` methods already expose these supporting reads:

```ts
repositoryService.listLabels(repository, { perPage: 100 });
repositoryService.listMilestones(repository, { state: 'open', perPage: 100 });
repositoryService.listMembers(repository, { perPage: 100 });
```

The create issue form can filter loaded labels and members client-side by
`name`, `login`, `username`, or `nick_name`. It should not call the global user
search endpoint in the first version.

Template detection needs one small addition. `RepositoryService.getRepository`
already reads repository metadata, but `GitCodeRepositoryDetail` should retain
the API's `issue_template_source` field as `issueTemplateSource?: 'project' |
'organization' | string`. Use the repository `defaultBranch` as the ref for
template content reads.

Because the current local API reference does not include a repository tree or
directory listing endpoint, the first version should use a deterministic
candidate-path scan:

```text
.gitcode/ISSUE_TEMPLATE.md
.gitcode/issue_template.md
.gitcode/ISSUE_TEMPLATE/bug.md
.gitcode/ISSUE_TEMPLATE/feature.md
.gitcode/ISSUE_TEMPLATE/question.md
.github/ISSUE_TEMPLATE.md
.github/issue_template.md
.github/ISSUE_TEMPLATE/bug.md
.github/ISSUE_TEMPLATE/feature.md
.github/ISSUE_TEMPLATE/question.md
.gitee/ISSUE_TEMPLATE.md
.gitee/issue_template.md
.gitee/ISSUE_TEMPLATE/bug.md
.gitee/ISSUE_TEMPLATE/feature.md
.gitee/ISSUE_TEMPLATE/question.md
```

Project templates support `.gitcode`, `.github`, and `.gitee` paths according
to the create API reference. Organization templates only support files under
the `.gitcode` directory of the `.gitcode` project; without a documented
organization-template listing endpoint, the first version should not attempt to
discover organization templates beyond project metadata hints. Users can still
enter an organization template path manually.

If a repository tree/list API is later documented, replace the candidate-path
scan with a directory listing over:

```text
.gitcode/
.gitcode/ISSUE_TEMPLATE/
.github/
.github/ISSUE_TEMPLATE/
.gitee/
.gitee/ISSUE_TEMPLATE/
```

Template detection must be best effort:

- ignore 404s for candidate paths
- log non-404 template read failures at debug level
- cap template content reads to markdown/text files
- avoid blocking issue creation when template detection fails
- cache detected templates per repository and default branch for the lifetime
  of the create panel

## API Contract

Use the endpoint from [api.md](api.md):

```text
POST /api/v5/repos/:owner/issues
```

The request body must include the repository path in `repo`:

```json
{
  "repo": "repo",
  "title": "Issue Title",
  "body": "Issue Description",
  "assignee": "user1,user2",
  "milestone": 557105,
  "labels": "bug,performance",
  "security_hole": false,
  "template_path": ""
}
```

The service call should be:

```ts
issueService.createIssue(repository, {
  title,
  body,
  assignees,
  milestoneNumber,
  labels,
  securityHole,
  templatePath,
});
```

`IssueService` should translate the normalized input into GitCode API field
names:

| Domain field        | API field         | Mapping                          |
| ------------------- | ----------------- | -------------------------------- |
| `repository.name` | `repo`          | required                         |
| `title`           | `title`         | trimmed string                   |
| `body`            | `body`          | string, default`''`            |
| `assignees`       | `assignee`      | comma-separated logins           |
| `milestoneNumber` | `milestone`     | number, omit or`0` when unset  |
| `labels`          | `labels`        | comma-separated names            |
| `securityHole`    | `security_hole` | boolean                          |
| `templatePath`    | `template_path` | string, omit or empty when unset |

`GitCodeClient` remains responsible for authentication and base URL handling.
The view layer must not pass `access_token` or construct raw API URLs.

The response should be mapped with the existing issue mapper where possible.
The create endpoint sample returns the same shape as an issue summary, including
`id`, `html_url`, `number`, `state`, `title`, `body`, `user`, `assignee`,
`assignees`, timestamps, and issue state metadata.

## Architecture

Recommended dependency direction:

```text
Command
  -> CreateIssueHelper
  -> GitCodeRepositoryResolver
  -> CreateIssuePanel
  -> CreateIssueDataModel
  -> RepositoryService / RawContentService / IssueService
  -> GitCodeClient

CreateIssueHelper
  -> IssueTreeStore
  -> IssueOverviewPanel
```

Responsibilities:

- `CreateIssueHelper` owns command orchestration, repository selection, panel
  creation, and success side effects.
- `CreateIssuePanel` owns the editor webview lifecycle and message routing.
- `CreateIssueDataModel` loads labels, milestones, and members and prepares
  defaults for the panel.
- `CreateIssueTemplateService` or a data-model helper detects candidate
  templates and optionally reads template markdown content.
- `IssueService` owns the create endpoint and maps the API response.
- `IssueTreeStore` remains the source of truth for issue list refresh state.
- `IssueOverviewPanel` handles the detail view after creation.

Dependency rules:

- `view` may depend on `common`, `authentication`, and `gitcode/services`.
- `view` must not depend on raw GitCode issue DTOs.
- `gitcode` must not depend on `view`.
- The webview must post normalized form input, not API field names.

## Proposed Files

Create or update:

```text
src/
  common/
    constants.ts                         # create issue command ID
    models.ts                            # CreateIssueInput and optional defaults
  gitcode/
    services/
      issueService.ts                    # createIssue endpoint access
    mappers/
      issueMapper.ts                     # reuse or extend for create response
      repositoryMapper.ts                # map issue_template_source
  view/
    viewController.ts                    # construct create issue helper
    commands/
      registerIssueCommands.ts           # register create issue command
    createIssue/
      createIssueDataModel.ts            # form defaults and picker data
      createIssueHelper.ts               # command orchestration and success flow
      createIssuePanel.ts                # WebviewPanel lifecycle
      createIssueHtml.ts                 # form HTML, CSS, and webview script
      createIssueTemplateService.ts      # best-effort template detection
```

Update `package.json`:

```json
{
  "command": "gitcode.createIssue",
  "title": "GitCode: Create Issue",
  "icon": "$(add)"
}
```

Add a view title menu contribution:

```json
{
  "command": "gitcode.createIssue",
  "when": "view == issues:gitcode",
  "group": "navigation@1"
}
```

Move refresh issues to `navigation@2` so the create action appears first.

## Domain Model

Suggested model additions:

```ts
export interface CreateIssueInput {
  title: string;
  body: string;
  assignees: string[];
  labels: string[];
  milestoneNumber?: number;
  securityHole: boolean;
  templatePath?: string;
}

export interface IssueTemplateOption {
  label: string;
  path: string;
  body?: string;
  source: 'project' | 'organization' | 'manual';
}

export interface CreateIssueDefaults {
  repository: GitCodeRepository;
  labels: GitCodeLabel[];
  milestones: GitCodeMilestone[];
  members: GitCodeUser[];
  templates: IssueTemplateOption[];
  title: string;
  body: string;
  assignees: string[];
  selectedLabels: string[];
  milestoneNumber?: number;
  securityHole: boolean;
  templatePath: string;
}
```

If `GitCodeLabel`, `GitCodeMilestone`, or `GitCodeUser` are already defined for
create pull request support, reuse those types instead of introducing
issue-specific duplicates.

## Data Model

Suggested class surface:

```ts
export class CreateIssueDataModel {
  constructor(
    private readonly repositoryService: RepositoryService,
    private readonly rawContentService: RawContentService,
    private readonly issueService: IssueService,
  ) {}

  initialize(repository: GitCodeRepository): Promise<CreateIssueDefaults>;
  createIssue(input: CreateIssueInput): Promise<IssueSummary>;
}
```

Initialization should:

- load repository detail, labels, milestones, members, and detected templates
  concurrently where possible
- tolerate picker API failures by returning an empty picker list and a warning
  string for the panel
- tolerate template detection failures by returning an empty template list and a
  non-blocking warning
- keep the selected repository fixed for the lifetime of the panel

Submission should:

- normalize and validate user input
- call `issueService.createIssue`
- return the mapped `IssueSummary`

## Webview Messages

Recommended messages from webview to extension:

```ts
type CreateIssueMessage =
  | { command: 'ready' }
  | { command: 'cancel' }
  | { command: 'selectTemplate'; templatePath: string }
  | { command: 'submit'; input: CreateIssueInput };
```

Recommended messages from extension to webview:

```ts
type CreateIssueViewMessage =
  | { command: 'loading' }
  | { command: 'initialize'; defaults: CreateIssueDefaults }
  | { command: 'validationError'; message: string }
  | { command: 'submitDone' }
  | { command: 'error'; message: string };
```

The panel should keep one active panel per extension host. Invoking the command
again should reveal the existing create issue panel and reinitialize it only
when the user selected a different repository.

## Error Handling

Recommended mapping:

| Error                    | User-facing behavior                                |
| ------------------------ | --------------------------------------------------- |
| No auth session          | Show`Sign in to GitCode to create issues`         |
| No active git repository | Show`Open a git repository to create an issue`    |
| No GitCode remote        | Show repository connection warning                  |
| Picker API failure       | Show form with empty picker data and inline warning |
| Template detection failure | Show form with `No template`; keep manual template path available |
| Template content read failure | Select template path but do not prefill description |
| Missing title            | Inline validation error; do not call API            |
| 401/403 create failure   | Show`GitCode authentication failed`               |
| Other create failure     | Show`Failed to create issue: <message>`           |

Do not show notifications for non-fatal picker loading failures unless the user
explicitly retries. Always show a notification for create submission failure
because it is the result of an explicit user action.

## Tests

Add focused tests for:

- `IssueService.createIssue` sends the documented endpoint and body fields.
- Create response maps to `IssueSummary`, including string `number`.
- Input normalization trims and deduplicates labels and assignees.
- Empty title blocks submission before the service is called.
- Template detection includes supported `.gitcode`, `.github`, and `.gitee`
  project paths.
- Selecting a template sends the selected path as `template_path`.
- Selecting a template preloads description only when template content is
  available.
- `CreateIssueHelper` refreshes the issue tree and opens the overview panel on
  success.
- `CreateIssueHelper` falls back to opening the created issue URL when no issue
  number can be derived.

Manual verification:

- click the Issues view create action
- select a repository when multiple repositories are present
- submit a minimal issue with only title and description
- submit an issue with labels, milestone, assignees, and private issue checked
- verify the issue tree refreshes
- verify the created issue opens in the main issue overview
