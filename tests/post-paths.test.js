const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { encodeUrlPath, siteRootPrefix, collectMarkdownFiles } = require('../scripts/post-paths');
const { inferPostCategory, injectMetadata, injectLocalCssLinks, extractPostMetadata } = require('../build');

async function fixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-build-test-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    return directory;
}

async function put(directory, file, content = '') {
    const target = path.join(directory, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
}

test('root prefixes work for flat, grouped, and deeper posts', () => {
    assert.equal(siteRootPrefix('learning-example.html'), '../');
    assert.equal(siteRootPrefix('malware-binary/learning-example.html'), '../../');
    assert.equal(siteRootPrefix('ctf/2026/writeup-example.html'), '../../../');
});

test('URL encoding preserves folder separators and encodes each filename segment', () => {
    assert.equal(encodeUrlPath('projects/project-Multi Agent.html'), 'projects/project-Multi%20Agent.html');
    assert.equal(encodeUrlPath('crypto notes/learning-PE & code.html'), 'crypto%20notes/learning-PE%20%26%20code.html');
});

test('categories use the basename, not the containing topic folder', () => {
    for (const [file, category] of [
        ['ctf/2026/writeup-example.html', 'Writeup'],
        ['malware-binary/learning-example.html', 'Learning'],
        ['projects/project-example.html', 'Project'],
        ['life/life-example.html', 'Life'],
        ['life/daily-example.html', 'Life'],
    ]) assert.equal(inferPostCategory(file).label, category);
});

test('nested metadata rebases navigation, tags and canonical URLs', () => {
    const markdown = '---\ndate: 2026-10-02\nsummary: A summary.\ntags: [windows, pe-format]\n---\n\n# PE & Code\n';
    const template = '<title>{{DOCUMENT_TITLE}}</title>\n{{SEO_META}}\n<a href="{{ROOT_PREFIX}}index.html">Home</a>\n<a href="{{CATEGORY_HREF}}">{{CATEGORY_NAME}}</a>\n{{POST_META}}';
    const html = injectMetadata(template, markdown, '2020-01-01', 'malware-binary/learning-PE & Code.html');
    assert.match(html, /PE &amp; Code/);
    assert.match(html, /href="\.\.\/\.\.\/index\.html"/);
    assert.match(html, /href="\.\.\/\.\.\/categories\/learning\.html"/);
    assert.match(html, /href="\.\.\/\.\.\/tags\/index\.html"/);
    assert.match(html, /datetime="2026-10-02"/);
    assert.match(html, /https:\/\/nhan-laptop\.github\.io\/posts\/malware-binary\/learning-PE%20%26%20Code\.html/);
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
});

test('vendor styles use the same depth as the generated article', () => {
    const html = injectLocalCssLinks('<head></head>', 'ctf/2026/writeup-example.html');
    assert.match(html, /href="\.\.\/\.\.\/\.\.\/assets\/vendor\/highlight/);
    assert.match(html, /href="\.\.\/\.\.\/\.\.\/assets\/vendor\/katex/);
    assert.equal(injectLocalCssLinks(html, 'ctf/2026/writeup-example.html'), html);
});

test('category cards retain the grouped path and encode spaces', () => {
    const metadata = extractPostMetadata('# Project\n\nA short description.', 'projects/project-Multi Agent.html', '2026-10-02');
    assert.equal(metadata.link, '../posts/projects/project-Multi%20Agent.html');
});

test('discovery is recursive, deterministic, and excludes drafts by basename or relative path', async t => {
    const directory = await fixture(t);
    for (const file of ['learning-root.md', 'malware/learning-part-2.md', 'malware/learning-part-1.md', 'malware/hidden.md', 'life/hidden.md', 'life/draft.md', 'life/article.html', '.private/draft.md']) {
        await put(directory, file);
    }
    await fs.symlink(directory, path.join(directory, 'cycle'));
    const excluded = new Set(['draft.md', 'malware/hidden.md']);
    assert.deepEqual(await collectMarkdownFiles(directory, excluded), [
        'learning-root.md', 'life/hidden.md', 'malware/learning-part-1.md', 'malware/learning-part-2.md',
    ]);
});

test('build refuses ungrouped Markdown without creating root-level HTML', async t => {
    const directory = await fixture(t);
    const repository = path.resolve(__dirname, '..');
    await fs.copyFile(path.join(repository, 'build.js'), path.join(directory, 'build.js'));
    await fs.mkdir(path.join(directory, 'scripts'));
    for (const file of ['post-paths.js', 'image-dimensions.js']) {
        await fs.copyFile(path.join(repository, 'scripts', file), path.join(directory, 'scripts', file));
    }
    await fs.symlink(path.join(repository, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    await put(directory, 'posts/manifest.json', JSON.stringify({ drafts: [] }));
    await put(directory, 'posts/learning-root.md', '# Ungrouped article');
    await assert.rejects(
        promisify(execFile)(process.execPath, [path.join(directory, 'build.js')], {
            env: { ...process.env, BLOG_SKIP_POSTS: '' },
        }),
        error => error.code === 1 && /Move publishable Markdown into topic folders.*learning-root\.md/.test(error.stderr),
    );
    await assert.rejects(fs.access(path.join(directory, 'posts/learning-root.html')), { code: 'ENOENT' });
});
