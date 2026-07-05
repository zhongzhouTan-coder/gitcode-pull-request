# Pull Request Creator Participant Selection Exclusions

## Status

Fixed - 2026-07-05

## Symptom

The pull request participant pickers could offer the pull request creator as a
selectable participant in places where that user should be excluded:

- the create pull request page could include the signed-in user in the
  assignee and tester pickers
- the pull request overview could include the pull request author in the add
  reviewer picker

This allowed obviously invalid or misleading self-selection options to appear in
the UI even though the creator is not supposed to be assigned to those roles.

## Root Cause

The exclusion rule was implemented inconsistently across pull request
participant selection paths:

- the create pull request flow loaded repository members without filtering out
  the signed-in user
- the overview tester picker already excluded the pull request author, but the
  reviewer picker did not
- login comparisons relied on raw values, which made the behavior more fragile
  when login casing differed between API responses

## Fix

The creator exclusion rule is now applied consistently in both pull request
selection surfaces:

- create pull request assignee and tester options filter out the signed-in user
  before the webview receives the member list
- pull request overview reviewer and tester add pickers both exclude the pull
  request author
- login matching now normalizes casing and whitespace before applying the
  exclusion set

## Files Changed

- `src/view/createPullRequest/createPullRequestDataModel.ts`
- `src/view/createPullRequest/createPullRequestViewProvider.ts`
- `src/view/viewController.ts`
- `src/view/overview/pullRequestOverviewPanel.ts`
- `src/test/createPullRequestDataModel.test.ts`
- `src/test/createPullRequestViewProvider.test.ts`
- `src/test/pullRequestOverviewPanel.test.ts`

## Verification

- `npm run compile`
- `npm run lint`
- `npm run compile-tests`
