import * as assert from 'assert';
import { getCreateIssueHtml } from '../view/createIssue/createIssueHtml';

suite('CreateIssueHtml', () => {
	test('allows manually typed labels and assignees to be submitted', () => {
		const html = getCreateIssueHtml();

		assert.match(html, /Select labels or type comma-separated label names\./);
		assert.match(html, /Select assignees or type comma-separated usernames\./);
		assert.match(html, /const labelPicker = createMultiPicker\(labelsInput, labelOptions, selectedLabels, \{ allowCustom: true \}\);/);
		assert.match(html, /const assigneePicker = createMultiPicker\(assigneesInput, assigneeOptions, selectedAssignees, \{ allowCustom: true \}\);/);
		assert.match(html, /function valuesWithPendingInput\(\)/);
		assert.match(html, /for \(const value of splitInput\(input\.value\)\)/);
	});
});
