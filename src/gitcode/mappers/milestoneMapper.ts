import { GitCodeMilestone } from '../../common/models';

export function mapMilestone(dto: any): GitCodeMilestone {
	return {
		number: Number(dto?.number ?? dto?.iid ?? dto?.id ?? 0),
		title: String(dto?.title ?? ''),
		state: String(dto?.state ?? ''),
		dueOn: typeof dto?.due_on === 'string' ? dto.due_on : typeof dto?.dueOn === 'string' ? dto.dueOn : undefined,
	};
}

export function mapMilestones(dtos: any[]): GitCodeMilestone[] {
	return dtos.map(mapMilestone);
}
