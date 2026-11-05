/**
 * Markdown pipeline for the posts/ folder.
 *
 * Ported from the former build.js so every article renders exactly as before:
 * frontmatter (with legacy inline `Date:` / `Tags:` / `Summary:` fallbacks),
 * HackMD syntax, marked + highlight.js + KaTeX, and local image dimensions.
 * New: heading ids and a table of contents.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import katex from 'katex';
import markedKatex from 'marked-katex-extension';

export interface PostMeta {
  date: string;
  tags: string[];
  summary: string;
}

export interface Heading {
  depth: number;
  id: string;
  text: string;
}

/* ------------------------------------------------------------------ metadata */

function parseYamlScalar(value = ''): string {
  const t = String(value).trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^\s*---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  const meta = { found: false, date: '', tags: [] as string[], summary: '' };
  if (!match) return meta;
  meta.found = true;
  let key = '';
  for (const line of match[1].split('\n')) {
    const keyMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (keyMatch) {
      key = keyMatch[1].toLowerCase();
      const value = parseYamlScalar(keyMatch[2]);
      if (key === 'date') meta.date = value;
      if (key === 'summary') meta.summary = value;
      if (key === 'tags' && /^\[.*\]$/.test(value)) {
        meta.tags = value.slice(1, -1).split(',').map(parseYamlScalar).filter(Boolean);
      }
      continue;
    }
    const item = line.match(/^\s*-\s*(.+)$/);
    if (key === 'tags' && item) meta.tags.push(parseYamlScalar(item[1]));
  }
  return meta;
}

export function parseMarkdownMetadata(markdown: string): PostMeta {
  const fm = parseFrontmatter(markdown);
  const dateMatch = markdown.match(/^\s*(?:\*\*)?Date:\s*(?:\*\*)?(.+)$/im);
  const tagsMatch = markdown.match(/^\s*(?:\*\*)?Tags:\s*(?:\*\*)?(.+)$/im);
  const summaryMatch = markdown.match(/^\s*(?:\*\*)?Summary:\s*(?:\*\*)?(.+)$/im);

  const rawDate = fm.date || (dateMatch ? dateMatch[1].trim() : '');
  const iso = rawDate.match(/\b(20\d{2}-\d{2}-\d{2})\b/);

  const inlineTags = tagsMatch ? tagsMatch[1].trim().match(/#[A-Za-z0-9_-]+/g) || [] : [];
  const tags = [...new Set((fm.tags.length ? fm.tags : inlineTags).map((t) => t.replace(/^#/, '').toLowerCase()))];

  const summary = fm.summary || (summaryMatch ? summaryMatch[1].trim() : '');
  return { date: iso ? iso[1] : '', tags, summary };
}

export function stripMetadataLines(markdown: string): string {
  return markdown
    .replace(/^\s*---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, '')
    .replace(/^\s*(?:\*\*)?Date:\s*(?:\*\*)?.*\n?/gim, '')
    .replace(/^\s*(?:\*\*)?Tags:\s*(?:\*\*)?.*\n?/gim, '')
    .replace(/^\s*(?:\*\*)?Summary:\s*(?:\*\*)?.*\n?/gim, '')
    .replace(/\n{3,}/g, '\n\n');
}

export function extractDescription(markdown: string): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<details>[\s\S]*?<\/details>/gi, ' ')
    .replace(/<summary>[\s\S]*?<\/summary>/gi, ' ');
  const paragraph: string[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) {
      if (paragraph.length) break;
      continue;
    }
    if (/^(#|>|!\[|\$\$|[-*+]\s+|\d+\.\s+|`|<)/.test(t) || /^(\*\*)?Tags:/i.test(t)) continue;
    paragraph.push(t);
    if (paragraph.join(' ').length >= 180) break;
  }
  const description = paragraph
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!description) return '';
  return description.length > 220 ? `${description.slice(0, 217)}…` : description;
}

/* ------------------------------------------------------------------ HackMD */

export function preprocessHackmdMarkdown(input: string): string {
  let text = input.replace(/\r\n/g, '\n');

  // 1) HackMD line-number suffix: ```python! -> ```python
  text = text.replace(/^```([A-Za-z0-9_+\-]+)!\s*$/gm, '```$1');

  // 2) :::spoiler -> <details>
  text = text.replace(/:::spoiler(?:\s+([^\n]+))?\n([\s\S]*?)\n:::/g, (_, title, body) => {
    const safeTitle = (title || 'Bấm để xem chi tiết').trim();
    return `<details>\n<summary>${safeTitle}</summary>\n\n${body}\n\n</details>`;
  });

  // 2b) :::info / :::warning / :::success / :::danger -> callouts
  text = text.replace(/^:::(info|warning|success|danger|note|tip)\s*\n([\s\S]*?)\n:::\s*$/gm, (_, kind, body) => {
    return `<div class="callout callout-${kind}">\n\n${body}\n\n</div>`;
  });

  // 3) Normalise inline LaTeX delimiters and wrap bare LaTeX block lines.
  const lines = text.split('\n');
  const out: string[] = [];
  let inCode = false;
  let inMath = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inCode = !inCode;
      out.push(line);
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }
    if (/^\$\$$/.test(trimmed)) {
      inMath = !inMath;
      out.push(line);
      continue;
    }
    if (inMath) {
      out.push(line);
      continue;
    }
    let normal = line.replace(/\\\((.+?)\\\)/g, (_, expr) => `$${expr}$`);
    // Wrap bare inline environments — but not ones already inside $…$ / $$…$$ on this line.
    normal = normal.replace(/\\begin\{([A-Za-z*]+)\}(.+?)\\end\{\1\}/g, (whole, env, body, offset: number, str: string) => {
      const dollarsBefore = (str.slice(0, offset).match(/(?<!\\)\$/g) || []).length;
      return dollarsBefore % 2 === 1 || /(?<!\\)\$\$/.test(str.slice(0, offset)) ? whole : `$\\begin{${env}}${body}\\end{${env}}$`;
    });
    const nt = normal.trim();
    const begin = nt.match(/^\\\\begin\{([^}]+)\}/);
    if (begin) {
      const env = begin[1];
      const block = [normal];
      let j = i;
      const endRe = new RegExp(`\\\\\\\\end\\{${env.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`);
      while (j + 1 < lines.length && !endRe.test(block[block.length - 1].trim())) {
        j += 1;
        block.push(lines[j].replace(/\\\((.+?)\\\)/g, (_, expr) => `$${expr}$`));
      }
      out.push('', '$$', ...block, '$$', '');
      i = j;
      continue;
    }
    if (/^\\\\fbox\{/.test(nt)) {
      out.push('', '$$', normal, '$$', '');
      continue;
    }
    out.push(normal);
  }

  let normalized = out.join('\n');
  const protectedBlocks: string[] = [];
  normalized = normalized.replace(/```[\s\S]*?```|\$\$[\s\S]*?\$\$/g, (block) => {
    const token = `@@BLOCK_${protectedBlocks.length}@@`;
    protectedBlocks.push(block);
    return token;
  });
  normalized = normalized.replace(
    /(^|\n)(\\begin\{([A-Za-z*]+)\}[\s\S]*?\\end\{\3\})(?=\n|$)/g,
    (_, prefix, block) => `${prefix}\n$$\n${block}\n$$\n`,
  );
  normalized = normalized.replace(/(^|\n)(\\fbox\{[\s\S]*?\})(?=\n|$)/g, (_, prefix, block) => `${prefix}\n$$\n${block}\n$$\n`);
  return normalized.replace(/@@BLOCK_(\d+)@@/g, (_, index) => protectedBlocks[Number(index)]);
}

/* ------------------------------------------------------------------ render */

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

function stripTags(html: string) {
  return html
    .replace(/<annotation[\s\S]*?<\/annotation>/g, '')
    .replace(/<span class="katex-mathml">[\s\S]*?<\/span>(?=<span class="katex-html")/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function createMarked(headings: Heading[]) {
  const used = new Map<string, number>();
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
        return hljs.highlightAuto(code).value;
      },
    }),
  );
  // nonStandard: also accept $$..$$ inside a paragraph and $x$ next to punctuation (common in HackMD notes).
  marked.use(markedKatex({ throwOnError: false, strict: 'ignore', output: 'htmlAndMathml', nonStandard: true, katex } as any));
  marked.use({
    renderer: {
      heading(this: any, token: any) {
        const inner = this.parser.parseInline(token.tokens);
        const plain = stripTags(inner);
        const base = slugify(plain);
        const n = used.get(base) || 0;
        used.set(base, n + 1);
        const id = n ? `${base}-${n}` : base;
        if (token.depth >= 2 && token.depth <= 3) headings.push({ depth: token.depth, id, text: plain });
        return `<h${token.depth} id="${id}"><a class="heading-anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${token.depth}>\n`;
      },
    },
  });
  return marked;
}

/* ------------------------------------------------------------------ images */

export function imageDimensions(buffer: Buffer): [number, number] | null {
  if (buffer.length >= 24 && buffer.subarray(1, 4).toString() === 'PNG') {
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  }
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const type = buffer.toString('ascii', 12, 16);
  if (type === 'VP8X') return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
  if (type === 'VP8 ') return [buffer.readUInt16LE(26) & 16383, buffer.readUInt16LE(28) & 16383];
  if (type === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return [(bits & 16383) + 1, ((bits >>> 14) & 16383) + 1];
  }
  return null;
}

/** Adds lazy-loading and intrinsic sizes to local images (resolved inside public/). */
function enhanceImages(html: string, publicDir: string, postDir: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    let out = tag;
    if (!/\bloading=/.test(out)) out = out.replace('<img', '<img loading="lazy"');
    if (!/\bdecoding=/.test(out)) out = out.replace('<img', '<img decoding="async"');
    if (/\bwidth=/.test(out) && /\bheight=/.test(out)) return out;
    const src = out.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (!src || /^(?:[a-z]+:|\/\/)/i.test(src)) return out;
    try {
      const target = src.startsWith('/')
        ? path.join(publicDir, decodeURIComponent(src))
        : path.resolve(path.join(publicDir, 'posts', postDir), decodeURIComponent(src));
      if (!target.startsWith(publicDir + path.sep)) return out;
      const size = imageDimensions(readFileSync(target));
      if (!size) return out;
      if (!/\bwidth=/.test(out)) out = out.replace('<img', `<img width="${size[0]}"`);
      if (!/\bheight=/.test(out)) out = out.replace('<img', `<img height="${size[1]}"`);
    } catch {
      /* Missing assets are reported by the link test. */
    }
    return out;
  });
}

export interface RenderResult {
  html: string;
  headings: Heading[];
  title: string;
  words: number;
}

/** Render one post's raw Markdown. `postDir` is its folder below posts/, e.g. "ctf". */
export function renderPost(raw: string, publicDir: string, postDir: string): RenderResult {
  const headings: Heading[] = [];
  const marked = createMarked(headings);
  const body = preprocessHackmdMarkdown(stripMetadataLines(raw));
  const title = (raw.match(/^#\s+(.*)$/m) || [null, 'Untitled'])[1]!.trim();

  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (/No character metrics/i.test(String(args[0] || ''))) return;
    warn(...args);
  };
  let html: string;
  try {
    html = (marked.parse(body) as string).replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, '');
  } finally {
    console.warn = warn;
  }
  html = enhanceImages(html, publicDir, postDir)
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');

  const words = body.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
  return { html, headings, title, words };
}
