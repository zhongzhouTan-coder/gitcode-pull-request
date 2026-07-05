# Pull Request Participant Collaborator Design

## Goal

Use repository collaborators as the single participant source for pull request
reviewers, testers, and assignees.

The current implementation mixes multiple selection sources:

- reviewers from `option_reviewers`
- testers from `option_testers`
- assignees from repository collaborators

This design removes that split. The extension should fetch all collaborators
from the repository collaborators API, preserve each collaborator's role
metadata, and derive reviewer, tester, and assignee eligibility locally from
role permission defaults.

## Scope

### In Scope

- load all repository collaborators from `GET /api/v5/repos/:owner/:repo/collaborators`
- preserve collaborator role metadata such as `role_name` and `access_level`
- derive selectable reviewers, testers, and assignees from collaborator roles
- reuse the same collaborator source in pull request overview selectors
- reuse the same collaborator source in create pull request assignee and tester
  pickers
- add tests that cover pagination, role mapping, and participant filtering

### Out of Scope

- changing reviewer, tester, or assignee mutation APIs
- changing permission checks for whether the current user may edit a pull
  request
- changing issue assignee selection

## API Source

Selection source:

```text
GET /api/v5/repos/:owner/:repo/collaborators
```

Relevant response fields already documented in
[list repo members API](../api/list-repo-members-api.md):

- `login`
- `nick_name`
- `web_url`
- `role_name`
- `role_name_cn`
- `access_level`

The extension should page through the collaborator API until exhaustion so the
local selector is built from the full collaborator set rather than only the
first page.

## Eligibility Rules

Collaborator roles are mapped into the existing role-permission model. The
selector rules are:

| Participant type | Role requirement |
| --- | --- |
| Reviewer | `pr:review` |
| Tester | `pr:test` |
| Assignee | `pr:approve` |

This uses the existing role default matrix in
[role-permission](../role-permission/role-permission.md).

Examples:

- `Owner` and `Maintainer` can be assignees, reviewers, and testers
- `Developer` can be reviewers and testers, but not assignees
- `Reporter` can be testers, but not reviewers or assignees
- `Guest` is excluded from all three pull request participant selectors

The pull request author and already assigned participants continue to be
filtered by the existing UI logic after the role-based candidate list is built.
That means the creator of a pull request cannot review, test, or approve the
same pull request even when their repository role would otherwise allow it.

## Design

### Data Mapping

`mapUser()` should preserve collaborator role metadata on `GitCodeUser`:

```text
role_name      -> user.role.name
role_name_cn   -> user.role.displayName
access_level   -> user.role.accessLevel
```

This keeps role interpretation in extension code instead of depending on raw API
DTOs at the view layer.

### Collaborator Loading

`RepositoryService.listMembers()` becomes the canonical collaborator loader for
participant selection and must fetch all pages.

Flow:

```text
RepositoryService.listMembers
  -> listPagedRecords(...)
  -> mapUsers(...)
  -> GitCodeUser[]
```

### Participant Derivation

Add a shared helper that takes collaborator `GitCodeUser[]` and returns:

- reviewer candidates
- tester candidates
- assignee candidates

The helper uses `roleCanByDefault()` with the corresponding permission
requirement for each participant type.

### Overview Flow

```text
PullRequestOverviewPanel
  -> PullRequestOverviewStore.listSelectableReviewers/Testers/Assignees
  -> RepositoryService.listMembers
  -> role-based participant helper
  -> quick pick filtering for author/current assignments
```

`PullRequestOverviewStore` no longer depends on reviewer/tester option-list APIs
for candidate selection.

### Create Pull Request Flow

The create pull request webview should no longer use one shared `members` list
for both assignee and tester pickers.

Instead it should receive:

- `assigneeMembers`
- `testerMembers`

This keeps role-based differences intact, especially because tester eligibility
is broader than assignee eligibility.

## Files

Updated:

```text
src/common/models.ts
src/gitcode/mappers/userMapper.ts
src/gitcode/services/repositoryService.ts
src/view/overview/pullRequestOverviewStore.ts
src/view/createPullRequest/createPullRequestDataModel.ts
src/view/createPullRequest/createPullRequestViewProvider.ts
src/view/createPullRequest/createPullRequestHtml.ts
src/view/permissions/participantRoleEligibility.ts
src/test/userMapper.test.ts
src/test/repositoryService.test.ts
src/test/rolePermissionProfiles.test.ts
src/test/pullRequestOverviewStore.test.ts
src/test/createPullRequestDataModel.test.ts
```

## Validation

Required coverage:

- collaborator pagination returns all pages
- collaborator role fields map onto `GitCodeUser.role`
- reviewer/tester/assignee candidates are filtered by role permission defaults
- overview store uses collaborator-derived candidates
- create pull request defaults expose separate assignee and tester candidate
  lists
