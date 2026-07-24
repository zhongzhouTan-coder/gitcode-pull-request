import * as vscode from 'vscode';
import * as path from 'path';
import { CreatePullRequestInitialIssueContext } from '../../common/models';

const TEMPLATE_DIR = '.gitcode/PULL_REQUEST_TEMPLATE';

export interface DiscoveredTemplate {
	label: string;
	description?: string;
	content: string;
}

export interface TemplatePlaceholders {
	issueNumber?: number;
	issueTitle?: string;
	issueUrl?: string;
	sourceBranch?: string;
	targetBranch?: string;
	repository?: string;
}

/**
 * Discovers and loads pull request templates from the workspace root.
 */
export class PullRequestTemplateService {
	/**
	 * Discover PR templates relative to the given workspace folder.
	 * Returns templates sorted alphabetically by label.
	 */
	async discoverTemplates(workspaceFolder: vscode.WorkspaceFolder): Promise<DiscoveredTemplate[]> {
		const results: DiscoveredTemplate[] = [];
		let hasSingleFileDefault = false;

		// Check single-file template: .gitcode/PULL_REQUEST_TEMPLATE.md
		const singlePath = path.join(workspaceFolder.uri.fsPath, `${TEMPLATE_DIR}.md`);
		try {
			const content = await this.readFileIfExists(vscode.Uri.file(singlePath));
			if (content !== undefined) {
				results.push({ label: 'Default', description: `${TEMPLATE_DIR}.md`, content });
				hasSingleFileDefault = true;
			}
		} catch {
			// File doesn't exist
		}

		// Check directory templates: .gitcode/PULL_REQUEST_TEMPLATE/*.md
		const dirPath = path.join(workspaceFolder.uri.fsPath, TEMPLATE_DIR);
		try {
			const dirUri = vscode.Uri.file(dirPath);
			const entries = await vscode.workspace.fs.readDirectory(dirUri);
			for (const [name, fileType] of entries) {
				if (fileType !== vscode.FileType.File || !name.endsWith('.md')) {
					continue;
				}

				// Avoid duplicate "Default" label when single-file template already exists
				if (name === 'default.md' && hasSingleFileDefault) {
					continue;
				}

				const fileUri = vscode.Uri.file(path.join(dirPath, name));
				const content = await this.readFileIfExists(fileUri);
				if (content !== undefined) {
					const label = name === 'default.md' ? 'Default' : name.replace(/\.md$/i, '');
					const description = name === 'default.md' ? `${TEMPLATE_DIR}/default.md` : `${TEMPLATE_DIR}/${name}`;
					results.push({ label, description, content });
				}
			}
		} catch {
			// Directory doesn't exist
		}

		return results.sort((a, b) => {
			// Default first
			if (a.label === 'Default') {
				return -1;
			}
			if (b.label === 'Default') {
				return 1;
			}
			return a.label.localeCompare(b.label);
		});
	}

	/**
	 * Apply supported placeholders to template content.
	 * Unknown placeholders (e.g., {{test_results}}) are left unchanged.
	 */
	applyPlaceholders(template: string, placeholders: TemplatePlaceholders): string {
		let result = template;

		if (placeholders.issueNumber !== undefined) {
			result = result.replace(/\{\{issue_number\}\}/g, String(placeholders.issueNumber));
		}
		if (placeholders.issueTitle !== undefined) {
			result = result.replace(/\{\{issue_title\}\}/g, placeholders.issueTitle);
		}
		if (placeholders.issueUrl !== undefined) {
			result = result.replace(/\{\{issue_url\}\}/g, placeholders.issueUrl);
		}
		if (placeholders.sourceBranch !== undefined) {
			result = result.replace(/\{\{source_branch\}\}/g, placeholders.sourceBranch);
		}
		if (placeholders.targetBranch !== undefined) {
			result = result.replace(/\{\{target_branch\}\}/g, placeholders.targetBranch);
		}
		if (placeholders.repository !== undefined) {
			result = result.replace(/\{\{repository\}\}/g, placeholders.repository);
		}

		return result;
	}

	/**
	 * Build a template-based PR body from an issue context and branch info.
	 */
	async buildPrBodyFromTemplate(
		workspaceFolder: vscode.WorkspaceFolder,
		issue?: CreatePullRequestInitialIssueContext,
		sourceBranch?: string,
		targetBranch?: string,
		repository?: string,
	): Promise<string | undefined> {
		const templates = await this.discoverTemplates(workspaceFolder);

		if (templates.length === 0) {
			return undefined;
		}

		let template: DiscoveredTemplate;
		if (templates.length === 1) {
			template = templates[0];
		} else {
			const pick = await vscode.window.showQuickPick(
				templates.map((t) => ({
					label: t.label,
					description: t.description,
					template: t,
				})),
				{
					placeHolder: 'Select a pull request template',
					canPickMany: false,
				},
			);
			if (!pick) {
				return undefined;
			}
			template = pick.template;
		}

		return this.applyPlaceholders(template.content, {
			issueNumber: issue?.issueNumber,
			issueTitle: issue?.issueTitle,
			issueUrl: issue?.issueUrl,
			sourceBranch,
			targetBranch,
			repository,
		});
	}

	private async readFileIfExists(uri: vscode.Uri): Promise<string | undefined> {
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			return Buffer.from(bytes).toString('utf-8');
		} catch {
			return undefined;
		}
	}
}
