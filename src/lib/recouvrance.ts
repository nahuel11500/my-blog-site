// Shared by the Recouvrance pages: links, the install command, and what GitHub says about
// the latest release, read once at build time (readers never contact GitHub).

export const REPO = 'nahuel11500/recouvrance';
export const GITHUB = `https://github.com/${REPO}`;
export const DOCS = `${GITHUB}/tree/main/docs`;
export const doc = (path: string) => `${GITHUB}/blob/main/docs/${path}`;
export const CHANGELOG = `${GITHUB}/blob/main/CHANGELOG.md`;
export const LATEST = `${GITHUB}/releases/latest`;
export const INSTALL = `curl --proto '=https' --tlsv1.2 -LsSf ${GITHUB}/releases/latest/download/recouvrance-installer.sh | sh`;
export const MEDIA = '/media/recouvrance';
export const BASE = '/recouvrance';

/** How many MCP tools the server has (`#[tool]` functions in src/mcp/server). */
export const TOOLS = 49;

export interface Asset {
	name: string;
	size: number;
	url: string;
}

export interface LatestRelease {
	tag: string;
	date: Date;
	url: string;
	assets: Asset[];
}

const headers = (): Record<string, string> => {
	const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
	if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
	return h;
};

/** The latest release and its files, or null when GitHub can't be reached: the build must not fail for it.
 *  Fetched once per build, however many pages ask. */
export function latestRelease(): Promise<LatestRelease | null> {
	return (latest ??= fetchLatestRelease());
}
let latest: Promise<LatestRelease | null> | undefined;

async function fetchLatestRelease(): Promise<LatestRelease | null> {
	try {
		const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: headers() });
		if (!response.ok) return null;
		const r = (await response.json()) as {
			tag_name: string;
			published_at: string;
			html_url: string;
			assets: { name: string; size: number; browser_download_url: string }[];
		};
		return {
			tag: r.tag_name,
			date: new Date(r.published_at),
			url: r.html_url,
			assets: r.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })),
		};
	} catch {
		return null;
	}
}

/** A table of docs/COMPARISON.md as rows of cells (the first row is the header), or null. */
export async function comparison(): Promise<string[][] | null> {
	try {
		const response = await fetch(`https://raw.githubusercontent.com/${REPO}/main/docs/COMPARISON.md`);
		if (!response.ok) return null;
		return comparisonRows(await response.text());
	} catch {
		return null;
	}
}

/** The first Markdown table of `markdown`, without its `|---|` line. */
export function comparisonRows(markdown: string): string[][] | null {
	const lines = markdown.split('\n');
	const start = lines.findIndex((l) => l.startsWith('| Area'));
	if (start < 0) return null;
	const rows: string[][] = [];
	for (const line of lines.slice(start)) {
		if (!line.startsWith('|')) break;
		if (/^\|[\s|:-]+\|$/.test(line)) continue;
		rows.push(
			line
				.slice(1, -1)
				.split('|')
				.map((c) => c.trim()),
		);
	}
	return rows.length > 1 ? rows : null;
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A Markdown cell as HTML: escaped, `code` kept. */
export const cell = (text: string) => escape(text).replace(/`([^`]+)`/g, '<code>$1</code>');

export const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(0)} MB`;
