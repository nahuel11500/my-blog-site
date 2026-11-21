/**
 * Serves the static site and counts readers server-side, so readers download
 * nothing for it: no script, no cookie, no fingerprint, no consent banner.
 *
 * Two events, both written to the same Analytics Engine dataset:
 *   - view: a browser opened a page.
 *   - read: a browser scrolled near the end of a post. Each post ends with a
 *     lazy 1×1 image pointing at /read/<slug>/, which browsers only fetch when
 *     the reader gets close to it.
 *
 * Recorded: path, referrer host, country, serving host, event, bot reason.
 * Read to filter bots, then dropped: user-agent, network (ASN).
 * Never recorded: IP, visitor ID, user-agent, ASN, session, full referring URL.
 *
 * See the "Analytics" section of the README for the data model and why.
 */

interface Env {
	ASSETS: Fetcher;
	PAGEVIEWS: AnalyticsEngineDataset;
}

type Event = 'view' | 'read';
type BotReason = 'ua' | 'asn';

const MAX_INDEX_BYTES = 96; // Analytics Engine caps an index at 96 bytes.

/** /read/<post slug>/ — the target of the lazy image at the end of each post. */
const READ_ROUTE = /^\/read\/([a-z0-9_-]+)\/?$/;

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

function record(request: Request, env: Env, url: URL, event: Event, path: string): void {
	const page = truncateToBytes(path, MAX_INDEX_BYTES);
	const bot = botReason(request.headers.get('user-agent'), request.cf?.asn as number | undefined);

	env.PAGEVIEWS.writeDataPoint({
		// Preview versions and *.workers.dev share this dataset with production,
		// so the serving host is recorded to keep them apart at query time.
		blobs: [
			page,
			event === 'view' ? referrerHost(request, url.hostname) : 'n/a',
			String(request.cf?.country ?? 'unknown'),
			url.hostname,
			event,
			bot ?? '',
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
