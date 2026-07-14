# Nahuel blog site

This is my blog site. Please feel free to contribute or correct me.

I've done this using [Astro](https://astro.build/), hosted on Cloudflare Workers.
It ships no JavaScript and no images, and page views are counted in the Worker
instead of your browser — so there is no script, no cookie and nothing to consent
to. See [/privacy](https://nahuelcanavy.com/privacy/) and `worker/index.ts`.

```sh
npm run dev      # dev server
npm run test     # telemetry gate tests
npm run preview  # serve the built site through the Worker
npm run deploy   # build + deploy
```

`scripts/stats.sh` reads the page-view stats back out of Analytics Engine.
