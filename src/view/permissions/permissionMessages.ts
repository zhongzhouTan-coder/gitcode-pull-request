import * as vscode from 'vscode';
import { GitCodeRepository } from '../../common/models';

export function showPermissionDeniedWarning(message: string): void {
	vscode.window.showWarningMessage(message);
}

export function showPermissionVerificationFailed(repository: GitCodeRepository): void {
	vscode.window.showWarningMessage(
		`Unable to verify GitCode permissions for ${repository.fullName}. Try again or continue on GitCode.`,
	);
}

// ---- Pre-built permission messages ----

export function createIssueDeniedMessage(repository: GitCodeRepository): string {
	return `You do not have permission to create issues in ${repository.fullName}.`;
}

export function updateIssueDeniedMessage(repository: GitCodeRepository): string {
	return `You do not have permission to update issues in ${repository.fullName}.`;
}

export function createPullRequestDeniedMessage(repository: GitCodeRepository): string {
	return `You do not have permission to create pull requests in ${repository.fullName}.`;
}

export function updatePullRequestDeniedMessage(repository: GitCodeRepository): string {
	return `You do not have permission to update pull requests in ${repository.fullName}.`;
}

export function closePullRequestDeniedMessage(repository: GitCodeRepository): string {
	return `You do not have permission to close pull requests in ${repository.fullName}.`;
}

export function reopenPullRequestDeniedMessage(repository: GitCodeRepository): string {
	return `You do not have permission to reopen pull requests in ${repository.fullName}.`;
}

export function createCommentDeniedMessage(repository: GitCodeRepository): string {
	return `You do not have permission to comment in ${repository.fullName}.`;
}

export function editCommentDeniedMessage(repository: GitCodeRepository): string {
	return `You do not have permission to edit comments in ${repository.fullName}.`;
}

export function resolveCommentDeniedMessage(repository: GitCodeRepository): string {
	return `You do not have permission to resolve comments in ${repository.fullName}.`;
}

export function createBranchDeniedMessage(repository: GitCodeRepository): string {
	return `You do not have permission to create branches in ${repository.fullName}.`;
}
