# AGENTS.md

Personal site of Nguyen Trong Nhan, served at `https://nhan-laptop.github.io`.
Built with **Astro 7**, **Tailwind CSS 4** and a custom **Three.js** galaxy. Deployed by GitHub Actions.

## Content layout

Markdown sources live in topic folders under `posts/` (sources only, no generated HTML):

```text
posts/
  cryptography/       # Ciphers, lattices, NTT, HE, IBE/HIBE, PKEET, PRNG notes
  ctf/                # Competition writeups
  malware-binary/     # Five-part Malware for Beginners series
  security-protocols/ # mTLS and onion routing
  tools/              # Z3 and other analysis tooling notes
  projects/           # Research prototypes and pi-ctf-solver
  life/               # Travel and personal logs
  manifest.json       # Protected draft exclusions
```

- Keep supporting files (e.g. `learning-PKEET.tex`) beside the post.
- Media lives in `public/assets/`. A post one folder below `posts/` references it as `../../assets/...` (that resolves to `/assets/...` at the post's URL).
- `posts/life-the-first-viasm-with-crypto.md` is an unfinished draft excluded via `manifest.json`. Do not alter, move, or publish it without explicit approval.
- Publishable Markdown must be inside a topic folder; the build fails on loose files in `posts/`.

## URLs (must stay stable)

`build.format: 'preserve'` keeps the historical URLs:

- `posts/<topic>/<basename>.html` for every Markdown post
- `posts/life/daily-semester-log.html` (hand-written page, `src/pages/posts/life/daily-semester-log.astro`)
- `categories/{index,writeup,learning,project,life}.html`, `tags/index.html`, `universe.html`, `rss.xml`

## Build

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # -> dist/
npm test           # checks dist/ (run build first)
npm run check      # build + test
```

Pipeline:

1. `src/content.config.ts` — a custom content loader reads `posts/**/*.md`, skips `manifest.drafts` and `BLOG_SKIP_POSTS` (comma-separated basenames or paths relative to `posts/`), and infers the category from the basename prefix.
2. `src/lib/markdown.ts` — metadata (frontmatter first, legacy inline `Date:`/`Tags:`/`Summary:` second), HackMD preprocessing (`:::spoiler`, `:::info|success|warning|danger`, LaTeX normalisation), `marked` + highlight.js + KaTeX (`nonStandard` math), heading ids/TOC, table wrappers, local image `width`/`height` + lazy loading.
3. Undated posts fall back to their first git commit date (CI checks out full history for this).
4. Pages in `src/pages/` render articles, archives, tags, the universe map, RSS and the sitemap.

## Categories

Keep the prefix on the **basename**, regardless of topic folder:

- `writeup-*.md` → Writeup · `learning-*.md` → Learning · `project-*.md` → Project · `life-*.md` / `daily-*.md` → Life

Frontmatter supports `date`, `summary`, `tags`:

```md
---
date: 2026-10-02
summary: One-line description.
tags:
  - windows
  - pe-format
---

# Article title
```

A leading `[Label] ` in the H1 (e.g. `[Project]`) is hidden in the displayed title; the category is shown separately.
Multi-part posts named `*-part-N.md` in the same folder get a series navigator automatically.

## Generated vs manual

Everything is generated from Markdown at build time: articles, category pages, tags, RSS, sitemap, the homepage lists, the ⌘K search index and the universe map. Nothing generated is committed.

Manual:

- Homepage copy and chapter layout: `src/pages/index.astro` (the `/now` list is hand-written).
- `src/pages/posts/life/daily-semester-log.astro` and its entry in `src/lib/posts.ts` (`SEMESTER_LOG`).
- Category labels/colours/blurbs: `src/lib/site.ts`.

## Frontend

- `src/styles/global.css` — Tailwind theme tokens (`--color-*`, fonts), components (`.btn`, `.chip`, `.glass`, reveals), universe markers. `prose.css` (article typography), `code.css` (highlight.js theme).
- `src/layouts/Base.astro` (shell, SEO, header/footer, ⌘K palette), `Article.astro` (reading layout, TOC, series, prev/next).
- `src/scripts/ui.ts` (header, mobile menu, ⌘K, reveal-on-scroll), `article.ts` (progress, TOC spy, code copy, lightbox), `home.ts` (scroll-driven camera, Lenis, HUD), `universe.ts` (post markers on the arms).
- `src/scripts/galaxy/` — the WebGL galaxy:
  - `model.ts`: procedural barred spiral (bulge, bar, 2 major + 2 minor log-spiral arms, flared disk, halo/globulars), black-body star colours, HII regions, dust filaments.
  - `shaders.ts`: point sprites (energy-conserving sub-pixel stars), diffuse disk light + dust lanes, core glow.
  - `engine.ts`: renderer, bloom (UnrealBloom + ACES), quality tiers (`high`/`medium`/`low` by device), adaptive DPR, camera poses + drag/zoom/focus, pause when hidden, reduced-motion single frames.
- Fonts are self-hosted via Fontsource (Inter Tight, JetBrains Mono, Newsreader italic — all with Vietnamese subsets).
- Respect `prefers-reduced-motion`; everything must work without JavaScript (the poster image and plain lists stand in).
- Self-hosted video: `controls playsinline preload="metadata"`.

### Poster and social image

`public/galaxy-poster.webp` (first paint / no-WebGL fallback) and `public/og.jpg` are rendered from the real engine. After changing the galaxy's look, regenerate them:

```bash
npm run dev &
node scripts/render-poster.cjs http://localhost:4321   # needs Playwright + ImageMagick
```

`npm run optimize:images` creates WebP copies of PNGs (ImageMagick); register new media folders in `scripts/optimize-images.cjs`.

## Safety and verification

The worktree may be dirty. Never revert unrelated edits, alter the protected draft, or change author wording/maths to make a build pass (known source-level LaTeX errors are allow-listed in `tests/site.test.mjs`).

After content or build changes:

1. `npm run build` and `npm test`.
2. Inspect the rendered pages for accidental content changes.
3. Check desktop and mobile layout, and the homepage galaxy.

Deployment: `.github/workflows/deploy.yml` builds, tests and publishes `dist/` on every push to `main`. The repository's Pages source must be set to **GitHub Actions**. Do not claim deployment from a local build alone.
