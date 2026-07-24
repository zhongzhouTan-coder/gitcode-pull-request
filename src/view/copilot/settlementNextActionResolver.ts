import { SelectedCopilotIssue } from '../copilot/copilotIssueContextStore';
import { COMMAND_ID } from '../../common/constants';

export type SettlementStep = 'start';

export interface SettlementAction {
	step: SettlementStep;
	label: string;
	commandId: string;
}

export class SettlementNextActionResolver {
	/**
	 * Resolve the next settlement action for the selected issue.
	 * Currently always returns the 'start' action regardless of input.
	 * The _selected parameter is reserved for future multi-step settlement
	 * flows (e.g., 'continue', 'commit', 'publish', 'create-pr').
	 */
	async resolve(_selected: SelectedCopilotIssue | undefined): Promise<SettlementAction> {
		return this.action('start', 'Settle with Agent', COMMAND_ID.settleIssueWithAgent);
	}

	private action(
		step: SettlementStep,
		label: string,
		commandId: string,
	): SettlementAction {
		return { step, label, commandId };
	}

}
