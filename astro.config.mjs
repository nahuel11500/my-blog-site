// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
    site: 'https://nahuel11500.github.io',
    base: '/my-blog-site',
    integrations: [mdx(), sitemap(), svelte()],
});