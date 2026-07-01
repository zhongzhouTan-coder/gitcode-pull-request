# List Issues Enhancement

## Goal

Extend the existing Issues tree from a single `All Open` category to three
fixed categories:

- `My Issues`: open issues assigned to the signed-in GitCode user
- `Created Issues`: open issues created by the signed-in GitCode user
- `Recent Issues`: recently updated open issues in the repository

The existing `design.md` remains the baseline list-issues design. This document
only describes the category enhancement.

## User Experience

```text
Issues
  owner/repo (origin)
    My Issues
      #321 [Bug] Quantization fails on A5
    Created Issues
      #320 Build script does not run tests
    Recent Issues
      #319 Update quantization docs
```

Empty states should be category-specific:

| Category | Empty label |
| --- | --- |
| `My Issues` | `No issues assigned to you` |
| `Created Issues` | `No issues created by you` |
| `Recent Issues` | `No recent open issues` |

## API Filters

Derive the current login from `AuthSession.accountName`. Do not add another
current-user request just to build these filters.

Extend `IssueFilters`:

```ts
export interface IssueFilters {
  state?: 'open' | 'closed' | 'all';
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
  assignee?: string;
  creator?: string;
}
```

Category requests:

| Category | API filters |
| --- | --- |
| `My Issues` | `state=open`, `assignee=<current login>`, `sort=updated`, `direction=desc` |
| `Created Issues` | `state=open`, `creator=<current login>`, `sort=updated`, `direction=desc` |
| `Recent Issues` | `state=open`, `sort=updated`, `direction=desc` |

## Store Changes

Update category keys:

```ts
export type IssueCategoryKey =
  | 'myIssues'
  | 'createdIssues'
  | 'recentIssues';
```

Cache issue lists per repository, category, and account:

```text
issueListKey = ${repository.fullName}:${categoryKey}:${session.accountName}
```

Clear all issue list caches when the signed-in account changes.

## Tests

- `IssueService.listIssues()` maps `assignee` and `creator` to API query
  parameters.
- `IssueTreeStore.getCategories()` returns `My Issues`, `Created Issues`, and
  `Recent Issues`.
- `My Issues` passes `assignee=<current login>`.
- `Created Issues` passes `creator=<current login>`.
- `Recent Issues` passes no user filter.
- Empty category nodes use the category-specific labels above.
