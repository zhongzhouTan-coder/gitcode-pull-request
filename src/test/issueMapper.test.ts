import * as assert from 'assert';
import { GitCodeRepository } from '../common/models';
import { mapEditIssueInput } from '../gitcode/mappers/issueMapper';

suite('IssueMapper', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	test('maps edit issue input to the API request body', () => {
		const body = mapEditIssueInput(repository, {
			title: 'Refine issue editing',
			body: 'Keep edits inline',
			state: 'reopen',
			assignees: 'alice,bob',
			milestoneNumber: 12,
			labels: 'bug,ui',
			securityHole: false,
		});

		assert.deepStrictEqual(body, {
			repo: 'repo',
			title: 'Refine issue editing',
			body: 'Keep edits inline',
			state: 'reopen',
			assignee: 'alice,bob',
			milestone: 12,
			labels: 'bug,ui',
			security_hole: false,
		});
	});

	test('maps null milestone as an explicit clear value', () => {
		const body = mapEditIssueInput(repository, {
			title: 'Clear milestone',
			milestoneNumber: null,
		});

		assert.deepStrictEqual(body, {
			repo: 'repo',
			title: 'Clear milestone',
			milestone: null,
		});
	});
});
