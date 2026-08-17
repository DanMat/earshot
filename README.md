# earshot

My audiobook year — pulled **automatically** from Audible and turned into a public,
copyright-safe retrospective built around the **narrators**, not just the books.

**Live:** https://earshot.danmat.workers.dev

Metadata and my own listening stats only — titles, authors, narrators, runtimes,
series, finished/progress. Never book text, audio, or transcripts.

## How it works

```
┌─ GitHub Actions (cron) ────────────────────────────────┐
│  pull.mjs      → audible-cli, token from AUDIBLE_CONFIG │
│  process.mjs   → curated, copyright-safe public/data/   │
│  enrich.mjs    → Wikipedia bios (cached)                │
│         └─ commit public/data/ when it changed          │
└──────────────────────────┬─────────────────────────────┘
                           push
                            ▼
┌─ GitHub Actions (deploy.yml) ──────────────────────────┐
│  vite build → wrangler deploy → Cloudflare (assets)    │
└────────────────────────────────────────────────────────┘
```

Audible has no public API, and scripted Amazon logins are a CAPTCHA/2FA trap — so we
authenticate **once** locally and reuse a long-lived device token in CI (no browser, no
re-login). Under the hood: [`audible-cli`](https://github.com/mkb79/audible-cli) (Python;
the only non-JS dependency). The site is React + Vite, deployed as static assets on
Cloudflare Workers. Aggregation happens at build time in the Action — the data is public
and tiny, so there's no R2 or server involved.

## How often each part updates

| Component | Cadence | Notes |
|---|---|---|
| **Audible library pull** (`pull.yml`) | **Daily, 08:00 UTC** (+ manual dispatch) | Commits `public/data/` **only when something changed** — a book finished, progress moved, or a new purchase. |
| **Wikipedia bios** (`enrich.mjs`) | Runs daily *within* the pull, but **only fetches new names** | A new narrator/author is fetched when they enter the top 12. **Found bios are cached indefinitely**; **misses are re-checked every 30 days**. Most days = zero Wikipedia calls. |
| **Live site deploy** (`deploy.yml`) | **On every push to `main`** | Includes the daily data commits, so the site reflects new listening within minutes of a change. Also redeploys on any code change. |
| **CI checks** (`ci.yml`) | On every push / PR | Typecheck, lint, test, build — validation, not data. |
| **Auth token** (`AUDIBLE_CONFIG`) | **Rarely** — months, often indefinite | Only breaks on an Amazon password change, device deregister, or security event. When it does, the pull opens a self-closing GitHub issue (which emails me) with the 2-minute fix. |

Net: it refreshes itself daily, redeploys itself, and only needs me the rare time the
Audible token dies.

## Setup (one time)

```bash
pipx install audible-cli   # the Audible client (Python)
gh auth login              # if you haven't already
pnpm install
pnpm setup:auth            # log in to Audible, export, store the token as a GH secret
```

For fully hands-off auto-deploy, add a **`CLOUDFLARE_API_TOKEN`** repo secret — an
["Edit Cloudflare Workers"](https://dash.cloudflare.com/profile/api-tokens) token
(needs *Account › Workers Scripts › Edit*). Without it, `deploy.yml` skips cleanly.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the site locally (Vite) |
| `pnpm setup:auth` | One-time: Audible login → export → store token secret |
| `pnpm pull` | Pull the raw library → `data/library.json` (gitignored) |
| `pnpm process` | Curate raw → `public/data/{library,stats}.json` |
| `pnpm enrich` | Fetch/cache Wikipedia bios → `public/data/people.json` |
| `pnpm refresh` | `pull` + `process` + `enrich` in sequence |
| `pnpm run deploy` | `build` + `wrangler deploy` (note: `pnpm run`, not `pnpm deploy`) |

## Copyright

Everything published is factual metadata about **my own** listening, plus short
Wikipedia bio extracts (CC BY-SA, attributed and linked). We never reproduce Audible's
publisher summaries/reviews, and never any book text or audio. Cover thumbnails link to
each book's Audible page.
