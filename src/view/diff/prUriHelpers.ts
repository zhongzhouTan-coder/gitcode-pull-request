import * as vscode from 'vscode';
import { GITCODE_PR_SCHEME } from '../../common/constants';
import { DiffSide } from '../../common/models';

interface PrUriParams {
	owner: string;
	repo: string;
	pullRequestNumber: number;
	side: DiffSide;
	sha?: string;
	path: string;
}

/**
 * Build a read-only virtual URI pointing at a PR file side.
 * The URI is handled by GitCodePullRequestFileSystemProvider.
 */
export function buildPrUri(params: PrUriParams): vscode.Uri {
	const { owner, repo, pullRequestNumber, side, sha, path } = params;

	const query = JSON.stringify({
		pr: pullRequestNumber,
		side,
		sha: sha ?? '',
		path,
	});

	// Encode each path segment individually to preserve '/' separators.
	// Using encodeURIComponent on the whole path would turn '/' into '%2F',
	// causing the diff editor tab to display a garbled file path.
	const encodedPath = path
		.split('/')
		.map(segment => encodeURIComponent(segment))
		.join('/');

	return vscode.Uri.from({
		scheme: GITCODE_PR_SCHEME,
		authority: `${owner}/${repo}`,
		path: `/${encodedPath}`,
		query,
	});
}

/**
 * Build an empty virtual URI for the missing side of an added or deleted file.
 */
export function buildEmptyPrUri(owner: string, repo: string, pullRequestNumber: number, fileName: string): vscode.Uri {
	return buildPrUri({
		owner,
		repo,
		pullRequestNumber,
		side: 'empty',
		sha: '',
		path: fileName,
	});
}

/**
 * Parse a virtual PR URI back into its components. Returns undefined if the URI
 * does not match the expected scheme/format.
 */
export function parsePrUri(uri: vscode.Uri): PrUriParams | undefined {
	if (uri.scheme !== GITCODE_PR_SCHEME) {
		return undefined;
	}

	const [owner, repo] = uri.authority.split('/');
	if (!owner || !repo) {
		return undefined;
	}

	let query: Record<string, unknown>;
	try {
		query = JSON.parse(uri.query);
	} catch {
		return undefined;
	}

	const pr = Number(query.pr);
	if (isNaN(pr)) {
		return undefined;
	}

	const side = query.side as DiffSide;
	if (side !== 'base' && side !== 'head' && side !== 'empty') {
		return undefined;
	}

	const sha = typeof query.sha === 'string' ? query.sha : '';
	const path = typeof query.path === 'string' ? query.path : '';

	return {
		owner,
		repo,
		pullRequestNumber: pr,
		side,
		sha: sha || undefined,
		path,
	};
}

/**
 * Build a descriptive title for the diff editor tab.
 */
export function buildDiffTitle(filePath: string, pullRequestNumber: number): string {
	const segments = filePath.split('/');
	const fileName = segments[segments.length - 1];
	return `${fileName} (Pull Request #${pullRequestNumber})`;
}
