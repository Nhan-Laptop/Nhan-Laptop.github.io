const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { collectMarkdownFiles, encodeUrlPath } = require('../scripts/post-paths');

const root = path.resolve(__dirname, '..');
const postsDirectory = path.join(root, 'posts');
const origin = 'https://nhan-laptop.github.io';

async function manifest() {
    return JSON.parse(await fs.readFile(path.join(postsDirectory, 'manifest.json'), 'utf8'));
}

async function htmlFiles(directory) {
    const files = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await htmlFiles(filename));
        else if (entry.isFile() && entry.name.endsWith('.html')) files.push(filename);
    }
    return files;
}

test('all published HTML links, assets, posters and canonical URLs resolve locally', async t => {
    const topLevel = (await fs.readdir(root)).filter(file => file.endsWith('.html')).map(file => path.join(root, file));
    const files = [...topLevel, ...await htmlFiles(postsDirectory), ...await htmlFiles(path.join(root, 'categories')), ...await htmlFiles(path.join(root, 'tags'))];
    const missing = [];
    let checked = 0;
    for (const file of files) {
        const html = await fs.readFile(file, 'utf8');
        const relative = path.relative(root, file).split(path.sep).join('/');
        const base = `${origin}/${encodeUrlPath(relative)}`;
        assert.doesNotMatch(html, /\{\{(?:ROOT_PREFIX|DOCUMENT_TITLE|SEO_META|CATEGORY_HREF|POST_TITLE|POST_META|POST_LIST)\}\}/, relative);
        for (const tag of html.matchAll(/<(?:a|img|link|script|source|video)\b[^>]*>/gi)) {
            for (const attribute of tag[0].matchAll(/\b(?:href|src|poster)=["']([^"']+)["']/gi)) {
                const url = new URL(attribute[1].replace(/&amp;/g, '&'), base);
                if (url.origin !== origin) continue;
                let target = path.join(root, decodeURIComponent(url.pathname));
                checked += 1;
                try {
                    if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
                    await fs.access(target);
                } catch { missing.push(`${relative}: ${attribute[1]}`); }
            }
        }
    }
    t.diagnostic(`${files.length} pages and ${checked} local URLs audited`);
    assert.deepEqual(missing, [], missing.join('\n'));
    assert.ok(checked > 300, `Only ${checked} local URLs were audited`);
});

test('every publishable Markdown file has a nested HTML companion and correct canonical', async () => {
    const config = await manifest();
    const files = await collectMarkdownFiles(postsDirectory, new Set(config.drafts));
    assert.ok(files.every(file => file.includes('/')), 'Publishable sources must be inside topic folders');
    for (const file of files) {
        const output = file.replace(/\.md$/, '.html');
        const html = await fs.readFile(path.join(postsDirectory, output), 'utf8');
        assert.ok(html.includes(`href="${origin}/posts/${encodeUrlPath(output)}"`), output);
        assert.ok(html.includes('id="markdownRoot"'), output);
    }
});

test('the protected life draft has no generated page or archive entry', async () => {
    const config = await manifest();
    const listings = await Promise.all(['categories/learning.html', 'categories/life.html', 'tags/index.html', 'index.html'].map(file => fs.readFile(path.join(root, file), 'utf8')));
    for (const draft of config.drafts) {
        const htmlName = draft.replace(/\.md$/, '.html');
        await assert.rejects(fs.access(path.join(postsDirectory, htmlName)), { code: 'ENOENT' });
        for (const listing of listings) assert.ok(!listing.includes(htmlName), htmlName);
    }
});

test('all five malware parts are listed, interlinked, and reference dimensioned WebP diagrams', async () => {
    const learning = await fs.readFile(path.join(root, 'categories/learning.html'), 'utf8');
    const tags = await fs.readFile(path.join(root, 'tags/index.html'), 'utf8');
    let images = 0;
    for (let part = 1; part <= 5; part += 1) {
        const filename = `learning-Malware-for-beginner-part-${part}.html`;
        const html = await fs.readFile(path.join(postsDirectory, 'malware-binary', filename), 'utf8');
        assert.ok(learning.includes(`../posts/malware-binary/${filename}`), filename);
        assert.ok(tags.includes(`../posts/malware-binary/${filename}`), filename);
        for (let sibling = 1; sibling <= 5; sibling += 1) {
            if (sibling !== part) assert.ok(html.includes(`href="learning-Malware-for-beginner-part-${sibling}.html"`), filename);
        }
        assert.doesNotMatch(html, /katex-error|<h6\b/);
        for (const match of html.matchAll(/<img\b[^>]*>/g)) {
            images += 1;
            assert.match(match[0], /src="\.\.\/\.\.\/assets\/malware\/[^"']+\.webp"/);
            assert.match(match[0], /width="\d+"/);
            assert.match(match[0], /height="\d+"/);
            assert.match(match[0], /loading="lazy"/);
            assert.doesNotMatch(match[0], /alt="alt text"/);
        }
    }
    assert.equal(images, 24);
});

test('posts/ has no loose HTML or legacy redirect configuration', async () => {
    const config = await manifest();
    assert.ok(!Object.hasOwn(config, 'redirects'));
    const rootEntries = await fs.readdir(postsDirectory, { withFileTypes: true });
    const looseHtml = rootEntries.filter(entry => entry.isFile() && entry.name.endsWith('.html')).map(entry => entry.name);
    assert.deepEqual(looseHtml, [], 'Article HTML must stay inside topic folders');
    await assert.rejects(fs.access(path.join(postsDirectory, 'learning-malware-for-beginners.md')), { code: 'ENOENT' });
});

test('the homepage keeps its feed and about sections below the galaxy journey', async () => {
    const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
    for (const marker of ['id="sky-root"', 'id="latest-posts"', 'id="welcome"', 'id="about"', 'assets/js/landing.bundle.js']) {
        assert.ok(html.includes(marker), marker);
    }
    assert.ok(!html.includes('universe-background.bundle.js'));
    assert.equal(html.match(/<h1\b/g).length, 1, 'only the noscript headline is an h1 in the static HTML');
});

test('homepage static copy matches the journey it stands in for', async () => {
    const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');
    const app = await fs.readFile(path.join(root, 'src/landing/App.jsx'), 'utf8');
    const chapters = [...app.matchAll(/name: '([^']+)',\s*topic: '([^']+)',\s*text: '([^']+)',\s*action: '([^']+)',\s*href: '([^']+)'/g)];
    assert.equal(chapters.length, 4);
    for (const [, name, , text, action, href] of chapters) {
        for (const value of [`>${name}</h2>`, text, `href="${href}">${action}`]) {
            assert.ok(home.includes(value), `index.html is missing ${value}`);
        }
    }
    assert.ok(home.includes('Every secret') && home.includes('leaves a trace.'));
    assert.equal((home.match(/<h1[\s>]/g) || []).length, 1);
    assert.ok(home.indexOf('assets/js/common.js') < home.indexOf('assets/js/landing.bundle.js'));
});
