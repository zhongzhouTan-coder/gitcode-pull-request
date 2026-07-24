# Comment Delete Icon Shown For Other Users' Comments

## Status

Fixed - 2026-07-24

## Summary

Issue and pull request comment timelines currently render a delete icon for
comments that the authenticated user does not own. GitCode only allows users to
delete their own comments, so showing the delete affordance on other users'
comments creates a broken action path.

The same ownership rule applies to comment editing: users can edit and delete
their own comments, but cannot edit or delete comments authored by other users.

## Expected Behavior

- Compute per-comment edit/delete permissions in the permission model.
- Render edit and delete icons only when the per-comment permission allows the
  action.
- Do not render disabled edit/delete icons for comments owned by other users.
- Keep the server-side permission check before sending the delete request.

## Affected Areas

| Area | Expected Change |
|------|-----------------|
| Pull request overview comments | Hide edit/delete icons for comments not authored by the current user |
| Issue overview comments | Hide edit/delete icons for comments not authored by the current user |
| Edit/delete handlers | Continue rejecting non-owned comment mutations defensively |

## Fix

- The permission model now exposes per-comment action permissions keyed by
  comment id.
- Pull request and issue overview renderers consume the per-comment permission
  map and only emit edit/delete markup for allowed object actions.
- Pull request and issue edit/delete handlers now reject non-owned comment
  mutations before checking repository write permissions or calling the API.

## Verification

- A user's own issue comment shows the delete icon.
- Another user's issue comment does not show the delete icon.
- A user's own pull request comment shows the delete icon.
- Another user's pull request comment does not show the delete icon.
- Another user's issue or pull request comment does not show the edit icon.
- `npm run compile-tests`
- `npm run lint`
- `npm run compile`
- `npm test` pretest checks passed, but the VS Code integration runner could
  not start in this headless environment because Electron reported a missing X
  server/`$DISPLAY`.
