# Sign In Empty State Is Clickable

## Status

Fixed - 2026-07-02

## Summary

The Pull Requests and Issues tree views showed `Sign in to GitCode` as plain
empty-state text when the user was not authenticated. Users could see the sign-in
prompt, but clicking it did not start authentication. They had to discover and
click the separate toolbar sign-in button instead.

## Root Cause

`EmptyStateNode` already supported an optional `vscode.Command`, but the
`NotSignedInError` paths created plain empty-state nodes without passing the
existing `gitcode.signIn` command.

## Fix

Added `EmptyStateNode.signIn()` as the shared sign-in empty-state factory. It
creates a tree item labeled `Sign in to GitCode`, describes it as `Click to sign
in`, and wires the item command to `gitcode.signIn`.

The following unauthenticated tree states now use the clickable sign-in node:

- Pull Requests tree root
- Issues tree root
- Pull request category children
- Issue category children
- Pull request changed files

## Affected Files

| File | Change |
|------|--------|
| `src/view/tree/nodes/emptyStateNode.ts` | Added shared clickable sign-in empty-state factory |
| `src/view/tree/pullRequestTreeDataProvider.ts` | Uses clickable sign-in node for root authentication errors |
| `src/view/tree/issueTreeDataProvider.ts` | Uses clickable sign-in node for root authentication errors |
| `src/view/tree/nodes/pullRequestCategoryNode.ts` | Uses clickable sign-in node for category authentication errors |
| `src/view/tree/nodes/issueCategoryNode.ts` | Uses clickable sign-in node for category authentication errors |
| `src/view/tree/nodes/pullRequestFilesNode.ts` | Uses clickable sign-in node for changed-file authentication errors |
| `src/test/emptyStateNode.test.ts` | Added regression coverage for the sign-in command wiring |

## Verification

- TypeScript compilation passes during `npm test`
- Webpack compilation passes during `npm test`
- ESLint passes during `npm test`
- VS Code integration test runner could not complete in this headless
  environment because Electron failed to initialize without an X server or
  `$DISPLAY`
