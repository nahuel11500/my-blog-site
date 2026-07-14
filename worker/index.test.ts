import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPageView, referrerHost } from './index.ts';

const html = (status = 200) =>
	new Response('', { status, headers: { 'content-type': 'text/html;charset=utf-8' } });

const navigation = (headers: Record<string, string> = {}) =>
	new Request('https://nahuelcanavy.com/blog/linux_process/', {
		headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', ...headers },
	});

test('counts a real browser navigation', () => {
	assert.equal(isPageView(navigation(), html()), true);
});

test('ignores clients that send no Sec-Fetch headers', () => {
	const bare = new Request('https://nahuelcanavy.com/');
	const crawler = new Request('https://nahuelcanavy.com/', {
		headers: { 'user-agent': 'Googlebot/2.1' },
	});

	assert.equal(isPageView(bare, html()), false);
	assert.equal(isPageView(crawler, html()), false);
});

test('ignores subresource fetches, prefetches and non-pages', () => {
	const xhr = new Request('https://nahuelcanavy.com/', {
		headers: { 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' },
	});
	const post = new Request('https://nahuelcanavy.com/', {
		method: 'POST',
		headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' },
	});
	const font = new Response('', { headers: { 'content-type': 'font/woff2' } });

	assert.equal(isPageView(xhr, html()), false);
	assert.equal(isPageView(post, html()), false);
	assert.equal(isPageView(navigation({ 'sec-purpose': 'prefetch' }), html()), false);
	assert.equal(isPageView(navigation(), html(404)), false);
	assert.equal(isPageView(navigation(), font), false);
});

test('keeps the referrer host but never the query', () => {
	const from = (referer?: string) =>
		referrerHost(
			new Request('https://nahuelcanavy.com/', {
				headers: referer ? { referer } : {},
			}),
			'nahuelcanavy.com',
		);

	assert.equal(from(), 'direct');
	assert.equal(from('https://news.ycombinator.com/item?id=1'), 'news.ycombinator.com');
	assert.equal(from('https://www.google.com/search?q=private+search+terms'), 'www.google.com');
	assert.equal(from('https://nahuelcanavy.com/blog/'), 'internal');
	assert.equal(from('not-a-url'), 'unknown');
});
