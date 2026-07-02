# gitcode-pull-request

GitCode pull request and issue integration for Visual Studio Code.

This extension adds a GitCode activity bar view for browsing pull requests, opening changed files, reviewing inline diff comments, creating pull requests, and working with issues without leaving VS Code.

## Features

- Sign in to GitCode with a Personal Access Token.
- Detect GitCode repositories from VS Code git remotes.
- Override repository detection with an explicit `owner/repo` setting.
- Browse pull requests by repository.
- Browse issues by repository.
- Open pull request and issue overview webviews.
- Open pull request files from the tree.
- Toggle pull request files between tree and flat layouts.
- View pull request patch content and read-only file content through virtual documents.
- Create and edit pull requests.
- Create issues and create branches for issues.
- Add, resolve, and unresolve pull request diff comments.
- Send selected pull request or issue context to the contributed Copilot chat participants.

## Requirements

- VS Code `^1.120.0`.
- A GitCode account.
- A GitCode Personal Access Token.
- A workspace with a GitCode remote, or the `gitcode.repository` setting configured as `owner/repo`.

Supported remote examples:

```text
git@gitcode.com:owner/repo.git
https://gitcode.com/owner/repo.git
```

## Getting Started

1. Install and open the extension in VS Code.
2. Open a workspace that contains a GitCode git remote.
3. Run `GitCode: Sign In`.
4. Paste a GitCode Personal Access Token.
5. Open the `GitCode Pull Requests` activity bar view.

If the workspace remote is not hosted on `gitcode.com`, set:

```json
{
  "gitcode.repository": "owner/repo"
}
```

## Views

The extension contributes one activity bar container with these views:

- `Pull Requests` - repository-scoped pull request tree.
- `Create Pull Request` - webview for creating pull requests.
- `Issues` - repository-scoped issue tree.

Pull request tree categories:

- `All Open`
- `Created By Me`

Issue tree categories:

- `My Issues`
- `Created Issues`
- `Recent Issues`

## Commands

Common commands:

- `GitCode: Sign In`
- `GitCode: Refresh Pull Requests`
- `GitCode: Open Pull Request`
- `GitCode: Open Pull Request On Web`
- `GitCode: Create Pull Request`
- `GitCode: Edit Pull Request`
- `GitCode: Refresh Issues`
- `GitCode: Create Issue`
- `GitCode: Open Issue`
- `GitCode: Open Issue On Web`
- `GitCode: Copy Issue URL`
- `GitCode: Create Branch for Issue`
- `GitCode: Use Pull Request as Copilot Context`
- `GitCode: Use Issue as Copilot Context`

## Extension Settings

```json
{
  "gitcode.baseUrl": "https://api.gitcode.com",
  "gitcode.webUrl": "https://gitcode.com",
  "gitcode.repository": "",
  "gitcode.pullRequests.pageSize": 100,
  "gitcode.pullRequests.fileListLayout": "tree",
  "gitcode.issues.pageSize": 100,
  "gitcode.trace.server": "off"
}
```

Settings:

- `gitcode.baseUrl` - base URL for GitCode API requests.
- `gitcode.webUrl` - base URL for GitCode web links.
- `gitcode.repository` - optional `owner/repo` override for repository detection.
- `gitcode.pullRequests.pageSize` - maximum pull requests loaded per category.
- `gitcode.pullRequests.fileListLayout` - `tree` or `flat`.
- `gitcode.issues.pageSize` - maximum issues loaded per category.
- `gitcode.trace.server` - set to `verbose` to log outgoing GitCode API requests.

## Development

Install dependencies:

```sh
npm ci
```

Compile:

```sh
npm run compile
```

Watch:

```sh
npm run watch
```

Package:

```sh
npm run package
```

Run tests:

```sh
npm test
```

`npm test` runs compile, bundle, lint, and the VS Code test runner through the `pretest` script.

## Architecture

The extension is split into four main areas:

- `src/authentication` - PAT auth, session storage, and auth state.
- `src/common` - configuration, constants, errors, logging, git helpers, and domain models.
- `src/gitcode` - REST client, services, repository resolver, and DTO mappers.
- `src/view` - tree views, webviews, commands, stores, diff/comment controllers, create flows, and Copilot context.

See:

- [Architecture Design](docs/architecture-design.md)
- [Tree View Architecture](docs/tree-view-architecture.md)

## License

This project is licensed under the [MIT License](LICENSE).

It is designed with reference to Microsoft's `vscode-pull-request-github`, which
is also MIT licensed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for
upstream attribution guidance.

## Known Issues

- Authentication currently uses Personal Access Tokens only.
- Repository detection expects a GitCode remote unless `gitcode.repository` is configured.
