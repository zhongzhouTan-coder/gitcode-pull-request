import * as assert from 'assert';
import { mapAddedPullRequestRelatedIssues } from '../gitcode/mappers/addedPullRequestRelatedIssueMapper';

suite('AddedPullRequestRelatedIssueMapper', () => {
	test('maps the sample response from the API documentation', () => {
		const response = [
			{
				id: 4126451,
				number: '1',
				title: 'issue title',
			},
		];

		const result = mapAddedPullRequestRelatedIssues(response);

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].id, 4126451);
		assert.strictEqual(result[0].number, 1);
		assert.strictEqual(result[0].title, 'issue title');
	});

	test('normalizes string issue numbers to numbers', () => {
		const response = [
			{ id: '100', number: '42', title: 'Foo' },
		];

		const result = mapAddedPullRequestRelatedIssues(response);

		assert.strictEqual(result[0].id, 100);
		assert.strictEqual(result[0].number, 42);
	});

	test('normalizes missing titles to an empty string', () => {
		const response = [
			{ id: 1, number: 2 },
		];

		const result = mapAddedPullRequestRelatedIssues(response);

		assert.strictEqual(result[0].title, '');
	});

	test('returns an empty array for a non-array payload', () => {
		const result = mapAddedPullRequestRelatedIssues({ error: 'not an array' });

		assert.deepStrictEqual(result, []);
	});

	test('returns an empty array for null or undefined payload', () => {
		assert.deepStrictEqual(mapAddedPullRequestRelatedIssues(null), []);
		assert.deepStrictEqual(mapAddedPullRequestRelatedIssues(undefined), []);
	});

	test('maps multiple items', () => {
		const response = [
			{ id: 1, number: '100', title: 'First' },
			{ id: 2, number: '200', title: 'Second' },
		];

		const result = mapAddedPullRequestRelatedIssues(response);

		assert.strictEqual(result.length, 2);
		assert.strictEqual(result[0].id, 1);
		assert.strictEqual(result[0].number, 100);
		assert.strictEqual(result[0].title, 'First');
		assert.strictEqual(result[1].id, 2);
		assert.strictEqual(result[1].number, 200);
		assert.strictEqual(result[1].title, 'Second');
	});

	test('handles missing id and number fields gracefully', () => {
		const response = [{}];

		const result = mapAddedPullRequestRelatedIssues(response);

		assert.strictEqual(result[0].id, 0);
		assert.strictEqual(result[0].number, 0);
		assert.strictEqual(result[0].title, '');
	});
});
