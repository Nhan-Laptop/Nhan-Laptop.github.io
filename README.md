# Nhan's Security Log

Personal site of Nguyen Trong Nhan — cryptography notes, CTF writeups, malware internals and small tools.
Live at **https://nhan-laptop.github.io**.

- **Astro 7** static site, **Tailwind CSS 4**
- A procedurally generated, physically-inspired **Milky Way in Three.js**: the homepage camera flies through it as you scroll, and `/universe.html` maps every post onto its spiral arms
- Markdown posts with KaTeX, highlight.js and HackMD syntax

```bash
npm install
npm run dev     # http://localhost:4321
npm run check   # build + tests
```

Write a post: add `posts/<topic>/<prefix>-<name>.md` (`writeup-`, `learning-`, `project-`, `life-`) with `date`, `summary` and `tags` frontmatter. Push to `main` and GitHub Actions deploys it.

See [AGENTS.md](AGENTS.md) for the full architecture.
