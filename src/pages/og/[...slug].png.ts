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

export const GET: APIRoute<Props> = async ({ props }) => {
	const { title, description } = props;

	const svg = await satori(
		{
			type: 'div',
			props: {
				style: {
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					width: '100%',
					height: '100%',
					padding: '70px',
					backgroundColor: '#ffffff',
					borderLeft: '24px solid #2337ff',
					fontFamily: 'Atkinson',
				},
				children: [
					{
						type: 'div',
						props: {
							style: { display: 'flex', flexDirection: 'column' },
							children: [
								text(title, {
									fontSize: 64,
									fontWeight: 700,
									color: '#0f1219',
									lineHeight: 1.15,
									// A long title must not collide with the footer.
									maxHeight: 300,
									overflow: 'hidden',
								}),
								text(description, {
									marginTop: 28,
									fontSize: 30,
									color: '#6073a0',
									lineHeight: 1.4,
									maxHeight: 130,
									overflow: 'hidden',
								}),
							],
						},
					},
					text(DOMAIN, { fontSize: 26, fontWeight: 700, color: '#2337ff' }),
				],
			},
		},
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
