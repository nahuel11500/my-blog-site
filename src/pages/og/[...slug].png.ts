import { readFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { SITE_DESCRIPTION, SITE_TITLE } from '../../consts';

// Text-only social cards, rendered at build time. Only crawlers ever fetch
// them, so they cost readers nothing.

const WIDTH = 1200;
const HEIGHT = 630;
const DOMAIN = 'nahuelcanavy.com';

// satori reads ttf/otf/woff, but not the woff2 that browsers get.
const [regular, bold] = await Promise.all([
	readFile('src/fonts/atkinson-regular.woff'),
	readFile('src/fonts/atkinson-bold.woff'),
]);

export async function getStaticPaths() {
	const posts = await getCollection('blog');

	return [
		{
			params: { slug: 'default' },
			props: { title: SITE_TITLE, description: SITE_DESCRIPTION },
		},
		...[
			['recouvrance', 'Recouvrance: the Kubernetes client that tells you what is wrong', 'Native, in Rust. It finds what is broken across your clusters and why, and lets AI agents help under rules you set.'],
			['recouvrance/agents', 'Let agents work on your clusters. Keep the rules.', 'Recouvrance serves MCP on localhost: allow, ask or deny, approvals, an audit log and a kill switch.'],
			['recouvrance/compare', 'Recouvrance compared', 'Feature by feature, with Aptakube, FreeLens and Headlamp.'],
			['recouvrance/download', 'Download Recouvrance', 'Linux (x86_64, arm64) and macOS (Intel, Apple silicon). Free and open source.'],
		].map(([slug, title, description]) => ({ params: { slug }, props: { title, description } })),
		...posts.map((post) => ({
			params: { slug: post.id },
			props: { title: post.data.title, description: post.data.description },
		})),
	];
}

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

const text = (content: string, style: Record<string, unknown>) => ({
	type: 'div',
	props: { style: { display: 'flex', ...style }, children: content },
});

const box = (style: Record<string, unknown>, children: unknown[] = []) => ({
	type: 'div',
	props: { style: { display: 'flex', ...style }, children },
});

// The blog's dark theme (src/styles/global.css).
const C = {
	bg: '#000000',
	title: '#ffffff',
	soft: '#a3a3a3',
	muted: '#737373',
};

export const GET: APIRoute<Props> = async ({ params, props }) => {
	const { title, description } = props;
	const slug = params.slug ?? 'default';
	const section = slug === 'default' ? null : slug.startsWith('recouvrance') ? 'Recouvrance' : 'Writing';

	const svg = await satori(
		box(
			{
				flexDirection: 'column',
				justifyContent: 'space-between',
				width: '100%',
				height: '100%',
				padding: '64px 72px',
				backgroundColor: C.bg,
				fontFamily: 'Atkinson',
			},
			[
				text(section ? `Nahuel Canavy · ${section}` : 'Nahuel Canavy', { fontSize: 28, color: C.muted }),
				box({ flexDirection: 'column' }, [
					text(title, {
						fontSize: 64,
						fontWeight: 700,
						color: C.title,
						lineHeight: 1.15,
						letterSpacing: '-0.02em',
						// A long title must not collide with the footer.
						maxHeight: 290,
						overflow: 'hidden',
					}),
					text(description, {
						marginTop: 24,
						fontSize: 29,
						color: C.soft,
						lineHeight: 1.4,
						maxHeight: 125,
						overflow: 'hidden',
					}),
				]),
				text(DOMAIN, { fontSize: 26, color: C.muted }),
			],
		),
		{
			width: WIDTH,
			height: HEIGHT,
			fonts: [
				{ name: 'Atkinson', data: regular, weight: 400, style: 'normal' },
				{ name: 'Atkinson', data: bold, weight: 700, style: 'normal' },
			],
		},
	);

	const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();

	return new Response(new Uint8Array(png), {
		headers: { 'Content-Type': 'image/png' },
	});
};
