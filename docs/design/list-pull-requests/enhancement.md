# List Pull Requests Enhancement

## Goal

Extend the existing Pull Requests tree from only `All Open` to include
`Created By Me`.

- `All Open`: recently updated open pull requests in the repository
- `Created By Me`: open pull requests authored by the signed-in GitCode user

The existing `design.md` remains the baseline list-pull-requests design. This
document only describes the category enhancement.

## User Experience

```text
Pull Requests
  owner/repo (origin)
    All Open
      #567 [Doc] Add unit testing guide
    Created By Me
      #565 Add issue category filters
```

Empty states should be category-specific:

| Category | Empty label |
| --- | --- |
| `All Open` | `No open pull requests` |
| `Created By Me` | `No pull requests created by you` |

## API Filters

Derive the current login from `AuthSession.accountName`. Do not add another
current-user request just to build these filters.

Add an `author` field to `PullRequestFilters`:

```ts
export interface PullRequestFilters {
  state?: 'open' | 'closed' | 'all';
  perPage?: number;
  page?: number;
  base?: string;
  sort?: 'created' | 'updated';
  direction?: 'asc' | 'desc';
  author?: string;
}
```

Category requests:

| Category | API filters |
| --- | --- |
| `All Open` | `state=open`, `sort=updated`, `direction=desc` |
| `Created By Me` | `state=open`, `author=<current login>`, `sort=updated`, `direction=desc` |

The service should pass `author` through to the list pull requests API query.
If GitCode does not support API-side author filtering, keep the `author` field
in the service contract and temporarily filter mapped results by
`PullRequestSummary.author === session.accountName`. That fallback only covers
the fetched page, so API-side filtering is still preferred.

## Store Changes

Update category keys:

```ts
export type PullRequestCategoryKey = 'allOpen' | 'createdByMe';
```

Cache PR lists per repository, category, and account:

```text
pullRequestListKey = ${repository.fullName}:${categoryKey}:${session.accountName}
```

Clear all pull request list caches when the signed-in account changes.

## Tests

- `PullRequestService.listPullRequests()` maps `author`, `state`, `sort`,
  `direction`, `page`, `perPage`, and `base` to API query parameters.
- `PullRequestTreeStore.getCategories()` returns `All Open` and
  `Created By Me`.
- `Created By Me` passes `author=<current login>`.
- Empty category nodes use the category-specific labels above.
