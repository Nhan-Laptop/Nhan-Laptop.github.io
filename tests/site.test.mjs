// Checks the built site in dist/. Run `npm run build` first (or `npm run check`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const postsDir = path.join(root, 'posts');
const origin = 'https://nhan-laptop.github.io';

async function walk(dir, ext) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(f, ext)));
    else if (e.name.endsWith(ext)) out.push(f);
  }
  return out;
}
const rel = (f, base) => path.relative(base, f).split(path.sep).join('/');
const encode = (p) => p.split('/').map(encodeURIComponent).join('/');
const read = (f) => fs.readFile(path.join(dist, f), 'utf8');
const manifest = async () => JSON.parse(await fs.readFile(path.join(postsDir, 'manifest.json'), 'utf8'));

// Source-level LaTeX mistakes left as the author wrote them (fixing them is a content edit).
// learning-MP-LWE.md: `\begin{array}` without a column spec, around line 195.
// writeup-grey-the-cat-ctf-final-2026.md: a bare `&` inside \text{…} within an aligned block.
const KNOWN_KATEX_ERRORS = { 'cryptography/learning-MP-LWE.md': 1, 'ctf/writeup-grey-the-cat-ctf-final-2026.md': 1 };

async function publishable() {
  const { drafts = [] } = await manifest();
  return (await walk(postsDir, '.md')).map((f) => rel(f, postsDir)).filter((f) => !drafts.includes(f) && !drafts.includes(path.basename(f)));
}

test('dist exists (run `npm run build` first)', async () => {
  await fs.access(path.join(dist, 'index.html'));
});

test('every local link, asset and poster in the built site resolves', async (t) => {
  const pages = await walk(dist, '.html');
  const missing = [];
  let checked = 0;
  for (const file of pages) {
    const html = await fs.readFile(file, 'utf8');
    const base = `${origin}/${encode(rel(file, dist))}`;
    for (const tag of html.matchAll(/<(?:a|img|link|script|source|video)\b[^>]*>/gi)) {
      for (const attr of tag[0].matchAll(/\b(?:href|src|poster)=["']([^"']+)["']/gi)) {
        const value = attr[1].replace(/&amp;/g, '&');
        if (value.startsWith('#') || value.startsWith('data:') || value.startsWith('mailto:')) continue;
        const url = new URL(value, base);
        if (url.origin !== origin) continue;
        let target = path.join(dist, decodeURIComponent(url.pathname));
        checked++;
        try {
          if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
          await fs.access(target);
        } catch {
          missing.push(`${rel(file, dist)}: ${value}`);
        }
      }
    }
  }
  t.diagnostic(`${pages.length} pages, ${checked} local URLs`);
  assert.deepEqual(missing, [], missing.join('\n'));
  assert.ok(checked > 600, `only ${checked} local URLs audited`);
});

test('every publishable Markdown file builds at its historical URL with a canonical link', async () => {
  const files = await publishable();
  assert.ok(files.length >= 25);
  assert.ok(files.every((f) => f.includes('/')), 'publishable Markdown must live in a topic folder');
  for (const f of files) {
    const out = `posts/${f.replace(/\.md$/, '.html')}`;
    const html = await read(out);
    assert.ok(html.includes(`<link rel="canonical" href="${origin}/${encode(out)}"`), `${out} canonical`);
    assert.ok(html.includes('id="markdownRoot"'), out);
    const errors = (html.match(/class="katex-error"/g) || []).length;
    assert.ok(errors <= (KNOWN_KATEX_ERRORS[f] || 0), `${out} has ${errors} KaTeX error(s)`);
  }
});

test('legacy archive and page URLs still exist', async () => {
  for (const f of [
    'index.html',
    'universe.html',
    'categories/index.html',
    'categories/writeup.html',
    'categories/learning.html',
    'categories/project.html',
    'categories/life.html',
    'tags/index.html',
    'posts/life/daily-semester-log.html',
    'rss.xml',
    '404.html',
  ]) {
    await fs.access(path.join(dist, f));
  }
});

test('the protected draft is not published or listed anywhere', async () => {
  const { drafts } = await manifest();
  const pages = await walk(dist, '.html');
  for (const draft of drafts) {
    const name = path.basename(draft, '.md');
    for (const p of pages) assert.ok(!rel(p, dist).includes(name), `${name} was built`);
    for (const listing of ['index.html', 'categories/life.html', 'categories/learning.html', 'tags/index.html', 'universe.html', 'rss.xml']) {
      assert.ok(!(await read(listing)).includes(name), `${name} listed in ${listing}`);
    }
  }
});

test('every post appears in its category listing, the tag index, the universe map and RSS', async () => {
  const files = await publishable();
  const tags = await read('tags/index.html');
  const universe = await read('universe.html');
  const rss = await read('rss.xml');
  const prefixes = { writeup: 'writeup', learning: 'learning', project: 'project', life: 'life', daily: 'life' };
  for (const f of files) {
    const href = `/posts/${encode(f.replace(/\.md$/, '.html'))}`;
    const cat = prefixes[path.basename(f).split('-')[0].toLowerCase()];
    assert.ok((await read(`categories/${cat}.html`)).includes(`href="${href}"`), `${href} missing from ${cat}`);
    assert.ok(tags.includes(`href="${href}"`), `${href} missing from tags`);
    assert.ok(universe.includes(JSON.stringify(href).slice(1, -1)), `${href} missing from universe`);
    assert.ok(rss.includes(href), `${href} missing from rss`);
  }
});

test('the five malware parts are interlinked and use dimensioned, lazy WebP diagrams', async () => {
  let images = 0;
  for (let part = 1; part <= 5; part++) {
    const html = await read(`posts/malware-binary/learning-Malware-for-beginner-part-${part}.html`);
    for (let other = 1; other <= 5; other++) {
      if (other !== part) assert.ok(html.includes(`learning-Malware-for-beginner-part-${other}.html"`), `part ${part} -> ${other}`);
    }
    const article = html.slice(html.indexOf('id="markdownRoot"'), html.indexOf('</article>'));
    for (const m of article.matchAll(/<img\b[^>]*>/g)) {
      images++;
      assert.match(m[0], /src="\.\.\/\.\.\/assets\/malware\/[^"']+\.webp"/);
      assert.match(m[0], /width="\d+"/);
      assert.match(m[0], /height="\d+"/);
      assert.match(m[0], /loading="lazy"/);
      assert.doesNotMatch(m[0], /alt="alt text"/);
    }
  }
  assert.equal(images, 24);
});

test('posts/ holds sources only — no generated HTML is committed beside Markdown', async () => {
  const html = await walk(postsDir, '.html');
  assert.deepEqual(html.map((f) => rel(f, root)), []);
  const config = await manifest();
  assert.ok(!Object.hasOwn(config, 'redirects'));
});

test('the homepage has one h1, every chapter, and the galaxy stage', async () => {
  const home = await read('index.html');
  assert.equal((home.match(/<h1[\s>]/g) || []).length, 1);
  for (const id of ['top', 'latest', 'building', 'writeups', 'learning', 'now']) assert.ok(home.includes(`id="${id}"`), id);
  assert.ok(home.includes('data-galaxy') && home.includes('/galaxy-poster.webp'));
  await fs.access(path.join(dist, 'galaxy-poster.webp'));
  await fs.access(path.join(dist, 'og.jpg'));
});
