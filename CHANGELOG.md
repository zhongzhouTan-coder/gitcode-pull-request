# Changelog

All notable changes to the `gitcode-pull-request` extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project follows semantic versioning while it remains pre-1.0.

## [Unreleased]

### Changed

- Added spacing between the pull request close or reopen button and the merge
  button in the overview composer footer.
- Added `Delete source branch after merge` and `Squash commits on merge`
  options to pull request editing, with inline descriptions in the overview
  preferences card.
- Refactored pull request overview author-editable section permissions to use
  a single `canEditPullRequestAuthorSections` flag for title, body, draft, and
  merge-preference toggles while keeping close and reopen action permissions
  separate.

### Fixed

- Reset the pull request merge button when a runtime merge permission check is
  denied after confirmation so the overview does not remain stuck in a loading
  state.
- Preferred specific pull request merge blockers such as conflicts, failed CI,
  missing approvals, or API-provided reasons over the generic non-mergeable
  fallback message in merge validation and tooltips.
- Fixed the pull request overview `Close related issues after merge` checkbox
  so it reflects the saved PR setting when the value is enabled.

## [0.0.3] - 2026-07-05

### Added

- Added pull request approver add and remove actions in the pull request overview.
- Added pull request reviewer add and remove actions in the pull request overview.
- Added pull request tester add and remove actions in the pull request overview.
- Added role- and resource-owner-aware permission evaluation for issue and
  pull request actions.

### Changed

- Renamed pull request assignee display copy to approver across the pull
  request create flow, overview UI, and command titles, while leaving issue
  assignee display unchanged.
- Refreshed repository permission snapshots on pull request tree refresh and
  before opening the create pull request flow.
- Updated create pull request permission checks to use the current source
  repository for cross-repository pull request submission and source-branch
  creation.
- Switched pull request reviewer, tester, and assignee selectors to use the
  full paginated repository collaborator list with role-based eligibility, and
  split create-flow assignee and tester candidates accordingly.
- Unified permission-denied button tooltips across the create pull request,
  pull request overview, and issue overview webviews with the same
  wrapper-based custom tooltip pattern.
- Moved pull request related issues above the timeline so the overview matches
  the issue page's related-content placement more closely.
- Moved issue and pull request close or reopen actions into the composer footer,
  left-aligned opposite the right-aligned comment submit action.
- Changed issue and pull request close or reopen actions from primary styling to
  transparent secondary styling to reduce destructive-action emphasis.

### Fixed

- Made `Sign in to GitCode` tree empty states clickable so they run the existing sign-in command.
- Fixed cross-repository pull request creation gating so the final create
  action uses the current source repository's `pr:create` permission instead of
  incorrectly requiring that permission on the selected target repository.
- Allowed issue creation with create-only permission while disabling labels,
  milestones, and assignees when issue update permission is unavailable.
- Updated issue and pull request PATCH requests to send only changed fields
  instead of always including the current title in section saves and state
  changes.
- Excluded the pull request creator from create-flow assignee or tester
  selections and from pull request overview reviewer or tester add pickers.

## [0.0.2] - 2026-07-02

### Added

- Added an MIT `LICENSE` file.
- Added `THIRD_PARTY_NOTICES.md` with attribution guidance for the MIT-licensed `microsoft/vscode-pull-request-github` reference project.
- Added a project-specific README with setup, commands, settings, development workflow, architecture links, and license notes.
- Added pull request related issue linking from the pull request overview.
- Added pull request related issue unlinking from the pull request overview.
- Added shared Copilot context prompt budgeting for pull request and issue chat participants.

### Changed

- Updated architecture documentation to describe the current authentication, service, view, tree, overview, diff comment, issue, create-flow, and Copilot context architecture.
- Updated tree-view architecture documentation to reflect the implemented pull request and issue store/provider/node design.
- Added package license metadata.
- Optimized Copilot pull request and issue context generation to stay within prompt budgets.

## [0.0.1] - 2026-07-02

### Added

- Added Personal Access Token sign-in for GitCode.
- Added GitCode repository detection from VS Code git remotes.
- Added `gitcode.repository` override support for workspaces without a GitCode remote.
- Added a GitCode activity bar container.
- Added pull request tree view with repository-scoped `All Open` and `Created By Me` categories.
- Added issue tree view with `My Issues`, `Created Issues`, and `Recent Issues` categories.
- Added pull request overview webview.
- Added issue overview webview.
- Added create pull request webview and command flow.
- Added create issue flow.
- Added create branch for issue flow.
- Added pull request file browsing with tree and flat layouts.
- Added virtual read-only pull request file content support.
- Added pull request patch content support.
- Added inline pull request diff comments.
- Added resolve and unresolve actions for diff comments.
- Added pull request and issue operation log stores.
- Added related pull request support for issue overview.
- Added GitCode Copilot chat participants for selected pull request and issue context.
- Added markdown rendering and HTML sanitization helpers for webviews.

### Changed

- Aligned issue overview header actions with pull request overview button styles.
- Rendered issue comments with the same bordered card treatment used by pull request overview content.

### Fixed

- Improved startup repository readiness handling so tree views do not permanently show an empty state before the VS Code git extension finishes initializing.
- Improved pull request file diff handling for encoded paths and shared SHA cases.
- Improved diff comment context fallback behavior for files JSON responses.
- Improved issue comment rendering when avatar data is missing.
