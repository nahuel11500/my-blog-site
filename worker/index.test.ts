import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FOOTER_DEFAULT, META_DEFAULT, pad, STAMP_LENGTH, stamp, stampPdf } from './cv-stamp.ts';
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
async function run(request: Request, asset: () => Response = html) {
	const points: AnalyticsEngineDataPoint[] = [];
	const env = {
		ASSETS: { fetch: async () => asset() },
		PAGEVIEWS: { writeDataPoint: (p: AnalyticsEngineDataPoint) => points.push(p) },
	};
	const response = await worker.fetch(request as never, env as never);
	return { response, points };
}

test('records a view with its event and bot fields', async () => {
	const { points } = await run(navigation({ 'user-agent': CHROME }));
	assert.deepEqual(points[0].blobs, ['/blog/linux_process/', 'direct', 'unknown', 'nahuelcanavy.com', 'view', '', '']);
});

test('records a read against the post path and always answers with the image', async () => {
	const read = await run(beaconFetch({ 'user-agent': CHROME }));
	assert.equal(read.response.headers.get('content-type'), 'image/gif');
	assert.equal(read.response.headers.get('cache-control'), 'private, max-age=86400');
	assert.deepEqual(read.points[0].blobs, ['/blog/linux_process/', 'n/a', 'unknown', 'nahuelcanavy.com', 'read', '', '']);

	const bare = await run(new Request(readUrl));
	assert.equal(bare.response.status, 200);
	assert.equal(bare.points.length, 0);
});

test('keeps bot traffic, labelled, so the filter can be checked', async () => {
	const { points } = await run(navigation({ 'user-agent': 'HeadlessChrome/141' }));
	assert.equal(points[0].blobs?.[5], 'ua');
});

const bytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
const text = (b: Uint8Array) => String.fromCharCode(...b);

/** A stand-in for the built PDF: two pages' footers and the metadata. */
const fakePdf = () =>
	bytes(`%PDF-1.7 ... (${FOOTER_DEFAULT}) Tj ... (${FOOTER_DEFAULT}) Tj ... /Subject (${META_DEFAULT}) ... %%EOF`);

test('stamps the footer with the date and the metadata with the ref, without moving a byte', () => {
	const pdf = fakePdf();
	const s = stamp(new Date('2026-11-24T14:03:59Z'), '7F3A-9C1E');
	const out = text(stampPdf(pdf, s));

	assert.equal(s.footer, 'Downloaded on 24 November 2026, latest at nahuelcanavy.com/cv');
	assert.equal(s.meta, 'Downloaded from nahuelcanavy.com/cv on 2026-11-24 14:03 UTC - ref 7F3A-9C1E');
	assert.equal(out.length, pdf.length);
	assert.equal(out.split(`(${pad(s.footer)}) Tj`).length - 1, 2);
	assert.ok(out.includes(`/Subject (${pad(s.meta)})`));
	assert.equal(out.includes(FOOTER_DEFAULT) || out.includes(META_DEFAULT), false);
	assert.equal(text(pdf).includes(FOOTER_DEFAULT), true, 'the input is left alone');
});

test('refuses stamps that would break the PDF string or its length', () => {
	assert.throws(() => pad('x'.repeat(STAMP_LENGTH + 1)));
	assert.throws(() => pad('a (parenthesis) closes the string'));
	const s = stamp(new Date(), '7F3A-9C1E');
	assert.throws(() => stampPdf(bytes('%PDF no placeholder'), s));
	assert.throws(() => stampPdf(bytes(`%PDF (${FOOTER_DEFAULT}) only the footer`), s));
});

const pdfAsset = () => new Response(fakePdf(), { headers: { 'content-type': 'application/pdf' } });
const cvDownload = (headers: Record<string, string> = {}) =>
	new Request('https://nahuelcanavy.com/cv.pdf', {
		headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', 'user-agent': CHROME, ...headers },
	});

test('serves the CV stamped, uncached, and records the reference stamped in it', async () => {
	const { response, points } = await run(cvDownload({ referer: 'https://nahuelcanavy.com/cv/' }), pdfAsset);
	const body = text(new Uint8Array(await response.arrayBuffer()));
	const ref = points[0].blobs?.[6] as string;

	assert.equal(response.headers.get('cache-control'), 'private, no-store');
	assert.match(response.headers.get('content-disposition') ?? '', /^attachment; filename="nahuel_canavy_cv_\d{4}-\d{2}-\d{2}\.pdf"$/);
	assert.match(ref, /^[0-9A-F]{4}-[0-9A-F]{4}$/);
	assert.ok(body.includes(`ref ${ref}`));
	assert.equal(body.includes(FOOTER_DEFAULT) || body.includes(META_DEFAULT), false);
	assert.deepEqual(points[0].blobs, ['/cv.pdf', 'internal', 'unknown', 'nahuelcanavy.com', 'download', '', ref]);
});

test('gives each download its own reference', async () => {
	const a = await run(cvDownload(), pdfAsset);
	const b = await run(cvDownload(), pdfAsset);
	assert.notEqual(a.points[0].blobs?.[6], b.points[0].blobs?.[6]);
});

test('never serves the CV without its stamp', async () => {
	const unstamped = () => new Response(bytes('%PDF no placeholder'), { headers: { 'content-type': 'application/pdf' } });
	const { response, points } = await run(cvDownload(), unstamped);
	assert.equal(response.status, 503);
	assert.equal(points.length, 0);
});

test('answers HEAD without a body or a download event', async () => {
	const { response, points } = await run(new Request('https://nahuelcanavy.com/cv.pdf', { method: 'HEAD' }), pdfAsset);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('content-type'), 'application/pdf');
	assert.equal(points.length, 0);
});
