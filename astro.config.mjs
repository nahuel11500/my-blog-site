// @ts-check

import mdx from '@astrojs/mdx';
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

/**
 * Makes each section heading of a post a link to itself, so a section can be shared. Plain
 * HTML, no script. Runs after rehypeHeadingIds, which gives the headings their ids.
 * @returns {(tree: any) => void}
 */
function headingLinks() {
	/** @param {any} node */
	const walk = (node) => {
		for (const child of node.children ?? []) {
			if (child.type === 'element' && /^h[2-4]$/.test(child.tagName) && child.properties?.id) {
				child.children = [
					{
						type: 'element',
						tagName: 'a',
						properties: { href: `#${child.properties.id}`, className: ['heading-link'] },
						children: child.children,
					},
				];
			} else {
				walk(child);
			}
		}
	};
	return walk;
}

// https://astro.build/config
export default defineConfig({
	site: 'https://nahuelcanavy.com',
	integrations: [mdx(), sitemap()],
	markdown: {
		rehypePlugins: [rehypeHeadingIds, headingLinks],
	},
	// The Recouvrance page moved to its own section.
	redirects: {
		'/projects/recouvrance': '/recouvrance/',
	},
});
