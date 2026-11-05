// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// SITE_BASE serves the site from a sub-path, e.g. "/Nhan-Laptop.github.io" for a fork's
// project-pages preview. Unset (the default) for nhan-laptop.github.io itself.
const base = process.env.SITE_BASE || '/';

export default defineConfig({
  site: 'https://nhan-laptop.github.io',
  base,
  // "preserve" keeps the historical URLs: posts/ctf/writeup-x.html, categories/index.html, tags/index.html.
  build: { format: 'preserve', inlineStylesheets: 'auto' },
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
