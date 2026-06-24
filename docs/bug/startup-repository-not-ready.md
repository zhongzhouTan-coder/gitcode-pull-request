# Startup: Repository Not Ready on Initial Load

## Status

✅ **Fixed** — 2026-06-24

## Symptom

When opening VS Code with the extension installed, the Pull Requests tree view shows an error:

> "Open a git repository to list pull requests"

or

> "No git remote found for the active repository."

The user must manually click **Refresh Pull Requests** to load content after the IDE finishes initializing.

## Root Cause

The extension calls `refreshAll()` immediately during `activate()`, but at that point the VS Code Git extension may not have:

1. Discovered the workspace repositories yet (`gitApi.repositories` is empty)
2. Loaded remote information for the repository (`repository.state.remotes` is empty)

Both `RepositoryContextService.getActiveRepository()` and `GitCodeRepositoryResolver.resolveAll()` expect a fully initialized repository and fail when it is not ready.

Two selection details must also be preserved during startup:

- A configured `gitcode.repository` override does not depend on a local repository or its remotes, so initialization must not wait for Git in that case.
- In a multi-root workspace, readiness must be checked for the repository containing the active editor. A different repository being ready does not help because the resolver will still select the active repository.

## Fix

Four source and test files were changed:

### `src/common/git/gitTypes.ts`

Added `onDidChange` event to `GitRepository.state` so the extension can listen for remote data loading:

```ts
state: {
    HEAD?: { name?: string };
    remotes: GitRemote[];
    onDidChange: vscode.Event<void>;  // added
};
```

### `src/common/git/repositoryContext.ts`

Added `waitForRepository(timeoutMs)` to wait until the active repository has remotes. It:

- Uses the same active-repository selection as `getActiveRepository()`
- Checks whether that repository is already ready
- Listens to `gitApi.onDidOpenRepository` for newly discovered repos
- Listens to `repository.state.onDidChange` for remotes being loaded
- Ignores ready repositories that the resolver would not select in a multi-root workspace
- Times out after 15 seconds, falling through to show a proper error state

### `src/view/viewController.ts`

Updated `initialize()` to call `waitForRepository()` before the initial `refreshAll()` only when there is no repository override:

```ts
if (!this.options.configuration.getRepositoryOverride()) {
    await this.options.repositoryContext.waitForRepository();
}
await this.store.refreshAll();
```

The existing `onDidOpenRepository` listener is kept for subsequent workspace changes.

### `src/test/repositoryContext.test.ts`

Added a regression test covering a multi-root workspace where another repository already has remotes but the active repository is still loading them. The wait completes only after the active repository emits `state.onDidChange` with remotes available.

## Behavior After Fix

| Scenario | Behavior |
|----------|----------|
| VS Code opens, repo already discovered with remotes | Immediate load (no change) |
| VS Code opens, repo discovered but remotes still loading | Waits for `state.onDidChange`, then loads |
| VS Code opens, no repo discovered yet | Waits for `onDidOpenRepository`, then loads |
| `gitcode.repository` override is configured | Skips the Git readiness wait and loads immediately |
| Multi-root workspace has a ready inactive repo and an active repo still loading | Waits for the active repo, then loads |
| No repo after 15s timeout | Falls through to `refreshAll()`, shows appropriate error |
| User opens/closes workspace folders later | `onDidOpenRepository`/`onDidCloseRepository` listeners handle it |

## Verification

- TypeScript compilation passes
- ESLint passes
- Extension test suite passes, including the multi-root regression test
