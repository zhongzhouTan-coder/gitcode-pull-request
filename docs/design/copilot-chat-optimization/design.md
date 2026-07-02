# Copilot Chat Participant Optimization Design

## Goal

Optimize the existing GitCode Copilot chat participants without changing the
explicit user-facing workflow.

The current workflow remains:

```text
User selects GitCode context -> user invokes @gitcodePullRequest or @gitcodeIssue -> extension sends selected context to the user's chosen chat model
```

This design improves latency, prompt budgeting, error reporting, maintainability,
and test coverage for the existing participants:

- `@gitcodePullRequest`
- `@gitcodeIssue`

## Non-Goals

- Do not replace chat participants with public language model tools.
- Do not add Agent mode write operations.
- Do not automatically attach GitCode context to normal Copilot requests.
- Do not infer pull request or issue numbers from arbitrary prompts.
- Do not persist selected context across VS Code restarts.
- Do not add merge, approve, review submission, branch creation, or pull request
  creation actions to chat.

## Current Problems

### Shared Participant Flow Is Duplicated

`registerCopilotPullRequestParticipant` and `registerCopilotIssueParticipant`
both perform the same orchestration:

1. Read selected context from a store.
2. Show a missing-selection message.
3. Build context.
4. Send system instruction, context, and user prompt to `request.model`.
5. Stream model output.
6. Catch and stream errors.

The duplication makes it easier for behavior to drift between pull request and
issue chat flows.

### Error Messages Collapse Different Failures

Both participants wrap context loading and model invocation in one `try` block.
This can report a model failure as a context loading failure.

Examples:

- model quota exceeded
- model consent denied
- provider request failure
- response stream failure

These should not be shown as `Failed to load pull request context` or
`Failed to load issue context`.

### Context Budget Is Static

Both context builders use a fixed `MAX_TOTAL_CHARS` value. This ignores the
selected model's `maxInputTokens`.

The result can be inefficient in both directions:

- smaller models can receive too much context
- larger models cannot use their available capacity

### Context Truncation Can Drop Important Sections

The pull request builder appends metadata, patches, and comments, then truncates
the final string. Large patches can push comments or truncation notes out of the
payload.

The issue builder is safer because comments and related pull requests are
bounded, but it still uses final-string truncation as the last line of defense.

### API Calls Are Mostly Sequential

Some data dependencies are strict, but many reads are independent.

Pull request context currently loads:

1. pull request detail
2. changed files
3. comments

Issue context currently loads:

1. issue detail
2. comments
3. related pull requests
4. workspace metadata

Parallelizing independent secondary reads will reduce chat startup latency.

### Builder Behavior Is Not Directly Tested

The selection stores are covered by tests, but context builders and participant
error paths need direct tests.

## Proposed Design

### Keep The Explicit Participant UX

Keep the current manual contract:

```text
User typed @gitcodePullRequest -> extension may fetch and send selected PR context.
User typed @gitcodeIssue -> extension may fetch and send selected issue context.
User did not invoke a GitCode participant -> extension must not send GitCode context.
```

This preserves predictable privacy and avoids exposing repository context through
generic Agent mode.

### Add Shared Participant Orchestration

Introduce a small helper for common participant behavior:

```text
src/view/copilot/
  registerCopilotContextParticipant.ts
```

Proposed shape:

```ts
interface CopilotContextParticipantOptions<TSelected> {
  participantId: string;
  icon: vscode.ThemeIcon;
  getSelected(): TSelected | undefined;
  missingSelectionMessage: string;
  buildContext(
    selected: TSelected,
    budget: CopilotPromptBudget,
    token: vscode.CancellationToken,
  ): Promise<string>;
  systemInstruction: string;
  requestJustification: string;
  loadFailurePrefix: string;
}
```

The helper should:

1. Read the selected value.
2. Stream the missing-selection message when no context is selected.
3. Compute a model-aware prompt budget.
4. Build context in a context-loading `try` block.
5. Send the model request in a separate model `try` block.
6. Stream response chunks.
7. Handle cancellation silently.

The pull request and issue registration files should become thin wrappers that
provide participant-specific options.

### Separate Context Errors From Model Errors

Use separate boundaries:

```ts
let contextText: string;
try {
  contextText = await options.buildContext(selected, budget, token);
} catch (error) {
  stream.markdown(`${options.loadFailurePrefix}: ${errorMessage(error)}`);
  return;
}

try {
  const response = await request.model.sendRequest(messages, {
    justification: options.requestJustification,
  }, token);

  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }
} catch (error) {
  if (token.isCancellationRequested) {
    return;
  }

  stream.markdown(`Language model request failed: ${errorMessage(error)}`);
}
```

If the error is a `vscode.LanguageModelError`, include its message but avoid
leaking implementation details or tokens.

### Add Model-Aware Prompt Budgeting

Introduce:

```ts
export interface CopilotPromptBudget {
  maxContextChars: number;
  maxBodyChars: number;
  maxDiffCommentChars: number;
  maxPullRequestCommentChars: number;
  maxPatchChars: number;
}
```

Compute the budget from `request.model.maxInputTokens` when available:

```ts
function createPromptBudget(model: vscode.LanguageModelChat): CopilotPromptBudget {
  const maxInputTokens = model.maxInputTokens ?? 16_000;
  const reservedTokens = Math.max(2_000, Math.floor(maxInputTokens * 0.25));
  const usableTokens = Math.max(4_000, maxInputTokens - reservedTokens);
  const maxContextChars = usableTokens * 4;

  return {
    maxContextChars,
    maxBodyChars: Math.min(12_000, Math.floor(maxContextChars * 0.25)),
    maxDiffCommentChars: 2_500,
    maxPullRequestCommentChars: 1_500,
    maxPatchChars: Math.min(4_000, Math.floor(maxContextChars * 0.10)),
  };
}
```

The token-to-character conversion is intentionally approximate. The purpose is
to keep context proportional to the selected model, not to count tokens exactly.

### Use A Budgeted Context Writer

Replace final-string-only truncation with a small writer that tracks remaining
budget while sections are appended:

```ts
class BudgetedContextWriter {
  append(value: string): void;
  appendLine(value?: string): void;
  appendTruncated(value: string, maxChars: number): void;
  remaining(): number;
  toString(): string;
}
```

Rules:

- Always include identity metadata first.
- Prefer a complete section summary over a partial large patch.
- Add explicit truncation markers when a section is shortened.
- Stop adding optional sections when the remaining budget is too small.
- Preserve final truncation notes inside the returned text.

### Pull Request Context Strategy

The pull request builder should include sections in this order:

1. PR metadata and description.
2. Changed file manifest for all returned files up to the file-count limit.
3. Diff review comments.
4. General pull request comments.
5. Patch excerpts within the remaining budget.

This guarantees the model sees the complete file list and review discussion
before optional patch detail consumes the budget.

### Pull Request Comment Strategy

GitCode pull request comments are not all equivalent. The current domain model
already separates them:

```ts
export interface PullRequestGeneralComment {
  kind: 'pullRequest';
}

export interface PullRequestDiffComment {
  kind: 'diff';
  resolved: boolean;
  isOutdated: boolean;
  location: PullRequestDiffCommentLocation;
}
```

The API source types are:

```text
pr_comment -> PullRequestGeneralComment
diff_comment -> PullRequestDiffComment
```

For PR review, `diff_comment` records are usually more important than general
PR comments because they point to specific files, lines, resolved state, and
outdated state. The optimized builder should therefore render comments in
separate sections instead of one flat recent list.

Recommended sections:

```text
### Diff Review Comments
### General Pull Request Comments
```

Diff comment ordering:

1. unresolved and not outdated
2. unresolved and outdated
3. resolved and not outdated
4. resolved and outdated
5. newest first inside each group

General PR comment ordering:

1. newest first
2. include replies directly under the parent comment

Diff comment formatting should include the location before the body:

```text
- [unresolved] src/file.ts lines 42-48 by alice at 2026-07-02T10:00:00Z
  <comment body>
```

If path or line information is missing because detail enrichment failed, keep
the comment and mark the location as unknown:

```text
- [unresolved] unknown location by alice at 2026-07-02T10:00:00Z
```

Budget policy:

- reserve comment budget for diff comments before general PR comments
- include at least a small general PR comment section when general comments
  exist and budget remains
- truncate individual diff comments less aggressively than general PR comments
- include replies for diff comments before replies for general PR comments
- emit count notes when comments are omitted

Recommended default count limits:

```text
diff comments: 50 prioritized comments
general PR comments: 20 newest comments
diff comment body: budget-derived, capped at 2,500 characters
general PR comment body: budget-derived, capped at 1,500 characters
reply body: 1,000 characters
```

Recommended prioritization for patch excerpts:

- include deleted, renamed, and modified source/test files before generated or
  lock files
- skip files marked too large
- skip files without patch text
- include per-file truncation notes

Keep existing count limits as defaults:

```text
files: 100 files
per-file patch: budget-derived, capped at 4,000 characters
```

### Issue Context Strategy

Issue detail remains strict: if it cannot be loaded, fail the chat request.

Secondary sections remain lenient:

- comments failure produces a comments error section
- related pull requests failure produces a related-PR error section
- workspace metadata failure omits the workspace section

Issue comments, related pull requests, and workspace metadata should load in
parallel after issue detail is available.

### Parallel Data Loading

Pull request context:

```ts
const [detail, filesResult, commentsResult] = await Promise.all([
  pullRequestService.getPullRequest(repository, pullRequestNumber),
  toResult(pullRequestService.listPullRequestFiles(repository, pullRequestNumber)),
  toResult(commentService.listPullRequestComments(repository, pullRequestNumber, {
    limit: MAX_COMMENTS,
    newestFirst: true,
  })),
]);
```

Pull request detail is strict. Files and comments can be either strict or
lenient. Recommended behavior:

- detail failure fails the request
- files failure fails the request because file changes are core PR context
- comments failure appends a comments error section and continues

Issue context:

```ts
const detail = await issueService.getIssue(repository, issueNumber);
const [commentsResult, relatedPrsResult, workspaceResult] = await Promise.all([
  toResult(issueCommentService.listIssueComments(repository, issueNumber)),
  toResult(issueService.listIssueRelatedPullRequests(repository, issueNumber)),
  toResult(repositoryContextService.getActiveRepository()),
]);
```

Use `token.isCancellationRequested` checks after each awaited batch.

### Language Model Tool Strategy

Do not add public `contributes.languageModelTools` entries as part of this
optimization.

Language model tools can be revisited later for read-only Agent mode support,
but this optimization should keep context retrieval behind explicit chat
participants.

If tools are added later, start with read-only tools only:

```text
get_gitcode_pull_request_context
get_gitcode_issue_context
```

Do not expose write tools for branch creation, pull request creation, comment
submission, approval, merge, or issue closure without a separate safety design.

## File Changes

Expected new files:

```text
src/view/copilot/copilotPromptBudget.ts
src/view/copilot/budgetedContextWriter.ts
src/view/copilot/registerCopilotContextParticipant.ts
src/test/copilotPromptBudget.test.ts
src/test/budgetedContextWriter.test.ts
src/test/copilotPullRequestContextBuilder.test.ts
src/test/copilotIssueContextBuilder.test.ts
```

Expected changed files:

```text
src/view/copilot/copilotPullRequestContextBuilder.ts
src/view/copilot/copilotIssueContextBuilder.ts
src/view/copilot/registerCopilotPullRequestParticipant.ts
src/view/copilot/registerCopilotIssueParticipant.ts
src/view/viewController.ts
```

No `package.json` contribution changes are required.

## Testing

Add unit tests for:

- prompt budget scales down for small models
- prompt budget scales up for larger models
- budgeted writer preserves truncation markers
- PR builder always includes PR metadata
- PR builder includes changed file manifest before patch excerpts
- PR builder keeps comments when patches are large
- PR builder renders diff comments separately from general PR comments
- PR builder prioritizes unresolved diff comments over resolved comments
- PR builder includes diff comment path, line range, resolved state, and outdated
  state when available
- PR builder keeps diff comments with unknown location when enrichment is missing
- PR builder reports comments failure leniently
- issue builder fails when issue detail fails
- issue builder reports comments and related-PR failures leniently
- issue builder omits workspace metadata when unavailable
- cancellation returns without model invocation
- participant reports missing selection
- participant reports context loading failure separately from model failure

Manual verification:

1. Select a GitCode pull request.
2. Run `GitCode: Use Pull Request as Copilot Context`.
3. Ask `@gitcodePullRequest review this PR`.
4. Confirm the response references PR metadata, file changes, and comments.
5. Test with a large PR and confirm comments are still included.
6. Select a GitCode issue.
7. Run `GitCode: Use Issue as Copilot Context`.
8. Ask `@gitcodeIssue analyze this issue`.
9. Confirm the response references issue detail and related discussion.
10. Temporarily force a model failure and confirm the message says the language
    model request failed rather than context loading failed.

## Implementation Order

1. Add `CopilotPromptBudget` and budget calculation tests.
2. Add `BudgetedContextWriter` and truncation tests.
3. Update pull request context builder to accept a budget.
4. Update issue context builder to accept a budget.
5. Add shared participant registration helper.
6. Convert pull request participant to the helper.
7. Convert issue participant to the helper.
8. Add participant error boundary tests.
9. Run unit tests and manual Copilot verification.
