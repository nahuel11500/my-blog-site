import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { botReason, isPageView, isRead, referrerHost } from './index.ts';

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

const CHROME =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const readUrl = new URL('https://nahuelcanavy.com/read/linux_process/');
const beaconFetch = (headers: Record<string, string> = {}, url = readUrl) =>
	new Request(url, {
		headers: {
			'sec-fetch-dest': 'image',
			'sec-fetch-mode': 'no-cors',
			referer: 'https://nahuelcanavy.com/blog/linux_process/',
			...headers,
		},
	});

test('counts a read when the post itself loads its end-of-post image', () => {
	assert.equal(isRead(beaconFetch(), readUrl, 'linux_process'), true);
});

test('ignores reads that do not come from that post on this site', () => {
	const bare = new Request(readUrl);
	const otherPost = beaconFetch({ referer: 'https://nahuelcanavy.com/blog/cgroup_namespaces/' });
	const otherSite = beaconFetch({ referer: 'https://evil.example/blog/linux_process/' });
	const navigation = beaconFetch({ 'sec-fetch-dest': 'document' });

	assert.equal(isRead(bare, readUrl, 'linux_process'), false);
	assert.equal(isRead(otherPost, readUrl, 'linux_process'), false);
	assert.equal(isRead(otherSite, readUrl, 'linux_process'), false);
	assert.equal(isRead(navigation, readUrl, 'linux_process'), false);
});

test('flags automated clients by user-agent or datacenter network', () => {
	assert.equal(botReason(CHROME, 3215), null); // a home ISP
	assert.equal(botReason(CHROME, 13335), null); // Cloudflare WARP / relays still count
	assert.equal(botReason(CHROME, undefined), null);
	assert.equal(botReason(CHROME.replace('Chrome/', 'HeadlessChrome/'), 3215), 'ua');
	assert.equal(botReason('Googlebot/2.1 (+http://www.google.com/bot.html)', 15169), 'ua');
	assert.equal(botReason('curl/8.5.0', 3215), 'ua');
	assert.equal(botReason(null, 3215), 'ua');
	assert.equal(botReason(CHROME, 16509), 'asn'); // AWS
});

/** Runs the Worker against fake bindings and returns what it wrote. */
async function run(request: Request) {
	const points: AnalyticsEngineDataPoint[] = [];
	const env = {
		ASSETS: { fetch: async () => html() },
		PAGEVIEWS: { writeDataPoint: (p: AnalyticsEngineDataPoint) => points.push(p) },
	};
	const response = await worker.fetch(request as never, env as never);
	return { response, points };
}

test('records a view with its event and bot fields', async () => {
	const { points } = await run(navigation({ 'user-agent': CHROME }));
	assert.deepEqual(points[0].blobs, ['/blog/linux_process/', 'direct', 'unknown', 'nahuelcanavy.com', 'view', '']);
});

test('records a read against the post path and always answers with the image', async () => {
	const read = await run(beaconFetch({ 'user-agent': CHROME }));
	assert.equal(read.response.headers.get('content-type'), 'image/gif');
	assert.equal(read.response.headers.get('cache-control'), 'private, max-age=86400');
	assert.deepEqual(read.points[0].blobs, ['/blog/linux_process/', 'n/a', 'unknown', 'nahuelcanavy.com', 'read', '']);

	const bare = await run(new Request(readUrl));
	assert.equal(bare.response.status, 200);
	assert.equal(bare.points.length, 0);
});

test('keeps bot traffic, labelled, so the filter can be checked', async () => {
	const { points } = await run(navigation({ 'user-agent': 'HeadlessChrome/141' }));
	assert.equal(points[0].blobs?.[5], 'ua');
});
