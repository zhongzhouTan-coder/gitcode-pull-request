# Cross-Repository Create Pull Request Permission Regression

## Status

Fixed - 2026-07-05

## Symptom

The create pull request page could disable the final `Create Pull Request`
button for a valid cross-repository PR even when the user had `pr:create`
permission in the selected source repository.

This made fork-style or cross-repository PR creation look unavailable when the
target repository denied `pr:create`, despite the selected source repository
granting the permission required by the existing design.

## Root Cause

The create pull request permission view model regressed during the metadata
permission update:

- `canCreatePullRequest` was computed from the current target repository
- the submit handler re-checked `pr:create` against the target repository
- the UI tooltip also described create permission as a target-repository check

That contradicted the repository permission design for cross-repository PRs,
which explicitly allows the form and submit path to rely on the current source
repository's `pr:create` permission.

## Fix

The create pull request flow now separates create and edit permission
responsibilities correctly:

- `pr:create` is evaluated from the current source repository
- `pr:update` continues to gate labels, milestone, assignees, and testers
- `branch:create` continues to use the current source repository
- the create button tooltip now correctly explains the source-repository
  permission requirement

## Files Changed

- `src/view/createPullRequest/createPullRequestHelper.ts`
- `src/view/createPullRequest/createPullRequestViewProvider.ts`
- `src/view/createPullRequest/createPullRequestHtml.ts`

## Verification

- `npm run compile`
- `npm run lint`
