# Issue Overview: Header Actions And Comment Cards Aligned With Pull Request Overview

## Status

✅ **Fixed** — 2026-07-01

## Symptom

The issue overview UI had two small but visible inconsistencies compared with the
pull request overview:

- the header actions `Refresh`, `Create Branch`, `Open on GitCode`, and
  `Close issue` or `Reopen issue` did not follow the same button hierarchy as
  the pull request overview
- issue comments in the timeline rendered as plain rows instead of bordered
  comment cards like pull request comments

This made the issue surface look like a separate UI instead of a parallel
overview experience.

## Root Cause

In [src/view/issueOverview/issueOverviewHtml.ts](/home/tanzhongzhou/projects/github/gitcode-pull-request/src/view/issueOverview/issueOverviewHtml.ts), the issue overview used its own simplified button markup and comment styling:

- `refresh-button` rendered as a regular secondary button with both icon and
  text instead of the PR overview's icon-only utility button
- `open-web-button` did not explicitly use the secondary class
- `state-action-button` did not apply the PR overview's danger and primary
  styles for close and reopen actions
- issue comment entries used `.comment.timeline-item.timeline-comment` markup
  without the `.comment-card` container that gives PR comments their bordered
  card appearance

The timeline data flow was already correct. The problem was limited to the
issue overview renderer and its inline CSS.

## Fix

The issue overview renderer was updated to mirror the PR overview action and
comment presentation more closely.

### Header Actions

- `Refresh` now uses the same icon-only utility button treatment with `title`
  and `aria-label`
- `Open on GitCode` now uses the secondary button class
- `Close issue` now uses danger styling
- `Reopen issue` now uses primary styling

### Comment Cards

- issue timeline comments now render with `.comment-card` in addition to the
  existing timeline classes
- comment body styles now include the same bordered markdown-friendly treatment
  used by PR comments for code blocks, tables, and images
- operation logs remain compact activity rows and are not turned into cards

## Behavior After Fix

| Surface | Before Fix | After Fix |
|---------|------------|-----------|
| `Refresh` action | Secondary text button | Secondary icon button matching PR overview |
| `Open on GitCode` | Default button styling | Secondary button styling matching PR overview |
| Close or reopen action | Unclassified default button | Danger or primary button matching PR overview intent |
| Issue comment entry | Flat timeline row | Bordered comment card matching PR comments |
| Issue operation log entry | Compact activity row | Compact activity row |

## Affected Files

| File | Change |
|------|--------|
| `src/view/issueOverview/issueOverviewHtml.ts` | aligned issue header action classes and comment card markup with the PR overview |
| `src/test/issueOverviewHtml.test.ts` | added regression coverage for aligned button classes and bordered issue comments |

## Verification

- `npm run compile-tests`
- Updated HTML tests cover PR-style header actions for open and closed issues
- Updated HTML tests cover bordered issue comment card markup