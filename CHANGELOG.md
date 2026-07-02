# Changelog

All notable changes to the `gitcode-pull-request` extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project follows semantic versioning while it remains pre-1.0.

## [Unreleased]

### Added

- Added an MIT `LICENSE` file.
- Added `THIRD_PARTY_NOTICES.md` with attribution guidance for the MIT-licensed `microsoft/vscode-pull-request-github` reference project.
- Added a project-specific README with setup, commands, settings, development workflow, architecture links, and license notes.

### Changed

- Updated architecture documentation to describe the current authentication, service, view, tree, overview, diff comment, issue, create-flow, and Copilot context architecture.
- Updated tree-view architecture documentation to reflect the implemented pull request and issue store/provider/node design.
- Added package license metadata.

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
