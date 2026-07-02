import { AddedPullRequestRelatedIssue } from '../../common/models';

function mapSingle(dto: any): AddedPullRequestRelatedIssue {
	return {
		id: Number(dto?.id ?? 0),
		number: Number(dto?.number ?? 0),
		title: String(dto?.title ?? ''),
	};
}

/**
 * Maps the raw GitCode POST /pulls/:number/issues API response
 * to an array of `AddedPullRequestRelatedIssue` summaries.
 */
export function mapAddedPullRequestRelatedIssues(dto: unknown): AddedPullRequestRelatedIssue[] {
	if (!Array.isArray(dto)) {
		return [];
	}

	return dto.map(mapSingle);
}
