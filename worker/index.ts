/**
 * Serves the static site and counts readers server-side, so readers download
 * nothing for it: no script, no cookie, no fingerprint, no consent banner.
 *
 * Three events, all written to the same Analytics Engine dataset:
 *   - view: a browser opened a page.
 *   - read: a browser scrolled near the end of a post. Each post ends with a
 *     lazy 1×1 image pointing at /read/<slug>/, which browsers only fetch when
 *     the reader gets close to it.
 *   - download: someone downloaded /cv.pdf. Each copy is stamped with the date,
 *     and with a random reference in its metadata (worker/cv-stamp.ts), the
 *     same one recorded with the event.
 *
 * Recorded: path, referrer host, country, serving host, event, bot reason,
 * and for a download the reference stamped in that copy's metadata.
 * Read to filter bots, then dropped: user-agent, network (ASN).
 * Never recorded: IP, visitor ID, user-agent, ASN, session, full referring URL.
 *
 * See the "Analytics" section of the README for the data model and why.
 */

import { newRef, stamp, stampPdf } from './cv-stamp.ts';

interface Env {
	ASSETS: Fetcher;
	PAGEVIEWS: AnalyticsEngineDataset;
}

type Event = 'view' | 'read' | 'download';
type BotReason = 'ua' | 'asn';

const MAX_INDEX_BYTES = 96; // Analytics Engine caps an index at 96 bytes.

/** /read/<post slug>/ — the target of the lazy image at the end of each post. */
const READ_ROUTE = /^\/read\/([a-z0-9_-]+)\/?$/;

const CV_PATH = '/cv.pdf';

/** A 1×1 transparent GIF (42 bytes). */
const PIXEL = Uint8Array.from(
	atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
	(c) => c.charCodeAt(0),
);

/**
 * Clients that announce themselves as automated. Real browsers never match.
 * An empty user-agent is treated as a bot too.
 */
const BOT_UA =
	/bot|crawl|spider|slurp|headless|lighthouse|python|curl|wget|go-http|node-fetch|axios|java\/|puppeteer|playwright|selenium|phantomjs/i;

/**
 * Cloud and hosting networks: people rarely browse from them, crawlers and
 * headless browsers mostly do. Commercial VPN and privacy-relay networks are
 * deliberately left out, so readers who use them still count.
 */
const DATACENTER_ASNS = new Set([
	16509, 14618, // Amazon AWS
	15169, 396982, // Google, Google Cloud
	8075, // Microsoft Azure
	31898, // Oracle Cloud
	14061, // DigitalOcean
	16276, // OVH
	24940, // Hetzner
	63949, // Akamai Linode
	20473, // Vultr
	12876, // Scaleway
	51167, // Contabo
	45102, // Alibaba Cloud
	132203, // Tencent Cloud
]);

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const read = url.pathname.match(READ_ROUTE);

		if (url.pathname === CV_PATH) return cv(request, env, url);

		if (read) {
			try {
				if (isRead(request, url, read[1])) record(request, env, url, 'read', `/blog/${read[1]}/`);
			} catch {
				// Telemetry must never take the site down.
			}
			return pixel();
		}

		const response = await env.ASSETS.fetch(request);

		try {
			if (isPageView(request, response)) record(request, env, url, 'view', url.pathname);
		} catch {
			// Telemetry must never take the site down.
		}

		return response;
	},
} satisfies ExportedHandler<Env>;

/**
 * Heuristic, not a guarantee: real browsers navigating to a document send
 * `Sec-Fetch-Mode: navigate` + `Sec-Fetch-Dest: document`, while crawlers, curl
 * and scripted clients generally send neither. Headless browsers do send them,
 * which is what botReason() is for.
 */
export function isPageView(request: Request, response: Response): boolean {
	if (request.method !== 'GET') return false;
	if (response.status !== 200) return false;
	if (!(response.headers.get('content-type') ?? '').startsWith('text/html')) return false;
	if (request.headers.get('sec-fetch-mode') !== 'navigate') return false;
	if (request.headers.get('sec-fetch-dest') !== 'document') return false;
	if ((request.headers.get('sec-purpose') ?? '').includes('prefetch')) return false;

	return true;
}

/**
 * A read counts only when a browser loads the end-of-post image from the post
 * itself: an image fetch whose referrer is that same post on this host. A bare
 * request to /read/... (curl, a crawler following links) does not count.
 */
export function isRead(request: Request, url: URL, slug: string): boolean {
	if (request.method !== 'GET') return false;
	if (request.headers.get('sec-fetch-dest') !== 'image') return false;

	const referer = request.headers.get('referer');
	if (!referer) return false;

	try {
		const from = new URL(referer);
		return from.host === url.host && from.pathname === `/blog/${slug}/`;
	} catch {
		return false;
	}
}

/** Why a request looks automated, or null if it looks like a person. */
export function botReason(userAgent: string | null, asn: number | undefined): BotReason | null {
	if (!userAgent || BOT_UA.test(userAgent)) return 'ua';
	if (asn !== undefined && DATACENTER_ASNS.has(asn)) return 'asn';
	return null;
}

/**
 * Serves the CV stamped with the download time and a fresh reference. Never
 * cached, so no two downloads share a stamp.
 */
async function cv(request: Request, env: Env, url: URL): Promise<Response> {
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
	}

	// A plain request: the client's conditional headers must not turn this into a 304.
	// HEAD only asks whether the CV is there, so the PDF itself is not fetched.
	const asset = await env.ASSETS.fetch(new Request(url.toString(), { method: request.method }));
	if (!asset.ok) return asset;

	const now = new Date();
	const headers = {
		'content-type': 'application/pdf',
		'content-disposition': `attachment; filename="nahuel_canavy_cv_${now.toISOString().slice(0, 10)}.pdf"`,
		'cache-control': 'private, no-store',
		'x-robots-tag': 'noindex, nofollow',
		// Every response is a whole, freshly stamped copy, and the one recorded: no
		// ranges, so a download manager can't split one download into several
		// requests, each with its own reference. A Range header is ignored (a 200
		// with the full body is a valid answer to it).
		'accept-ranges': 'none',
	};
	if (request.method === 'HEAD') return new Response(null, { headers });

	const ref = newRef();
	let pdf: Uint8Array;
	try {
		pdf = stampPdf(new Uint8Array(await asset.arrayBuffer()), stamp(now, ref));
	} catch {
		// Better no CV than one without its stamp.
		return new Response('The CV is unavailable right now.', { status: 503 });
	}

	try {
		record(request, env, url, 'download', CV_PATH, ref);
	} catch {
		// Telemetry must never take the site down.
	}

	return new Response(pdf, { headers });
}

function record(request: Request, env: Env, url: URL, event: Event, path: string, ref = ''): void {
	const page = truncateToBytes(path, MAX_INDEX_BYTES);
	const bot = botReason(request.headers.get('user-agent'), request.cf?.asn as number | undefined);

	env.PAGEVIEWS.writeDataPoint({
		// Preview versions and *.workers.dev share this dataset with production,
		// so the serving host is recorded to keep them apart at query time.
		blobs: [
			page,
			event === 'read' ? 'n/a' : referrerHost(request, url.hostname),
			String(request.cf?.country ?? 'unknown'),
			url.hostname,
			event,
			bot ?? '',
			ref,
		],
		doubles: [1],
		indexes: [page],
	});
}

/**
 * Cached by the browser for a day, so re-reading the same post the same day
 * is not counted twice, without the server ever telling readers apart.
 */
function pixel(): Response {
	return new Response(PIXEL, {
		headers: {
			'content-type': 'image/gif',
			'cache-control': 'private, max-age=86400',
			'x-robots-tag': 'noindex',
		},
	});
}

/** The referring host only — a full referrer can carry search terms. */
export function referrerHost(request: Request, selfHost: string): string {
	const referer = request.headers.get('referer');
	if (!referer) return 'direct';

	try {
		const host = new URL(referer).hostname;
		return host === selfHost ? 'internal' : host;
	} catch {
		return 'unknown';
	}
}

function truncateToBytes(value: string, maxBytes: number): string {
	const encoder = new TextEncoder();
	let out = value;

	while (encoder.encode(out).length > maxBytes) {
		out = out.slice(0, -1);
	}

	return out;
}
