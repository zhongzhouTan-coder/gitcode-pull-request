import * as vscode from 'vscode';
import { COMMAND_ID } from '../../common/constants';
import { Logger } from '../../common/logger';
import { RepositoryContextService } from '../../common/git/repositoryContext';
import { LocalGitService, issueBranchSlug } from '../../common/git/localGitService';
import { GitRepository } from '../../common/git/gitTypes';
import { CopilotIssueContextStore, SelectedCopilotIssue } from '../copilot/copilotIssueContextStore';
import {
	resolveIssueCommandContext,
	getIssueGitRepository,
	pickIssueBranchBase,
} from './issueCommandHelpers';

interface RegisterSettleIssueCommandsOptions {
	copilotIssueContextStore: CopilotIssueContextStore;
	repositoryContext: RepositoryContextService;
	logger: Logger;
}

export function registerSettleIssueCommands(options: RegisterSettleIssueCommandsOptions): vscode.Disposable {
	const { copilotIssueContextStore, repositoryContext, logger } = options;
	const gitService = new LocalGitService();

	return vscode.commands.registerCommand(
		COMMAND_ID.settleIssueWithAgent,
		async (context?: unknown) => {
			const resolved = resolveIssueCommandContext(context);
			if (!resolved) {
				// Try to get from current copilot context
				const selected = copilotIssueContextStore.getSelected();
				if (!selected) {
					vscode.window.showWarningMessage(
						'Select a GitCode issue first. Use "GitCode: Use Issue as Copilot Context" from the issues tree.',
					);
					return;
				}

				await startSettleFlow(selected, copilotIssueContextStore, repositoryContext, gitService, logger);
				return;
			}

			const selected: SelectedCopilotIssue = {
				repository: resolved.repository,
				issueNumber: resolved.issueNumber,
				title: resolved.title,
				url: resolved.url,
			};

			// Store issue context
			copilotIssueContextStore.select(selected);

			await startSettleFlow(selected, copilotIssueContextStore, repositoryContext, gitService, logger);
		},
	);
}

async function startSettleFlow(
	selected: SelectedCopilotIssue,
	copilotIssueContextStore: CopilotIssueContextStore,
	repositoryContext: RepositoryContextService,
	gitService: LocalGitService,
	logger: Logger,
): Promise<void> {
	// Resolve the matching local git repository
	const gitRepo = await getIssueGitRepository(repositoryContext, selected.repository, logger);
	if (!gitRepo) {
		vscode.window.showErrorMessage(
			`No open local repository matches GitCode repository ${selected.repository.fullName}. Open the repository first.`,
		);
		return;
	}

	// Branch setup
	const branchChoice = await vscode.window.showQuickPick(
		[
			{
				label: 'Create issue branch',
				description: 'Create a new branch for this issue from a selected base',
				id: 'create' as const,
			},
			{
				label: 'Use current branch',
				description: 'Continue on the current branch without creating a new one',
				id: 'current' as const,
			},
		],
		{
			placeHolder: `Settle issue #${selected.issueNumber} — choose branch setup`,
			canPickMany: false,
		},
	);

	if (!branchChoice) {
		return;
	}

	let branchName: string | undefined;

	if (branchChoice.id === 'create') {
		// Pick base branch
		const base = await pickIssueBranchBase(gitService, gitRepo, logger);
		if (!base) {
			return;
		}

		// Default branch name from issue
		const defaultBranchName = issueBranchSlug(selected.issueNumber, selected.title);

		const inputBranch = await vscode.window.showInputBox({
			prompt: 'Enter the issue branch name',
			value: defaultBranchName,
			validateInput: async (value) => {
				if (!value.trim()) {
					return 'Branch name is required.';
				}
				if (await gitService.branchExists(gitRepo, value.trim())) {
					return 'A branch with this name already exists.';
				}
				return undefined;
			},
		});

		if (!inputBranch?.trim()) {
			return;
		}

		branchName = inputBranch.trim();

		// Fetch if remote base
		if (base.remoteName && base.branchName) {
			try {
				await gitService.fetchBranch(gitRepo, base.remoteName, base.branchName);
			} catch (error) {
				vscode.window.showErrorMessage(
					`Failed to fetch ${base.label}: ${error instanceof Error ? error.message : String(error)}`,
				);
				return;
			}
		}

		// Create and checkout branch
		try {
			await gitService.createAndCheckoutBranch(gitRepo, branchName, base.startPoint);
			const baseMessage = base.startPoint ? ` from ${base.startPoint}` : '';
			vscode.window.showInformationMessage(`Created and checked out branch "${branchName}"${baseMessage}.`);
		} catch (error) {
			vscode.window.showErrorMessage(
				`Failed to create branch: ${error instanceof Error ? error.message : String(error)}`,
			);
			return;
		}
	} else {
		// Use current branch
		branchName = await gitService.getCurrentBranch(gitRepo);
		if (!branchName) {
			vscode.window.showErrorMessage('Cannot determine the current branch.');
			return;
		}
	}

	// Keep issue context aligned
	copilotIssueContextStore.select(selected);

	// Build and open Agent prompt
	await openAgentMode(selected, gitRepo, branchName, logger);
}

async function openAgentMode(
	selected: SelectedCopilotIssue,
	gitRepo: GitRepository,
	branchName: string,
	logger: Logger,
): Promise<void> {
	const prompt = buildAgentPrompt(selected, gitRepo, branchName);

	// Open Agent mode via chat.
	// NOTE: isAgentMode is an undocumented VS Code API property on
	// workbench.action.chat.open. It may break on VS Code updates.
	// If it stops working, the catch block provides a clipboard fallback.
	try {
		await vscode.commands.executeCommand('workbench.action.chat.open', {
			query: prompt,
			isAgentMode: true,
		});
	} catch {
		// Fallback: open chat without agent mode flag
		logger.debug('workbench.action.chat.open with isAgentMode failed, falling back to openWith');
		try {
			await vscode.commands.executeCommand('workbench.action.chat.open');
			// Copy prompt to clipboard so user can paste it
			await vscode.env.clipboard.writeText(prompt);
			vscode.window.showInformationMessage(
				'Agent prompt copied to clipboard. Paste it in Agent mode (Ctrl+Shift+I) to start.',
			);
		} catch (fallbackError) {
			logger.error(`Failed to open chat: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
			vscode.window.showErrorMessage('Failed to open Agent mode. Please use Agent mode manually with the instructions shown.');
		}
	}
}

function buildAgentPrompt(
	selected: SelectedCopilotIssue,
	gitRepo: GitRepository,
	branchName: string,
): string {
	// NOTE: The tool names below (gitcode_get_issue_context,
	// gitcode_get_pull_request_context) must match the toolReferenceName
	// values declared in package.json. If they are renamed there,
	// this prompt must be updated as well.
	return `Use authenticated GitCode context for this issue:

Repository: ${selected.repository.fullName}
Issue: #${selected.issueNumber} ${selected.title}
Branch: ${branchName}

When you need issue details, call gitcode_get_issue_context with:
- repository: "${selected.repository.fullName}"
- issue_number: ${selected.issueNumber}

If related pull requests are listed and you need pull request details, call
gitcode_get_pull_request_context with:
- repository: the related pull request repository shown in the issue context, or "${selected.repository.fullName}" when no separate repository is shown
- pull_request_number: <pull request number>

Implement the issue in this workspace.

Requirements:
1. Read the authenticated GitCode issue context with explicit tool inputs.
2. Inspect relevant local files before editing.
3. Keep the change scoped to the selected issue.
4. Add or update tests for changed behavior.
5. Run appropriate validation commands.
6. Summarize changed files, validation result, and remaining risk.
7. Inspect recent commit messages and suggest a commit message that matches this repository's style.
8. Decide the next settlement step from the current repository state, such as continuing implementation, committing, publishing, or creating a pull request.
9. Do not commit, push, or create a pull request unless the user explicitly asks and an approved tool or command is available.`;
}
