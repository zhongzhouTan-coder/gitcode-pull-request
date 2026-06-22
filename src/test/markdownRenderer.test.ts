import * as assert from 'assert';
import { renderMarkdown } from '../view/webview/markdown';

suite('MarkdownRenderer', () => {
	test('renders GFM table markup', () => {
		const html = renderMarkdown([
			'| A | B |',
			'| --- | --- |',
			'| 1 | 2 |',
		].join('\n'));

		assert.match(html, /<table>/);
		assert.match(html, /<th>A<\/th>/);
		assert.match(html, /<td>1<\/td>/);
	});

	test('renders safe images and strips unsafe sources', () => {
		const safeHtml = renderMarkdown('![diagram](https://example.com/image.png)');
		assert.match(safeHtml, /<img[^>]+src="https:\/\/example\.com\/image\.png"/);

		const unsafeHtml = renderMarkdown('![diagram](javascript:alert(1))');
		assert.doesNotMatch(unsafeHtml, /<img/);
		assert.match(unsafeHtml, /diagram/);
	});
});
