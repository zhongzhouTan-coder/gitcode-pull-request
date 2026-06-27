import * as vscode from 'vscode';
import { PullRequestService } from '../../gitcode/services/pullRequestService';
import { CommentService } from '../../gitcode/services/commentService';
import { SelectedCopilotPullRequest } from './copilotPullRequestContextStore';
import {
	PullRequestFileChange,
	PullRequestComment,
	PullRequestDiffComment,
} from '../../common/models';

const MAX_BODY_CHARS = 8_000;
const MAX_COMMENTS = 50;
const MAX_FILES = 100;
const MAX_FILE_PATCH_CHARS = 4_000;
const MAX_TOTAL_CHARS = 40_000;

export class CopilotPullRequestContextBuilder {
	constructor(
		private readonly pullRequestService: PullRequestService,
		private readonly commentService: CommentService,
	) {}

	async build(
		selected: SelectedCopilotPullRequest,
		token: vscode.CancellationToken,
	): Promise<string> {
		const { repository, pullRequestNumber } = selected;
		const parts: string[] = [];

		// 1. Pull request detail
		try {
			const detail = await this.pullRequestService.getPullRequest(repository, pullRequestNumber);
			if (token.isCancellationRequested) { return ''; }

			parts.push(`## Pull Request #${detail.number}: ${detail.title}`);
			parts.push(`State: ${detail.state}`);
			parts.push(`Author: ${detail.author.login}`);
			parts.push(`Source: ${detail.source.label} → Target: ${detail.target.label}`);
			parts.push(`Created: ${detail.createdAt} | Updated: ${detail.updatedAt}`);
			if (detail.url) {
				parts.push(`URL: ${detail.url}`);
			}
			parts.push('');

			if (detail.body) {
				parts.push('### Description');
				parts.push(truncate(detail.body, MAX_BODY_CHARS));
				parts.push('');
			}
		} catch (error) {
			throw new Error(
				`Unable to load pull request #${pullRequestNumber} from ${repository.fullName}: ${errorMessage(error)}`,
			);
		}

		if (token.isCancellationRequested) { return ''; }

		// 2. Changed files
		try {
			const files = await this.pullRequestService.listPullRequestFiles(repository, pullRequestNumber);
			if (token.isCancellationRequested) { return ''; }

			const fileLimit = Math.min(files.length, MAX_FILES);
			const truncated = files.length > MAX_FILES;
			parts.push(`### Changed Files (${fileLimit}${truncated ? ` of ${files.length}` : ''})`);
			parts.push('');

			for (let i = 0; i < fileLimit; i++) {
				const file = files[i];
				const statusLabel = fileStatusLabel(file);
				const line = `- \`${file.path}\` (${statusLabel}, +${file.additions} -${file.deletions})`;
				parts.push(line);

				if (file.patch && !file.tooLarge) {
					parts.push('```diff');
					parts.push(truncate(file.patch, MAX_FILE_PATCH_CHARS));
					parts.push('```');
					parts.push('');
				}
			}

			if (truncated) {
				parts.push(`[truncated: ${files.length - MAX_FILES} more files not shown]`);
				parts.push('');
			}
		} catch (error) {
			throw new Error(
				`Unable to load changed files for pull request #${pullRequestNumber} from ${repository.fullName}: ${errorMessage(error)}`,
			);
		}

		if (token.isCancellationRequested) { return ''; }

		// 3. Comments
		try {
			const comments = await this.commentService.listPullRequestComments(repository, pullRequestNumber, {
				limit: MAX_COMMENTS,
				newestFirst: true,
			});
			if (token.isCancellationRequested) { return ''; }

			const recent = comments;

			if (recent.length > 0) {
				parts.push(`### Recent Comments (${recent.length})`);
				parts.push('');

				for (const comment of recent) {
					const author = comment.author.login;
					const date = comment.createdAt;
					const location = isDiffComment(comment)
						? ` on \`${comment.location.path || 'unknown'}\` (lines ${comment.location.startLine}-${comment.location.endLine})`
						: '';

					parts.push(`**${author}** at ${date}${location}:`);
					parts.push(truncate(comment.body, 2_000));
					parts.push('');

					// Include replies
					if (comment.replies.length > 0) {
						for (const reply of comment.replies) {
							parts.push(`  > **${reply.author.login}** (${reply.createdAt}):`);
							parts.push(`  > ${truncate(reply.body, 1_000)}`);
							parts.push('');
						}
					}
				}

				if (recent.length === MAX_COMMENTS) {
					parts.push(`[limited to the ${MAX_COMMENTS} most recent comments]`);
					parts.push('');
				}
			}
		} catch (error) {
			throw new Error(
				`Unable to load comments for pull request #${pullRequestNumber} from ${repository.fullName}: ${errorMessage(error)}`,
			);
		}

		// Build final payload
		const raw = parts.join('\n');
		return truncate(raw, MAX_TOTAL_CHARS);
	}
}

function fileStatusLabel(file: PullRequestFileChange): string {
	switch (file.status) {
		case 'added': return 'added';
		case 'modified': return 'modified';
		case 'deleted': return 'deleted';
		case 'renamed': return file.previousPath ? `renamed from ${file.previousPath}` : 'renamed';
		default: return file.status;
	}
}

function isDiffComment(comment: PullRequestComment): comment is PullRequestDiffComment {
	return comment.kind === 'diff';
}

function truncate(value: string, maxChars: number): string {
	if (value.length <= maxChars) {
		return value;
	}
	return value.slice(0, maxChars) + '\n[truncated]';
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
