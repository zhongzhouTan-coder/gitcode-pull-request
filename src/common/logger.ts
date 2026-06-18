import * as vscode from 'vscode';

export class Logger implements vscode.Disposable {
	constructor(private readonly output: vscode.OutputChannel) {}

	info(message: string): void {
		this.output.appendLine(`[info] ${message}`);
	}

	error(message: string): void {
		this.output.appendLine(`[error] ${message}`);
	}

	debug(message: string): void {
		this.output.appendLine(`[debug] ${message}`);
	}

	dispose(): void {
		this.output.dispose();
	}
}
