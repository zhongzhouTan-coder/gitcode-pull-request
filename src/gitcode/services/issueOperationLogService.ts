import { GitCodeRepository, IssueOperationLog } from '../../common/models';
import { GitCodeWriteClient } from '../client/gitcodeClient';
import { mapIssueOperationLogs } from '../mappers/issueOperationLogMapper';

export class IssueOperationLogService {
	constructor(private readonly client: GitCodeWriteClient) {}

	async listIssueOperationLogs(
		repository: GitCodeRepository,
		issueNumber: number,
	): Promise<IssueOperationLog[]> {
		const response = await this.client.get<unknown[]>(
			`/api/v5/repos/${encodeURIComponent(repository.owner)}/issues/${issueNumber}/operate_logs`,
			{ repo: repository.name },
		);

		return mapIssueOperationLogs(Array.isArray(response) ? response : []);
	}
}
