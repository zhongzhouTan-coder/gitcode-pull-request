import { ApiRequestError } from '../../common/errors';
import { GitCodeRepository, IssueTemplateOption } from '../../common/models';
import { Logger } from '../../common/logger';
import { RawContentService } from '../../gitcode/services/rawContentService';

const TEMPLATE_CANDIDATE_PATHS = [
	'.gitcode/ISSUE_TEMPLATE.md',
	'.gitcode/issue_template.md',
	'.gitcode/ISSUE_TEMPLATE/bug.md',
	'.gitcode/ISSUE_TEMPLATE/feature.md',
	'.gitcode/ISSUE_TEMPLATE/question.md',
	'.github/ISSUE_TEMPLATE.md',
	'.github/issue_template.md',
	'.github/ISSUE_TEMPLATE/bug.md',
	'.github/ISSUE_TEMPLATE/feature.md',
	'.github/ISSUE_TEMPLATE/question.md',
	'.gitee/ISSUE_TEMPLATE.md',
	'.gitee/issue_template.md',
	'.gitee/ISSUE_TEMPLATE/bug.md',
	'.gitee/ISSUE_TEMPLATE/feature.md',
	'.gitee/ISSUE_TEMPLATE/question.md',
];

function templateLabelFromPath(path: string): string {
	const fileName = path.split('/').pop() ?? path;
	const baseName = fileName.replace(/\.md$/i, '').replace(/[_-]/g, ' ').trim();
	if (!baseName) {
		return path;
	}

	return baseName.replace(/\b\w/g, (char) => char.toUpperCase());
}

export class CreateIssueTemplateService {
	private readonly cache = new Map<string, IssueTemplateOption[]>();
	private readonly decoder = new TextDecoder('utf-8');

	constructor(
		private readonly rawContentService: RawContentService,
		private readonly logger: Logger,
	) {}

	async detectTemplates(repository: GitCodeRepository, defaultBranch: string): Promise<IssueTemplateOption[]> {
		const cacheKey = `${repository.fullName}@${defaultBranch}`;
		const cached = this.cache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const results = await Promise.all(TEMPLATE_CANDIDATE_PATHS.map(async (path) => {
			try {
				const bytes = await this.rawContentService.getFileContent(repository.owner, repository.name, defaultBranch, path);
				const body = this.decoder.decode(bytes);
				return {
					label: templateLabelFromPath(path),
					path,
					body,
					source: 'project' as const,
				};
			} catch (error) {
				if (error instanceof ApiRequestError && error.statusCode === 404) {
					return undefined;
				}

				this.logger.debug(`Create issue template read failed for ${repository.fullName}:${path}: ${error instanceof Error ? error.message : String(error)}`);
				return undefined;
			}
		}));

		const templates = results.filter((value): value is NonNullable<typeof value> => value !== undefined);
		this.cache.set(cacheKey, templates);
		return templates;
	}
}