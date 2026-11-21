# Nahuel blog site

This is my blog site. Please feel free to contribute or correct me.

I've done this using [Astro](https://astro.build/), hosted on Cloudflare Workers.
It ships no JavaScript and no images (apart from a 1×1 read counter, see
below), and readers are counted in the Worker instead of your browser — so there
is no script, no cookie and nothing to consent to. See [/privacy](https://nahuelcanavy.com/privacy/) and `worker/index.ts`.

```sh
npm run dev      # dev server
npm run test     # telemetry tests
npm run preview  # serve the built site through the Worker
npm run deploy   # build + deploy
```

`scripts/stats.sh` reads the stats back out of Analytics Engine.

## Analytics

The goal is an honest answer to "how many people read this post?", without
tracking anyone. Readers download nothing for it; the Worker counts as it serves.

### What is counted

| Event  | Trigger | Means |
|--------|---------|-------|
| `view` | A browser navigates to a page (`Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document`, HTML, 200). | Someone opened the page. |
| `read` | A browser loads `/read/<slug>/`, the lazy 1×1 image at the end of each post, from that post. | Someone scrolled near the end. |

Why `read`: page views over-count. Over the 90 days before this was added,
about half the views came from crawlers that open every menu link within a
minute, and `/privacy/` got almost as many views as `/about/`. A lazy image is
only fetched when the reader scrolls close to it, and crawlers rarely scroll.

The image is `private, max-age=86400`, so the same browser reading the same post
twice in a day counts once. The server never sees anything that tells readers
apart; that memory stays in the browser cache.

Limits: browsers start fetching lazy images some distance before they are
visible (about 1,250 px in Chrome), so a read means "reached the last part of
the post", not "read every word". Readers with images disabled never count as a
read. Googlebot and other rendering crawlers do fetch lazy images, which is one
reason for the bot filter below.

### Bot filter

Headless browsers send the same `Sec-Fetch-*` headers as real ones, so every
event also gets a bot verdict, from two things the Worker receives anyway:

- **User-agent**: empty, or matching `bot`, `crawl`, `spider`, `HeadlessChrome`,
  `curl`, `python`, `playwright`… → `ua`.
- **Network (ASN)** of a cloud or hosting provider: AWS, Google Cloud, Azure,
  OVH, Hetzner… → `asn`. Commercial VPN and privacy-relay networks (Cloudflare
  WARP, iCloud Private Relay…) are not on the list, so readers who use them
  still count.

The user-agent and ASN are only used for the verdict and never stored. Bot
events are still recorded, labelled, so the filter can be checked: if it
catches real readers, it shows up in `stats.sh`.

### Data model

One Analytics Engine dataset, `blog_pageviews`, one data point per event:

| Field   | Content |
|---------|---------|
| `blob1` | Path. For a `read`, the post path (`/blog/<slug>/`). |
| `blob2` | Referrer host, `direct` or `internal`. `n/a` for a `read`. |
| `blob3` | Country code. |
| `blob4` | Serving host: previews and `*.workers.dev` write here too. |
| `blob5` | Event: `view` or `read`. Empty on rows written before Nov 2026. |
| `blob6` | Bot verdict: `''` (looks like a person), `ua` or `asn`. Empty on older rows, which are unfiltered. |
| `index1`| Path, for sampling. |

Never recorded: IP, user-agent, ASN, cookies, visitor or session IDs, full
referring URLs. Free plan: 100k data points a day, 3 months of retention.

### Reading the numbers

`./scripts/stats.sh [days]` shows, for people only: posts opened vs read to the
end, top pages, referrers, countries, hosts, and views and reads per day. It
also shows how much was filtered as bots, and why.
