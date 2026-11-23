/* Star Atlas Global Command Palette (⌘K / /): lazy-loaded index across notes, sections, tags, worlds, and actions. */

interface SearchHeading {
  id: string;
  text: string;
  depth: number;
}

interface SearchPost {
  title: string;
  href: string;
  category: string;
  categoryLabel: string;
  topic: string;
  date: string;
  minutes: number;
  summary: string;
  tags: string[];
  headings: SearchHeading[];
}

interface SearchCategory {
  key: string;
  label: string;
  plural: string;
  blurb: string;
  color: string;
  href: string;
  count: number;
}

interface SearchTag {
  name: string;
  count: number;
  href: string;
}

interface SearchIndex {
  version: number;
  colors: Record<string, string>;
  categories: SearchCategory[];
  tags: SearchTag[];
  posts: SearchPost[];
}

type Scope = 'all' | 'posts' | 'headings' | 'tags' | 'actions';
type ItemKind = 'post' | 'heading' | 'local-heading' | 'category' | 'tag' | 'action';

interface PaletteItem {
  kind: ItemKind;
  title: string;
  subtitle?: string;
  href?: string;
  color?: string;
  meta?: string;
  tags?: string[];
  external?: boolean;
  keywords?: string;
  level?: number;
  score?: number;
  date?: string;
  run?: () => void;
}

interface RecentEntry {
  title: string;
  href: string;
  subtitle?: string;
  color?: string;
  meta?: string;
}

interface Routes {
  home: string;
  categories: string;
  universe: string;
  tags: string;
  rss: string;
  github: string;
  email: string;
}

const SCOPES: Scope[] = ['all', 'posts', 'headings', 'tags', 'actions'];
const RECENT_KEY = 'nhan_atlas_recent_v2';

const fold = (value: string): string =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();

function buildFoldedMap(text: string) {
  const chars = Array.from(text);
  let folded = '';
  const origins: number[] = [];
  for (let i = 0; i < chars.length; i += 1) {
    const piece = fold(chars[i]);
    for (let j = 0; j < piece.length; j += 1) {
      folded += piece[j];
      origins.push(i);
    }
  }
  return { chars, folded, origins };
}

function renderHighlighted(text: string, tokens: string[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const cleanTokens = tokens.filter(Boolean);
  if (!text || cleanTokens.length === 0) {
    fragment.append(text);
    return fragment;
  }

  const { chars, folded, origins } = buildFoldedMap(text);
  const mask = new Uint8Array(chars.length);
  for (const token of cleanTokens) {
    let start = 0;
    while (start < folded.length) {
      const pos = folded.indexOf(token, start);
      if (pos === -1) break;
      for (let k = pos; k < pos + token.length; k += 1) mask[origins[k]] = 1;
      start = pos + token.length;
    }
  }

  let buffer = '';
  let inMark = false;
  const flush = () => {
    if (!buffer) return;
    if (inMark) {
      const mark = document.createElement('mark');
      mark.className = 'cmd-mark';
      mark.textContent = buffer;
      fragment.append(mark);
    } else {
      fragment.append(buffer);
    }
    buffer = '';
  };

  for (let i = 0; i < chars.length; i += 1) {
    const marked = mask[i] === 1;
    if (marked !== inMark) {
      flush();
      inMark = marked;
    }
    buffer += chars[i];
  }
  flush();
  return fragment;
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (needle.length < 4) return false;
  let n = 0;
  for (let h = 0; h < haystack.length && n < needle.length; h += 1) {
    if (haystack[h] === needle[n]) n += 1;
  }
  return n === needle.length;
}

function scoreField(
  foldedField: string,
  token: string,
  exactWeight: number,
  prefixWeight: number,
  wordWeight: number,
  subWeight: number,
): number {
  if (!foldedField || !token) return 0;
  if (foldedField === token) return exactWeight;
  if (foldedField.startsWith(token)) return prefixWeight;
  const pos = foldedField.indexOf(token);
  if (pos !== -1) {
    const before = pos > 0 ? foldedField[pos - 1] : ' ';
    if (/[\s\-_/:.#(]/.test(before)) return wordWeight;
    return subWeight;
  }
  return 0;
}

let toastTimer = 0;
function showToast(message: string) {
  let toast = document.getElementById('cmd-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cmd-toast';
    toast.className = 'cmd-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast?.classList.remove('is-visible'), 2200);
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    showToast('Could not copy to clipboard.');
  }
}

export function initCommandPalette() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-cmdk]');
  const input = dialog?.querySelector<HTMLInputElement>('[data-cmdk-input]');
  const clearBtn = dialog?.querySelector<HTMLButtonElement>('[data-cmdk-clear]');
  const closeBtn = dialog?.querySelector<HTMLButtonElement>('[data-cmdk-close]');
  const listEl = dialog?.querySelector<HTMLDivElement>('[data-cmdk-list]');
  const statusEl = dialog?.querySelector<HTMLElement>('[data-cmdk-status]');
  const scopeTabs = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('[data-cmdk-scope]') || []);
  const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-cmdk-open]'));

  if (!dialog || !input || !listEl || !statusEl) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  const shortcutLabel = isApple ? '⌘K' : 'Ctrl K';

  triggers.forEach((btn) => {
    const kbd = btn.querySelector('kbd');
    if (kbd) kbd.textContent = shortcutLabel;
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-keyshortcuts', isApple ? 'Meta+K /' : 'Control+K /');
  });

  const indexUrl = dialog.dataset.indexUrl || '/search-index.json';
  let routes: Routes = {
    home: '/',
    categories: '/categories/index.html',
    universe: '/universe.html',
    tags: '/tags/index.html',
    rss: '/rss.xml',
    github: 'https://github.com/Nhan-Laptop',
    email: 'nguyentrongnhan06cm@gmail.com',
  };
  try {
    if (dialog.dataset.routes) routes = { ...routes, ...JSON.parse(dialog.dataset.routes) };
  } catch {
    /* keep defaults */
  }

  let activeScope: Scope = 'all';
  let flatItems: PaletteItem[] = [];
  let activeIndex = -1;
  let indexData: SearchIndex | null = null;
  let indexPromise: Promise<SearchIndex | null> | null = null;
  let indexFailed = false;
  let previousFocus: HTMLElement | null = null;
  let pointerLockedUntil = 0;

  function loadIndex(): Promise<SearchIndex | null> {
    if (indexData) return Promise.resolve(indexData);
    if (indexPromise) return indexPromise;
    indexPromise = fetch(indexUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SearchIndex>;
      })
      .then((data) => {
        indexData = data;
        indexFailed = false;
        if (dialog?.open) render();
        return data;
      })
      .catch(() => {
        indexFailed = true;
        if (dialog?.open) render();
        return null;
      });
    return indexPromise;
  }

  function getLocalHeadings(): PaletteItem[] {
    const article = document.getElementById('markdownRoot');
    if (!article) return [];
    const pageTitle = (document.querySelector('main h1')?.textContent || document.title || '').trim();
    const crumbColor =
      (document.querySelector<HTMLElement>('nav[aria-label="Breadcrumb"] a[style*="color"]')?.style.color || '').trim() ||
      '#a9b8ff';
    return Array.from(article.querySelectorAll<HTMLElement>('h2[id], h3[id]')).map((heading) => {
      const clone = heading.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.heading-anchor, .katex-mathml').forEach((node) => node.remove());
      const cleanText = (clone.textContent || '').replace(/^#\s*/, '').replace(/\s+/g, ' ').trim();
      return {
        kind: 'local-heading' as const,
        title: cleanText,
        subtitle: pageTitle,
        href: `#${heading.id}`,
        color: crumbColor,
        level: heading.tagName === 'H3' ? 3 : 2,
        meta: heading.tagName === 'H3' ? 'Subsection' : 'Section',
      };
    });
  }

  function getActions(): PaletteItem[] {
    const actions: PaletteItem[] = [
      {
        kind: 'action',
        title: 'Home',
        subtitle: 'Milky Way journey, latest notes, and /now',
        href: routes.home,
        color: '#ffc98b',
        meta: 'Page',
        keywords: 'home index landing galaxy start',
      },
      {
        kind: 'action',
        title: 'Writing & Categories',
        subtitle: 'Browse learning notes, writeups, projects, and life logs',
        href: routes.categories,
        color: '#a9b8ff',
        meta: 'Archive',
        keywords: 'writing categories folders archive browse',
      },
      {
        kind: 'action',
        title: 'Universe Map',
        subtitle: 'Interactive Three.js galaxy mapped to published posts',
        href: routes.universe,
        color: '#8ef0c4',
        meta: 'Map',
        keywords: 'universe cosmos stars map galaxy 3d',
      },
      {
        kind: 'action',
        title: 'Tag Explorer',
        subtitle: 'Filter notes and writeups across topics',
        href: routes.tags,
        color: '#ff9fb8',
        meta: 'Archive',
        keywords: 'tags topics filter search',
      },
      {
        kind: 'action',
        title: 'Copy current page link',
        subtitle: window.location.href,
        color: '#a9b8ff',
        meta: 'Action',
        keywords: 'copy link url share permalink',
        run: () => {
          void copyText(window.location.href, 'Page link copied to clipboard.');
        },
      },
      {
        kind: 'action',
        title: 'Copy email address',
        subtitle: routes.email,
        color: '#ffc98b',
        meta: 'Contact',
        keywords: 'email contact mail copy',
        run: () => {
          void copyText(routes.email, 'Email copied to clipboard.');
        },
      },
      {
        kind: 'action',
        title: 'RSS Feed',
        subtitle: 'Subscribe to new cryptography notes and writeups',
        href: routes.rss,
        color: '#8ef0c4',
        meta: 'Feed',
        keywords: 'rss atom feed subscribe xml',
      },
      {
        kind: 'action',
        title: 'GitHub (@Nhan-Laptop)',
        subtitle: 'Open repositories in a new tab',
        href: routes.github,
        external: true,
        color: '#edeff5',
        meta: 'External',
        keywords: 'github code repo profile source',
      },
    ];

    if (document.getElementById('markdownRoot')) {
      actions.unshift({
        kind: 'action',
        title: 'Scroll to top of article',
        subtitle: 'Return to the title and metadata',
        color: '#ffc98b',
        meta: 'Reading',
        keywords: 'top scroll beginning article',
        run: () => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }),
      });
    }

    return actions;
  }

  function readRecent(): RecentEntry[] {
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
    } catch {
      return [];
    }
  }

  function recordRecent(item: PaletteItem) {
    if (!item.href || item.external || item.href.startsWith('#')) return;
    try {
      const next: RecentEntry[] = [
        {
          title: item.title,
          href: item.href,
          subtitle: item.subtitle,
          color: item.color,
          meta: item.meta,
        },
        ...readRecent().filter((entry) => entry.href !== item.href),
      ].slice(0, 3);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore storage restrictions */
    }
  }

  function setScope(scope: Scope) {
    activeScope = scope;
    render();
  }

  function computeResults() {
    const rawQuery = input!.value.trim();
    let effectiveScope: Scope = activeScope;
    let cleaned = rawQuery;
    if (rawQuery.startsWith('#')) {
      effectiveScope = 'tags';
      cleaned = rawQuery.slice(1).trim();
    } else if (rawQuery.startsWith('>')) {
      effectiveScope = 'actions';
      cleaned = rawQuery.slice(1).trim();
    }

    const foldedQuery = fold(cleaned);
    const tokens = foldedQuery.split(/\s+/).filter(Boolean);
    const localHeadings = getLocalHeadings();
    const actions = getActions();
    const colors = indexData?.colors || {};
    const groups: { label: string; items: PaletteItem[] }[] = [];

    if (!foldedQuery) {
      if (effectiveScope === 'all' || effectiveScope === 'headings') {
        if (localHeadings.length > 0) {
          const topChapters = localHeadings.filter((h) => h.level === 2);
          const slice =
            effectiveScope === 'headings' ? localHeadings.slice(0, 24) : (topChapters.length ? topChapters : localHeadings).slice(0, 5);
          groups.push({ label: 'On this page', items: slice });
        } else if (effectiveScope === 'headings' && indexData) {
          const sample: PaletteItem[] = [];
          for (const post of indexData.posts) {
            const firstH2 = post.headings.find((h) => h.depth === 2) || post.headings[0];
            if (firstH2) {
              sample.push({
                kind: 'heading',
                title: firstH2.text,
                subtitle: post.title,
                href: `${post.href}#${encodeURIComponent(firstH2.id)}`,
                color: colors[post.category],
                meta: post.categoryLabel,
              });
            }
            if (sample.length >= 14) break;
          }
          if (sample.length) groups.push({ label: 'Sections across notes', items: sample });
        }
      }

      if (effectiveScope === 'all') {
        const recent = readRecent();
        if (recent.length > 0) {
          groups.push({
            label: 'Recent',
            items: recent.map((entry) => ({
              kind: 'post',
              title: entry.title,
              subtitle: entry.subtitle,
              href: entry.href,
              color: entry.color,
              meta: entry.meta,
            })),
          });
        }
      }

      if ((effectiveScope === 'all' || effectiveScope === 'posts') && indexData) {
        const limit = effectiveScope === 'posts' ? 35 : 4;
        const posts = indexData.posts.slice(0, limit).map((post): PaletteItem => ({
          kind: 'post',
          title: post.title,
          subtitle: post.summary,
          href: post.href,
          color: colors[post.category],
          meta: `${post.date} · ${post.minutes} min`,
          tags: post.tags.slice(0, 3),
        }));
        if (posts.length) groups.push({ label: effectiveScope === 'posts' ? 'All notes' : 'Latest notes', items: posts });
      }

      if (effectiveScope === 'all' && indexData?.categories.length) {
        groups.push({
          label: 'Explore worlds',
          items: indexData.categories.map((cat): PaletteItem => ({
            kind: 'category',
            title: cat.plural,
            subtitle: cat.blurb,
            href: cat.href,
            color: cat.color,
            meta: `${cat.count} ${cat.count === 1 ? 'post' : 'posts'}`,
          })),
        });
      }

      if (effectiveScope === 'tags' && indexData) {
        groups.push({
          label: 'Popular tags',
          items: indexData.tags.slice(0, 32).map((tag): PaletteItem => ({
            kind: 'tag',
            title: `#${tag.name}`,
            subtitle: `Filter archive by #${tag.name}`,
            href: tag.href,
            color: '#ffc98b',
            meta: `${tag.count} ${tag.count === 1 ? 'post' : 'posts'}`,
          })),
        });
      }

      if (effectiveScope === 'all' || effectiveScope === 'actions') {
        groups.push({
          label: effectiveScope === 'actions' ? 'Navigate & actions' : 'Quick actions',
          items: effectiveScope === 'actions' ? actions : actions.slice(0, 5),
        });
      }

      return { groups, tokens: [], effectiveScope };
    }

    // Scored search
    if (effectiveScope === 'all' || effectiveScope === 'headings') {
      const scoredLocal: PaletteItem[] = [];
      for (const h of localHeadings) {
        const fTitle = fold(h.title);
        let score = 0;
        let ok = true;
        for (const token of tokens) {
          const s = scoreField(fTitle, token, 110, 80, 55, 35) || (tokens.length === 1 && isSubsequence(token, fTitle) ? 4 : 0);
          if (!s) {
            ok = false;
            break;
          }
          score += s;
        }
        if (ok) scoredLocal.push({ ...h, score: score + 20 });
      }
      scoredLocal.sort((a, b) => (b.score || 0) - (a.score || 0));
      if (scoredLocal.length) {
        groups.push({ label: 'On this page', items: scoredLocal.slice(0, effectiveScope === 'headings' ? 14 : 4) });
      }
    }

    if ((effectiveScope === 'all' || effectiveScope === 'posts') && indexData) {
      const scoredPosts: PaletteItem[] = [];
      for (const post of indexData.posts) {
        const fTitle = fold(post.title);
        const fSummary = fold(post.summary);
        const fCategory = fold(`${post.categoryLabel} ${post.topic}`);
        const fTags = post.tags.map(fold);
        const fHeadings = post.headings.map((h) => ({ ...h, folded: fold(h.text) }));

        let score = 0;
        let ok = true;
        let bestHeading: SearchHeading | null = null;
        for (const token of tokens) {
          const sTitle = scoreField(fTitle, token, 130, 90, 62, 40);
          let sTag = 0;
          for (const t of fTags) sTag = Math.max(sTag, scoreField(t, token, 75, 50, 35, 22));
          let sHeading = 0;
          for (const h of fHeadings) {
            const hs = scoreField(h.folded, token, 48, 36, 28, 18);
            if (hs > sHeading) {
              sHeading = hs;
              if (!bestHeading) bestHeading = h;
            }
          }
          const sCat = scoreField(fCategory, token, 42, 30, 22, 14);
          const sSum = scoreField(fSummary, token, 32, 24, 18, 12);
          const best = Math.max(sTitle, sTag, sHeading, sCat, sSum);
          if (best > 0) {
            score += sTitle + sTag * 0.8 + sHeading * 0.85 + sCat * 0.45 + sSum * 0.6;
          } else if (tokens.length === 1 && isSubsequence(token, fTitle)) {
            score += 4;
          } else {
            ok = false;
            break;
          }
        }

        if (ok) {
          scoredPosts.push({
            kind: 'post',
            title: post.title,
            subtitle: bestHeading && !fTitle.includes(tokens[0]) ? `§ ${bestHeading.text}` : post.summary,
            href: post.href,
            color: colors[post.category],
            meta: `${post.date} · ${post.minutes} min`,
            tags: post.tags.slice(0, 4),
            score,
            date: post.date,
          });
        }
      }
      scoredPosts.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.date || '').localeCompare(a.date || ''));
      if (scoredPosts.length) {
        groups.push({ label: 'Notes', items: scoredPosts.slice(0, effectiveScope === 'posts' ? 28 : 6) });
      }
    }

    if ((effectiveScope === 'all' || effectiveScope === 'headings') && indexData) {
      const currentPath = decodeURIComponent(window.location.pathname);
      const scoredHeadings: PaletteItem[] = [];
      for (const post of indexData.posts) {
        if (currentPath === decodeURIComponent(new URL(post.href, document.baseURI).pathname)) continue;
        const fPostTitle = fold(post.title);
        for (const h of post.headings) {
          const fHeading = fold(h.text);
          let score = 0;
          let ok = true;
          let matchedDirectly = false;
          for (const token of tokens) {
            const sh = scoreField(fHeading, token, 110, 78, 52, 34);
            const sp = scoreField(fPostTitle, token, 26, 20, 15, 10);
            if (sh > 0) matchedDirectly = true;
            if (sh + sp === 0) {
              ok = false;
              break;
            }
            score += sh + sp * 0.5;
          }
          if (ok && matchedDirectly) {
            scoredHeadings.push({
              kind: 'heading',
              title: h.text,
              subtitle: post.title,
              href: `${post.href}#${encodeURIComponent(h.id)}`,
              color: colors[post.category],
              meta: post.categoryLabel,
              score: score + (h.depth === 2 ? 6 : 0),
            });
          }
        }
      }
      scoredHeadings.sort((a, b) => (b.score || 0) - (a.score || 0));
      if (scoredHeadings.length) {
        groups.push({ label: 'Matching sections', items: scoredHeadings.slice(0, effectiveScope === 'headings' ? 25 : 5) });
      }
    }

    if ((effectiveScope === 'all' || effectiveScope === 'tags') && indexData) {
      const scoredTags: PaletteItem[] = [];
      for (const tag of indexData.tags) {
        const fTag = fold(tag.name);
        let score = 0;
        let ok = true;
        for (const token of tokens) {
          const s = scoreField(fTag, token, 120, 85, 60, 40) || (tokens.length === 1 && isSubsequence(token, fTag) ? 4 : 0);
          if (!s) {
            ok = false;
            break;
          }
          score += s;
        }
        if (ok) {
          scoredTags.push({
            kind: 'tag',
            title: `#${tag.name}`,
            subtitle: `Filter archive by #${tag.name}`,
            href: tag.href,
            color: '#ffc98b',
            meta: `${tag.count} ${tag.count === 1 ? 'post' : 'posts'}`,
            score: score + Math.min(tag.count, 10),
          });
        }
      }
      scoredTags.sort((a, b) => (b.score || 0) - (a.score || 0));
      if (scoredTags.length) {
        groups.push({ label: 'Tags', items: scoredTags.slice(0, effectiveScope === 'tags' ? 28 : 5) });
      }
    }

    if (effectiveScope === 'all' || effectiveScope === 'actions') {
      const candidates: PaletteItem[] = [
        ...(indexData?.categories || []).map((cat): PaletteItem => ({
          kind: 'category',
          title: cat.plural,
          subtitle: cat.blurb,
          href: cat.href,
          color: cat.color,
          meta: `${cat.count} ${cat.count === 1 ? 'post' : 'posts'}`,
          keywords: `${cat.key} ${cat.label} category archive folder`,
        })),
        ...actions,
      ];
      const scoredActions: PaletteItem[] = [];
      for (const act of candidates) {
        const fTitle = fold(act.title);
        const fSub = fold(`${act.subtitle || ''} ${act.keywords || ''}`);
        let score = 0;
        let ok = true;
        for (const token of tokens) {
          const s1 = scoreField(fTitle, token, 110, 78, 52, 34);
          const s2 = scoreField(fSub, token, 45, 32, 22, 14);
          if (s1 + s2 === 0) {
            ok = false;
            break;
          }
          score += s1 + s2 * 0.6;
        }
        if (ok) scoredActions.push({ ...act, score });
      }
      scoredActions.sort((a, b) => (b.score || 0) - (a.score || 0));
      if (scoredActions.length) {
        groups.push({ label: 'Destinations & actions', items: scoredActions.slice(0, effectiveScope === 'actions' ? 16 : 4) });
      }
    }

    return { groups, tokens, effectiveScope };
  }

  function setActive(index: number, scrollIntoView: boolean) {
    const options = listEl!.querySelectorAll<HTMLElement>('[role="option"]');
    if (options.length === 0) {
      activeIndex = -1;
      input!.removeAttribute('aria-activedescendant');
      dialog!.style.removeProperty('--cmd-accent');
      return;
    }
    const next = ((index % options.length) + options.length) % options.length;
    activeIndex = next;
    options.forEach((el, idx) => {
      const selected = idx === next;
      el.classList.toggle('is-active', selected);
      el.setAttribute('aria-selected', String(selected));
    });
    const activeEl = options[next];
    input!.setAttribute('aria-activedescendant', activeEl.id);
    const accent = activeEl.dataset.color || '#a9b8ff';
    dialog!.style.setProperty('--cmd-accent', accent);
    if (scrollIntoView) activeEl.scrollIntoView({ block: 'nearest' });
  }

  function activateItem(item: PaletteItem | undefined, openInNewTab: boolean) {
    if (!item) return;
    recordRecent(item);
    if (item.run) {
      closePalette(false);
      item.run();
      return;
    }
    if (!item.href) return;
    if (item.external || openInNewTab) {
      closePalette(true);
      window.open(item.href, '_blank', 'noopener,noreferrer');
      return;
    }

    const targetUrl = new URL(item.href, document.baseURI);
    const samePage = targetUrl.origin === window.location.origin && targetUrl.pathname === window.location.pathname;
    closePalette(false);
    if (samePage && targetUrl.hash) {
      const targetId = decodeURIComponent(targetUrl.hash.slice(1));
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        history.pushState(null, '', targetUrl.hash);
        targetEl.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      window.location.hash = targetUrl.hash;
      return;
    }
    window.location.href = targetUrl.href;
  }

  function render() {
    if (clearBtn) clearBtn.hidden = input!.value.length === 0;
    const { groups, tokens, effectiveScope } = computeResults();
    scopeTabs.forEach((tab) => {
      const selected = tab.dataset.cmdkScope === effectiveScope;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });

    flatItems = [];
    listEl!.textContent = '';

    const fragment = document.createDocumentFragment();
    let idx = 0;

    for (const group of groups) {
      if (!group.items.length) continue;
      const heading = document.createElement('div');
      heading.className = 'cmd-group-label';
      heading.textContent = group.label;
      fragment.append(heading);

      for (const item of group.items) {
        const currentIdx = idx;
        idx += 1;
        flatItems.push(item);

        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'cmd-item';
        option.id = `cmdk-opt-${currentIdx}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        const accent = item.color || '#a9b8ff';
        option.dataset.color = accent;
        option.style.setProperty('--item-accent', accent);

        const glyph = document.createElement('span');
        glyph.className = `cmd-glyph cmd-glyph-${item.kind}`;
        glyph.setAttribute('aria-hidden', 'true');
        if (item.kind === 'heading' || item.kind === 'local-heading') glyph.textContent = '§';
        else if (item.kind === 'tag') glyph.textContent = '#';
        else if (item.kind === 'action') glyph.textContent = item.external ? '↗' : '›';
        option.append(glyph);

        const main = document.createElement('span');
        main.className = 'cmd-item-main';

        const title = document.createElement('span');
        title.className = 'cmd-item-title';
        title.append(renderHighlighted(item.title, tokens));
        main.append(title);

        if (item.subtitle) {
          const sub = document.createElement('span');
          sub.className = 'cmd-item-sub';
          sub.append(renderHighlighted(item.subtitle, tokens));
          main.append(sub);
        }

        if (item.tags && item.tags.length > 0 && tokens.length > 0) {
          const tagRow = document.createElement('span');
          tagRow.className = 'cmd-item-tags';
          for (const tag of item.tags) {
            const chip = document.createElement('span');
            chip.append(renderHighlighted(`#${tag}`, tokens));
            tagRow.append(chip);
          }
          main.append(tagRow);
        }

        option.append(main);

        if (item.meta) {
          const meta = document.createElement('span');
          meta.className = 'cmd-item-meta';
          meta.textContent = item.meta;
          option.append(meta);
        }

        option.addEventListener('pointermove', () => {
          if (performance.now() < pointerLockedUntil) return;
          if (activeIndex !== currentIdx) setActive(currentIdx, false);
        });
        option.addEventListener('click', (event) => {
          activateItem(item, event.metaKey || event.ctrlKey);
        });

        fragment.append(option);
      }
    }

    if (flatItems.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cmd-empty';
      if (!indexData && !indexFailed) {
        empty.textContent = 'Indexing the star atlas…';
      } else {
        const msg = document.createElement('p');
        msg.textContent = `No stars match “${input!.value.trim()}”.`;
        empty.append(msg);
        if (activeScope !== 'all') {
          const reset = document.createElement('button');
          reset.type = 'button';
          reset.className = 'cmd-reset-btn';
          reset.textContent = 'Search across all scopes';
          reset.addEventListener('click', () => {
            setScope('all');
            input!.focus();
          });
          empty.append(reset);
        }
      }
      fragment.append(empty);
    }

    if (indexFailed) {
      const note = document.createElement('div');
      note.className = 'cmd-notice';
      note.textContent = 'Archive index unavailable — showing local sections and navigation.';
      fragment.append(note);
    }

    listEl!.append(fragment);
    setActive(0, false);

    if (!indexData && !indexFailed) {
      statusEl!.textContent = 'Loading index…';
    } else {
      const count = flatItems.length;
      statusEl!.textContent = `${count} ${count === 1 ? 'result' : 'results'}`;
    }
  }

  function openPalette(initialText?: string, deferFocus = false) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof initialText === 'string') input!.value = initialText;
    if (!dialog!.open) {
      dialog!.showModal();
    }
    void loadIndex();
    render();
    if (deferFocus) {
      window.requestAnimationFrame(() => {
        if (typeof initialText === 'string') input!.value = initialText;
        input!.focus();
        input!.select();
      });
    } else {
      input!.focus();
      input!.select();
    }
  }

  function closePalette(restoreFocus = true) {
    if (dialog!.open) dialog!.close();
    if (restoreFocus && previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
  }

  triggers.forEach((btn) => {
    btn.addEventListener('pointerenter', () => void loadIndex(), { once: true });
    btn.addEventListener('focus', () => void loadIndex(), { once: true });
    btn.addEventListener('click', () => openPalette());
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    render();
    input.focus();
  });

  closeBtn?.addEventListener('click', () => closePalette(true));

  scopeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const next = (tab.dataset.cmdkScope as Scope) || 'all';
      setScope(SCOPES.includes(next) ? next : 'all');
      input.focus();
    });
  });

  input.addEventListener('input', () => render());

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closePalette(true);
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closePalette(true);
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || (event.ctrlKey && event.key.toLowerCase() === 'n')) {
      event.preventDefault();
      pointerLockedUntil = performance.now() + 260;
      setActive(activeIndex + 1, true);
    } else if (event.key === 'ArrowUp' || (event.ctrlKey && event.key.toLowerCase() === 'p')) {
      event.preventDefault();
      pointerLockedUntil = performance.now() + 260;
      setActive(activeIndex - 1, true);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const pos = SCOPES.indexOf(activeScope);
      const next = (pos + (event.shiftKey ? -1 : 1) + SCOPES.length) % SCOPES.length;
      setScope(SCOPES[next]);
      input.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePalette(true);
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && flatItems[activeIndex]) {
        event.preventDefault();
        activateItem(flatItems[activeIndex], event.metaKey || event.ctrlKey);
      }
    }
  });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'k') {
      event.preventDefault();
      if (dialog.open) {
        input.focus();
        input.select();
      } else {
        openPalette();
      }
      return;
    }
    if (
      event.key === '/' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !dialog.open &&
      !(event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')
    ) {
      event.preventDefault();
      event.stopPropagation();
      openPalette('', true);
    }
  });
}
