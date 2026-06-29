import { GitCodeLabel } from '../../common/models';

export function mapLabel(dto: any): GitCodeLabel {
	return {
		id: Number(dto?.id ?? 0),
		name: String(dto?.name ?? ''),
		color: typeof dto?.color === 'string' ? dto.color : undefined,
	};
}

export function mapLabels(dtos: any[]): GitCodeLabel[] {
	return dtos.map(mapLabel);
}
