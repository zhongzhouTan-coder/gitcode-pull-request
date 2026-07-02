const TRUNCATED_MARKER = '\n[truncated]';

export class BudgetedContextWriter {
	private readonly parts: string[] = [];
	private usedChars = 0;
	private didTruncate = false;

	constructor(private readonly maxChars: number) {}

	append(value: string): boolean {
		if (!value) {
			return true;
		}

		if (this.remaining() <= 0) {
			this.didTruncate = true;
			return false;
		}

		if (value.length <= this.remaining()) {
			this.parts.push(value);
			this.usedChars += value.length;
			return true;
		}

		const marker = TRUNCATED_MARKER;
		const available = Math.max(0, this.remaining() - marker.length);
		if (available > 0) {
			this.parts.push(value.slice(0, available));
			this.usedChars += available;
		}
		if (this.remaining() >= marker.length) {
			this.parts.push(marker);
			this.usedChars += marker.length;
		}
		this.didTruncate = true;
		return false;
	}

	appendLine(value: string = ''): boolean {
		return this.append(`${value}\n`);
	}

	appendTruncated(value: string, maxChars: number): boolean {
		if (value.length <= maxChars) {
			return this.append(value);
		}

		this.didTruncate = true;
		return this.append(`${value.slice(0, Math.max(0, maxChars))}${TRUNCATED_MARKER}`);
	}

	remaining(): number {
		return Math.max(0, this.maxChars - this.usedChars);
	}

	wasTruncated(): boolean {
		return this.didTruncate;
	}

	toString(): string {
		return this.parts.join('').trimEnd();
	}
}
