// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://nhan-laptop.github.io',
  // "preserve" keeps the historical URLs: posts/ctf/writeup-x.html, categories/index.html, tags/index.html.
  build: { format: 'preserve', inlineStylesheets: 'auto' },
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
