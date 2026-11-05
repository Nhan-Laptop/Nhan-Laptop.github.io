import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDescription, parseMarkdownMetadata, renderPost, stripMetadataLines } from './lib/markdown';
import { cleanTitle, inferCategory } from './lib/site';

/**
 * Loads every posts/<topic>/*.md except manifest.drafts and BLOG_SKIP_POSTS.
 * Entry ids are paths below posts/ without ".md", e.g. "ctf/writeup-n1ctf-2025".
 */
function postsLoader() {
  return {
    name: 'nhan-posts-loader',
    async load({ store, config, parseData, generateDigest, logger, watcher }: any) {
      const root = fileURLToPath(config.root);
      const postsDir = path.join(root, 'posts');
      const publicDir = fileURLToPath(config.publicDir).replace(/\/$/, '');

      const sync = async () => {
        const manifest = JSON.parse(readFileSync(path.join(postsDir, 'manifest.json'), 'utf8'));
        const excluded = new Set<string>([
          ...(manifest.drafts || []),
          ...(process.env.BLOG_SKIP_POSTS || '').split(',').map((s) => s.trim()).filter(Boolean),
        ]);
        const files = collect(postsDir, postsDir).filter((rel) => !excluded.has(rel) && !excluded.has(path.basename(rel)));
        const loose = files.filter((rel) => !rel.includes('/'));
        if (loose.length) throw new Error(`Move publishable Markdown into topic folders: ${loose.join(', ')}`);

        store.clear();
        for (const rel of files) {
          const category = inferCategory(rel);
          if (!category) {
            logger.warn(`Skipping ${rel}: basename needs a writeup-/learning-/project-/life-/daily- prefix`);
            continue;
          }
          const full = path.join(postsDir, rel);
          const raw = readFileSync(full, 'utf8');
          const id = rel.replace(/\.md$/, '');
          const topic = rel.split('/')[0];
          const meta = parseMarkdownMetadata(raw);
          const rendered = renderPost(raw, publicDir, path.dirname(rel));
          const date = meta.date || gitDate(root, full) || statSync(full).mtime.toISOString().slice(0, 10);
          const data = await parseData({
            id,
            data: {
              title: cleanTitle(rendered.title),
              rawTitle: rendered.title,
              date,
              dated: Boolean(meta.date),
              summary: meta.summary && meta.summary !== '.' ? meta.summary : extractDescription(stripMetadataLines(raw).replace(/^#\s+.*$/m, '')),
              tags: meta.tags,
              category,
              topic,
              file: rel,
              minutes: Math.max(1, Math.round(rendered.words / 220)),
              headings: rendered.headings,
            },
          });
          store.set({
            id,
            data,
            body: raw,
            filePath: path.relative(root, full),
            digest: generateDigest(raw),
            rendered: { html: rendered.html, metadata: { headings: [] } },
          });
        }
        logger.info(`Loaded ${store.keys().length} posts`);
      };

      await sync();
      watcher?.on('change', (file: string) => {
        if (file.startsWith(postsDir) && (file.endsWith('.md') || file.endsWith('manifest.json'))) sync();
      });
    },
  };
}

function collect(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full, base));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Date the file was first committed: a stable fallback for posts without a `date:`. */
function gitDate(root: string, file: string): string {
  try {
    const out = execFileSync('git', ['log', '--follow', '--diff-filter=A', '--format=%as', '--', file], { cwd: root, encoding: 'utf8' });
    return out.trim().split('\n').pop() || '';
  } catch {
    return '';
  }
}

const posts = defineCollection({
  loader: postsLoader() as any,
  schema: z.object({
    title: z.string(),
    rawTitle: z.string(),
    date: z.string(),
    dated: z.boolean(),
    summary: z.string(),
    tags: z.array(z.string()),
    category: z.enum(['writeup', 'learning', 'project', 'life']),
    topic: z.string(),
    file: z.string(),
    minutes: z.number(),
    headings: z.array(z.object({ depth: z.number(), id: z.string(), text: z.string() })),
  }),
});

export const collections = { posts };
