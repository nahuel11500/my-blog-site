// Release notes from GitHub, read once at build time. The page ships them as
// plain HTML, so readers never contact GitHub.

export interface Release {
	tag: string;
	date: Date;
	url: string;
	highlights: string[]; // HTML: escaped text, `code` turned into <code>
}

const escape = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// "- *(sidebar)* Start wider, keep the dragged width (#825)" -> "Start wider, keep the dragged width"
function clean(line: string): string {
	const text = line
		.replace(/^-\s+/, '')
		.replace(/^\*\([^)]*\)\*\s*/, '')
		.replace(/\s*\(#\d+\)\s*$/, '');
	return escape(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

// The first bullets of the first section that has any, "Added" before "Fixed".
function highlights(body: string, count: number): string[] {
	for (const section of ['Added', 'Fixed', 'Performance']) {
		const match = body.match(new RegExp(`### ${section}\\s*\\n([\\s\\S]*?)(?=\\n#{2,3} |$)`));
		const bullets = match?.[1].split('\n').filter((l) => l.startsWith('- ')) ?? [];
		if (bullets.length) return bullets.slice(0, count).map(clean);
	}
	return [];
}

/** The latest releases, or none when GitHub can't be reached: the build must not fail for it. */
export async function latestReleases(repo: string, count = 4): Promise<Release[]> {
	const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
	if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

	try {
		const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=${count}`, { headers });
		if (!response.ok) return [];
		const releases = (await response.json()) as {
			tag_name: string;
			published_at: string;
			html_url: string;
			body: string | null;
			draft: boolean;
		}[];
		return releases
			.filter((r) => !r.draft)
			.map((r) => ({
				tag: r.tag_name,
				date: new Date(r.published_at),
				url: r.html_url,
				highlights: highlights(r.body ?? '', 2),
			}));
	} catch {
		return [];
	}
}
