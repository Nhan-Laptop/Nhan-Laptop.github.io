# AGENTS.md

This repository is a static personal blog served at `https://nhan-laptop.github.io`.
It uses plain HTML/CSS/JS and a custom Node Markdown build, not a framework.

## Content layout

Published Markdown and its generated HTML live together under topic folders:

```text
posts/
  cryptography/       # Ciphers, lattices, NTT, HE, IBE/HIBE, PKEET, PRNG notes
  ctf/                # Competition writeups
  malware-binary/     # Windows memory, PE, loading, shellcode; four separate parts
  security-protocols/ # mTLS and onion routing
  tools/              # Z3 and other analysis tooling notes
  projects/           # Research prototypes and pi-ctf-solver
  life/               # Travel, personal logs, and the HTML-only semester log
  manifest.json       # Protected draft exclusions
```

- `build.js` recursively discovers `posts/**/*.md` and writes `.html` beside each source.
- Keep supporting source files, such as `learning-PKEET.tex`, with the corresponding post.
- Keep media in `assets/`, not beside Markdown. A post one folder below `posts/` references it as `../../assets/...`.
- Keep `posts/` free of root-level HTML. All published articles belong inside topic folders; legacy URL redirect stubs were intentionally removed at the user's request.
- The removed merged malware article is not a source anymore. The current malware series has four separate articles.
- `posts/life-the-first-viasm-with-crypto.md` is an unfinished, untracked draft. Do not alter, move, or publish it without explicit approval.

## Build and templates

The normal build is:

```bash
npm run build:n1ctf
```

This builds the universe background bundle, then `build.js`:

1. Loads `posts/manifest.json` and recursively discovers Markdown.
2. Excludes `manifest.drafts` and any additional `BLOG_SKIP_POSTS` entries.
3. Parses metadata, strips it from the article, and preprocesses HackMD syntax.
4. Renders with `marked`, `highlight.js`, and KaTeX.
5. Injects content into `templates/writeup-template.html`, with navigation, asset paths and canonical URLs calculated for the post's nesting depth.
6. Adds local image dimensions and lazy-loading attributes.
7. Writes HTML beside Markdown.
8. Regenerates all four category listings and the tags index.
9. Copies vendor styles and fonts into `assets/vendor/`.

Relevant files:

- `build.js`: rendering, article metadata, category and tag generation.
- `scripts/post-paths.js`: recursive discovery, URL encoding, and nesting depth.
- `scripts/image-dimensions.js`: local PNG/WebP dimensions, resolved from each article's directory.
- `templates/writeup-template.html`: article shell. `{{ROOT_PREFIX}}` is replaced with `../`, `../../`, etc.
- `templates/category-template.html` and `templates/tags-template.html`: generated archive layouts.
- `posts/manifest.json`: `drafts` exclusions, matched by basename or path relative to `posts/`.

Exclusions match either a Markdown basename or a complete relative path. Manifest exclusions apply even without an environment variable; `BLOG_SKIP_POSTS` is additive:

```bash
BLOG_SKIP_POSTS=learning-unfinished.md,tools/learning-experiment.md npm run build:n1ctf
```

Publishable Markdown must be placed in a topic folder. Old flat article URLs are no longer supported; do not reintroduce root-level redirect stubs.

## Automatic vs manual

Generated:

- `posts/**/*.html` backed by Markdown
- `categories/writeup.html`, `categories/learning.html`, `categories/project.html`, `categories/life.html`
- `tags/index.html`
- Vendor assets and `assets/js/universe-background.bundle.js`

Manual:

- `index.html`, including **Fresh from the notebook** / Latest Posts
- `categories/index.html`
- `posts/life/daily-semester-log.html` (no Markdown source)
- Shared templates, styling, and client-side behavior

Adding a Markdown source updates archives, but not the homepage. Add or update its homepage card manually if appropriate, using the grouped public URL.

## Authoring

Keep the category prefix on the **basename**, regardless of its topic folder:

- `writeup-*.md` → Writeup
- `learning-*.md` → Learning
- `project-*.md` → Project
- `life-*.md` or `daily-*.md` → Life

Frontmatter supports `date`, `summary`, and `tags`; it takes priority over legacy inline `Date:`, `Summary:`, and `Tags:` metadata.

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

- Prefer `$$ ... $$` for display math and explicit code-fence languages.
- Do not assume prose math with `\\(...\\)` is as reliable as block math.
- Source-relative links between posts in the same topic folder can use the filename alone.
- Preserve author wording and code when a request is organizational/formatting-only. Do not restore passages the user deleted.

## Frontend and media

- Load `assets/css/redesign.css` after `common.css`; it contains the responsive layouts and reading styles.
- `assets/js/common.js` progressively adds mobile navigation, article TOC/code-copy controls, and tag filtering.
- `npm run optimize:images` uses ImageMagick (`magick`) to create WebP copies while retaining PNG originals. Register new media folders in `scripts/optimize-images.js`.
- Use `controls playsinline preload="metadata"` for self-hosted video. Metadata preload can download some data before playback.

## Safety and verification

The worktree may be dirty. Never revert unrelated edits, alter the protected life draft, or undo user deletions to make a build pass.

After content or build changes:

1. `node --check build.js`
2. `npm run build:n1ctf`
3. `npm test` (nested paths, clean posts root, draft exclusion, companion HTML, local links and malware-series checks)
4. Inspect generated diffs for accidental content changes.
5. Verify new posts appear in their category and tags listings.
6. Update the manual homepage when appropriate.
7. Check desktop/mobile layout, media loading, and that rebuilding leaves no root-level article HTML.

Local changes are not live until committed, pushed to `origin/main`, and published by GitHub Pages. Do not claim deployment from a local build alone.
