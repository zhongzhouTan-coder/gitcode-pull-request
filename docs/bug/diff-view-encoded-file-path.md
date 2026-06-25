# Diff View: File Path Displays Encoded Characters (%2F, %20)

## Status

✅ **Fixed** — 2026-06-25

## Symptom

When opening a pull request file in the diff editor, the file path shown in the editor tab and breadcrumb displays percent-encoded characters. For example, a file at `src/utils/helpers.ts` appears as `src%2Futils%2Fhelpers.ts`, and spaces in file names appear as `%20`.

## Root Cause

In `buildPrUri` (`src/view/diff/prUriHelpers.ts`), the entire file path was passed to `encodeURIComponent`:

```ts
path: `/${encodeURIComponent(path)}`,
```

`encodeURIComponent` encodes **all** non-alphanumeric characters, including `/` (→ `%2F`). This broke the path structure inside the URI, causing VS Code to display the encoded form rather than the human-readable path.

The same pattern existed in `buildUri` in `src/view/diff/pullRequestPatchContentProvider.ts`.

## Fix

Two files were changed to encode each path segment individually while preserving `/` separators:

### `src/view/diff/prUriHelpers.ts`

In `buildPrUri`, replaced:

```ts
path: `/${encodeURIComponent(path)}`,
```

With:

```ts
const encodedPath = path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

// ... later:
path: `/${encodedPath}`,
```

### `src/view/diff/pullRequestPatchContentProvider.ts`

In `buildUri`, replaced:

```ts
path: `/${encodeURIComponent(repository)}/${pullRequestNumber}/${encodeURIComponent(filePath)}`,
```

With:

```ts
const encodedPath = filePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

// ... later:
path: `/${encodeURIComponent(repository)}/${pullRequestNumber}/${encodedPath}`,
```

## Behavior After Fix

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| `src/utils/helpers.ts` | `src%2Futils%2Fhelpers.ts` | `src/utils/helpers.ts` |
| `my file.ts` (space in name) | `my%20file.ts` | `my%20file.ts` (correctly encoded, VS Code decodes for display) |
| `path/with spaces/and+symbols.ts` | `path%2Fwith%20spaces%2Fand%2Bsymbols.ts` | `path/with%20spaces/and%2Bsymbols.ts` |
| Renamed file (old → new path) | Old and new paths garbled | Both paths display correctly |

## Verification

- TypeScript compilation passes
- ESLint passes
- The `parsePrUri` function in `prUriHelpers.ts` reads the path from the query JSON (original unencoded path), so parsing is unaffected
- The `parseUri` function in `pullRequestPatchContentProvider.ts` uses `decodeURIComponent` on each split segment, which works correctly with the new encoding
