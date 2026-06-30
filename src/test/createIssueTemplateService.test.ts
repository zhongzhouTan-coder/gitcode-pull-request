import * as assert from 'assert';
import { ApiRequestError } from '../common/errors';
import { GitCodeRepository } from '../common/models';
import { CreateIssueTemplateService } from '../view/createIssue/createIssueTemplateService';

suite('CreateIssueTemplateService', () => {
	const repository: GitCodeRepository = {
		remoteName: 'origin',
		owner: 'org',
		name: 'repo',
		fullName: 'org/repo',
		webUrl: 'https://gitcode.com/org/repo',
	};

	test('detects supported project template paths and ignores 404s', async () => {
		const requestedPaths: string[] = [];
		const service = new CreateIssueTemplateService(
			{
				getFileContent: async (_owner: string, _repo: string, _sha: string, path: string) => {
					requestedPaths.push(path);
					if (path === '.gitcode/ISSUE_TEMPLATE.md') {
						return new TextEncoder().encode('project root');
					}
					if (path === '.github/ISSUE_TEMPLATE/bug.md') {
						return new TextEncoder().encode('bug template');
					}

					throw new ApiRequestError('Not found', 404);
				},
			} as any,
			{ debug: () => undefined } as any,
		);

		const templates = await service.detectTemplates(repository, 'main');

		assert.ok(requestedPaths.includes('.gitcode/ISSUE_TEMPLATE.md'));
		assert.ok(requestedPaths.includes('.github/ISSUE_TEMPLATE/bug.md'));
		assert.deepStrictEqual(templates.map((template) => template.path), [
			'.gitcode/ISSUE_TEMPLATE.md',
			'.github/ISSUE_TEMPLATE/bug.md',
		]);
	});
});