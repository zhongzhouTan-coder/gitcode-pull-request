# Copilot Pull Request Context Design

## Goal

Add a manual GitCode pull request context flow for GitHub Copilot Chat in VS Code.

The feature must:

- let the user explicitly choose when GitCode pull request context is used
- avoid injecting pull request context into normal Copilot requests
- use unique extension-owned names for chat participants and commands
- resolve the pull request number from extension state, not from Copilot inference
- keep GitCode API access inside `gitcode/services/*`, not in the chat layer

The intended user flow is:

```text
1. User selects a pull request from the GitCode Pull Requests tree.
2. User runs GitCode: Use Pull Request as Copilot Context.
3. User asks Copilot Chat with @gitcodePullRequest review this PR.
4. The extension fetches that selected pull request and sends the context to the selected chat model.
```

## Scope

### In Scope

- Add a command on pull request tree nodes to select a PR for Copilot context.
- Store the selected `{ repository, pullRequestNumber }` in extension memory.
- Add a unique chat participant for manual Copilot requests.
- Make the chat participant use selected PR context whenever the user explicitly invokes `@gitcodePullRequest`.
- Support review-oriented prompts without requiring a slash command.
- Fetch pull request detail, changed files, and comments for the selected PR.
- Build a compact text context payload for the language model.
- Show a clear message when no pull request has been selected.

### Out of Scope

- Automatically attaching PR context to every Copilot prompt.
- Adding a custom button to the built-in Copilot add-context UI.
- Requiring users to type `@gitcodePullRequest /context`.
- Requiring users to attach a `#prContext` tool or reference.
- Registering a globally available user-facing language model tool that Agent mode may call outside this participant flow.
- Inferring PR numbers from arbitrary natural language without an explicit selection.
- Merge, approve, comment, or review submission actions.
- Long-term persisted selection across VS Code restarts.

## User Experience

The pull request tree remains the source of truth for selecting the PR:

```text
Pull Requests
  owner/repo (origin)
    All Open
      #567 [Doc] Add unit testing guide
        Use Pull Request as Copilot Context
```

After the user invokes the command, show a compact confirmation:

```text
GitCode PR #567 selected for Copilot context.
```

The user then manually invokes the chat participant:

```text
@gitcodePullRequest review this pull request
```

If no PR has been selected:

```text
Select a GitCode pull request first with "GitCode: Use Pull Request as Copilot Context".
```

This keeps the behavior predictable. Copilot does not decide which PR to review; the extension supplies the selected PR number.

The important usability rule is that the `@` participant is the manual trigger. The user should not need to remember an additional `/context` command or attach a separate `#` reference.

## Naming

VS Code command identifiers must be globally unique. Use the existing `gitcode.*` command namespace.

Add:

```ts
COMMAND_ID.usePullRequestAsCopilotContext =
  'gitcode.usePullRequestAsCopilotContext';
```

Use a unique chat participant id and a readable participant name:

```text
participant id: gitcode-pull-request.context
participant name: gitcodePullRequest
```

The manual chat entry point is:

```text
@gitcodePullRequest
```

Avoid short names such as `@pr`, `@review`, or `#prContext` because they are more likely to collide with other extensions or future VS Code features.

## Package Contributions

Add the tree command:

```json
{
  "command": "gitcode.usePullRequestAsCopilotContext",
  "title": "GitCode: Use Pull Request as Copilot Context",
  "icon": "$(sparkle)"
}
```

Add it to the PR node context menu:

```json
{
  "command": "gitcode.usePullRequestAsCopilotContext",
  "when": "view == pr:gitcode && viewItem == pullRequest",
  "group": "inline@3"
}
```

Add the chat participant contribution:

```json
{
  "chatParticipants": [
    {
      "id": "gitcode-pull-request.context",
      "name": "gitcodePullRequest",
      "fullName": "GitCode Pull Request",
      "description": "Reviews and explains the selected GitCode pull request when manually invoked."
    }
  ]
}
```

Do not add participant slash commands for the first version. The participant can inspect the user's natural language prompt and treat review, summarize, explain, and risk-check requests as normal prompts over the selected PR context.

## PR Selection State

Add a small state holder owned by the view layer:

```ts
export interface SelectedCopilotPullRequest {
  repository: GitCodeRepository;
  pullRequestNumber: number;
  title: string;
  url?: string;
}

export class CopilotPullRequestContextStore {
  private selected?: SelectedCopilotPullRequest;

  select(value: SelectedCopilotPullRequest): void {
    this.selected = value;
  }

  getSelected(): SelectedCopilotPullRequest | undefined {
    return this.selected;
  }

  clear(): void {
    this.selected = undefined;
  }
}
```

The store should be cleared when authentication changes or when the workspace changes.

Do not persist the selected PR initially. A stale persisted PR could point to a repository that is no longer open or authenticated.

## Command Behavior

Register the selection command near the existing pull request tree commands.

Expected command behavior:

1. Resolve `PullRequestNodeContext` from either the direct context object or the tree node.
2. Store repository, PR number, title, and URL.
3. Show a confirmation message.
4. Do not call Copilot or the language model from this command.

Sketch:

```ts
vscode.commands.registerCommand(
  COMMAND_ID.usePullRequestAsCopilotContext,
  async (context?: PullRequestNodeContext | PullRequestNode) => {
    const resolved = resolvePullRequestContext(context);
    if (!resolved) {
      logger.error('Cannot select pull request for Copilot context: invalid command context.');
      return;
    }

    copilotContextStore.select({
      repository: resolved.repository,
      pullRequestNumber: resolved.pullRequest.number,
      title: resolved.pullRequest.title,
      url: resolved.pullRequest.url,
    });

    vscode.window.showInformationMessage(
      `GitCode PR #${resolved.pullRequest.number} selected for Copilot context.`,
    );
  },
);
```

## Chat Participant Behavior

Register the participant during extension activation or view controller initialization.

Expected participant behavior:

1. Treat any `@gitcodePullRequest` request as an explicit manual request to use the selected PR.
2. Read the selected PR from `CopilotPullRequestContextStore`.
3. If missing, stream a short instruction telling the user to select a PR first.
4. Fetch PR detail, changed files, and comments.
5. Build a compact context prompt.
6. Forward the user's request and the PR context to `request.model`.
7. Stream the model response back to chat.

Sketch:

```ts
const participant = vscode.chat.createChatParticipant(
  'gitcode-pull-request.context',
  async (request, _context, stream, token) => {
    const selected = copilotContextStore.getSelected();
    if (!selected) {
      stream.markdown(
        'Select a GitCode pull request first with "GitCode: Use Pull Request as Copilot Context".',
      );
      return;
    }

    const pullRequestContext = await contextBuilder.build(selected, token);
    const response = await request.model.sendRequest([
      vscode.LanguageModelChatMessage.User(pullRequestContext),
      vscode.LanguageModelChatMessage.User(request.prompt),
    ], {
      justification: 'Use the selected GitCode pull request as manual chat context.',
    }, token);

    for await (const chunk of response.text) {
      stream.markdown(chunk);
    }
  },
);

participant.iconPath = new vscode.ThemeIcon('git-pull-request');
```

The participant should provide a review-oriented system instruction by default, while still allowing the user's prompt to steer the task:

```text
You are reviewing the selected GitCode pull request. Use the supplied PR details,
file changes, and comments. Prioritize correctness bugs, regressions, security
risks, unclear behavior, and missing tests. If the user asks for a different task,
follow that task using the same PR context.
```

This follows the same usability pattern as mature Git/Copilot integrations: the user invokes a named chat participant, and the participant gathers the relevant repository context behind the scenes.

## Tool Strategy

The implementation may use a tool internally, but the tool should not be the user-facing UX.

Recommended first version:

- Do not contribute a public `#prContext` tool.
- Do not require users to attach a tool manually.
- Implement the context builder as a normal TypeScript service called by the participant.
- Optionally refactor the builder behind a private `LanguageModelChatTool` later if the participant needs multi-step model/tool orchestration.

If a registered VS Code language model tool is later needed, keep it scoped by behavior:

- give it a unique name such as `gitcode_pull_request_context`
- do not document it as the primary user entry point
- only pass it to `request.model.sendRequest` from the `@gitcodePullRequest` participant when handling that participant request
- avoid enabling flows where generic Agent mode can choose the GitCode PR tool without the user invoking the GitCode participant

The manual contract remains:

```text
User typed @gitcodePullRequest -> extension may fetch and send selected PR context.
User did not type @gitcodePullRequest -> extension must not send PR context.
```

## Context Builder

Add a focused builder that depends on existing stores or services:

```text
src/view/copilot/
  copilotPullRequestContextStore.ts
  copilotPullRequestContextBuilder.ts
  registerCopilotPullRequestParticipant.ts
```

The builder should collect:

- repository full name and web URL
- PR number, title, state, author, source branch, target branch
- PR description
- changed files with status, additions, deletions, and patch when available
- general comments and unresolved diff comments

Keep the output text compact and bounded. Large pull requests should not send every patch in full.

Recommended limits:

- PR body: 8,000 characters
- comments: 50 newest comments
- files: 100 files
- per-file patch: 4,000 characters
- total context: 40,000 characters

When content is truncated, include an explicit marker:

```text
[truncated]
```

## API Usage

Use existing service methods where available:

```ts
pullRequestService.getPullRequest(repository, pullRequestNumber);
pullRequestService.listPullRequestFiles(repository, pullRequestNumber);
commentsStore.getComments(repository, pullRequestNumber);
```

If the comments store does not expose the exact method needed, add the narrowest method there instead of calling `CommentService` directly from the chat participant.

The participant should not know GitCode REST paths.

## Error Handling

Handle common failures with concise chat output:

- not signed in: ask the user to sign in to GitCode
- missing selection: ask the user to select a PR first
- deleted or inaccessible PR: say the selected PR could not be loaded
- model access denied: let VS Code surface the language model access error where possible
- cancellation: stop without showing an error notification

Use notifications only for explicit user commands, such as the PR selection command. Chat request failures should be streamed into chat when possible.

## Security And Privacy

- Do not include authentication tokens in chat context, logs, URIs, or error messages.
- Do not send PR context unless the user manually invokes `@gitcodePullRequest`.
- Do not make a public tool or `#` reference the first implementation's primary UX.
- Keep the selected PR in memory only.
- Respect VS Code language model consent prompts.

## Testing

Add unit tests for:

- resolving PR node command context
- selecting and clearing `CopilotPullRequestContextStore`
- context builder truncation
- context builder formatting
- missing-selection participant response
- participant using selected PR context without requiring a slash command

Manual verification:

1. Open a workspace with a GitCode repository configured.
2. Sign in.
3. Select a PR from the tree.
4. Run `GitCode: Use Pull Request as Copilot Context`.
5. Open Copilot Chat.
6. Send `@gitcodePullRequest summarize this PR`.
7. Confirm the answer references the selected PR number and files.
8. Start a new workspace or sign out and confirm the selection is cleared.

## Implementation Order

1. Add constants and `package.json` contributions.
2. Add `CopilotPullRequestContextStore`.
3. Register `gitcode.usePullRequestAsCopilotContext`.
4. Add the context builder.
5. Register `@gitcodePullRequest`.
6. Add tests for selection and context formatting.
7. Manually verify the chat flow with Copilot enabled.
