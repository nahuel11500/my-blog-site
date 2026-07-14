/**
 * Serves the static site and counts page views server-side, so readers download
 * nothing for it: no script, no cookie, no fingerprint, no consent banner.
 *
 * Recorded: path, referrer host, country, serving host.
 * Never recorded: IP, visitor ID, user-agent, session, or a full referring URL.
 */

interface Env {
	ASSETS: Fetcher;
	PAGEVIEWS: AnalyticsEngineDataset;
}

const MAX_INDEX_BYTES = 96; // Analytics Engine caps an index at 96 bytes.

export default {
	async fetch(request, env): Promise<Response> {
		const response = await env.ASSETS.fetch(request);

		try {
			if (isPageView(request, response)) record(request, env);
		} catch {
			// Telemetry must never take the site down.
		}

		return response;
	},
} satisfies ExportedHandler<Env>;

/**
 * Heuristic, not a guarantee: real browsers navigating to a document send
 * `Sec-Fetch-Mode: navigate` + `Sec-Fetch-Dest: document`, while crawlers, curl
 * and scripted clients generally send neither. A bot score would be better, but
 * that needs a paid plan.
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

function record(request: Request, env: Env): void {
	const url = new URL(request.url);
	const path = truncateToBytes(url.pathname, MAX_INDEX_BYTES);

	env.PAGEVIEWS.writeDataPoint({
		// Preview versions and *.workers.dev share this dataset with production,
		// so the serving host is recorded to keep them apart at query time.
		blobs: [
			path,
			referrerHost(request, url.hostname),
			String(request.cf?.country ?? 'unknown'),
			url.hostname,
		],
		doubles: [1],
		indexes: [path],
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
