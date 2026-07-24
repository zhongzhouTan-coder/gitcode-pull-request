# Chat Participant Refactor — Single `@gitcode` Participant

**Date:** 2026-07-24
**Status:** Proposed

## Motivation

Currently, the extension registers two chat participants:

| Participant | `@` name | Purpose |
|---|---|---|
| `gitcode-pull-request.context` | `@gitcodePullRequest` | Review selected PR |
| `gitcode-issue.context` | `@gitcodeIssue` | Analyze selected issue |

The issue participant is redundant because:

1. **Agent tools** (`gitcode_get_issue_context`, `gitcode_search_issues`, `gitcode_get_selected_issue`) already give Copilot everything it needs to answer issue-related questions without a dedicated participant.
2. **Settle flow** (`gitcode.settleIssueWithAgent`) handles the structured issue resolution workflow, which is the main AI-driven issue use case.

The PR review use case is different — it's inherently conversational (discussing diffs, asking "what does this change do?", exploring alternatives), making a chat participant the right fit.

## Design

### Remove the issue participant

- Delete `src/view/copilot/registerCopilotIssueParticipant.ts`
- Remove the `gitcode-issue.context` entry from `package.json` → `contributes.chatParticipants`
- Remove import and registration call from `src/view/viewController.ts`

### Rename the PR participant to `@gitcode`

| Property | Before | After |
|---|---|---|
| `id` | `gitcode-pull-request.context` | `gitcode.context` |
| `name` | `gitcodePullRequest` | `gitcode` |
| `fullName` | `GitCode Pull Request` | `GitCode` |
| `description` | Reviews and explains the selected GitCode pull request when manually invoked. | Ask about the selected GitCode pull request. |

### What stays unchanged

- `CopilotIssueContextStore` — still used by issue commands and settle flow
- `CopilotIssueContextBuilder` — still used by agent tools
- All agent tools (`gitcode_*`)
- Settle flow (`registerSettleIssueCommands`)

### User experience

**Before:**
```
@gitcodeIssue analyze this issue       ← removed
@gitcodePullRequest review this PR
```

**After:**
```
@gitcode review this PR               ← simpler name
# For issues: just ask Copilot directly (tools handle it)
# For structured settlement: use the "Settle Issue with Agent" button
```

## Files changed

| File | Change |
|---|---|
| `package.json` | Remove issue participant entry; rename PR participant |
| `src/view/copilot/registerCopilotIssueParticipant.ts` | **Delete** |
| `src/view/copilot/registerCopilotPullRequestParticipant.ts` | Change `PARTICIPANT_ID` |
| `src/view/viewController.ts` | Remove issue participant import and registration |
| `docs/architecture-design.md` | Update participant list |

## Rationale

- **YAGNI** — The issue participant was added preemptively but tools + settle flow already cover the use cases.
- **Simpler UX** — One `@gitcode` name to remember instead of two.
- **Consistent with ecosystem** — Pattern matches `@github` (single participant, focused on PR review).
