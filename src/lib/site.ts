/** Base path ('' in production, e.g. '/Nhan-Laptop.github.io' for a fork preview). Set via SITE_BASE. */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
/** Prefix a root-relative path ("/x.html") with the configured base. */
export const url = (path: string) => `${BASE}${path}`;

export const SITE = {
  url: 'https://nhan-laptop.github.io',
  name: "Nhan's Security Log",
  author: 'Nguyen Trong Nhan',
  handle: 'nhan',
  github: 'https://github.com/Nhan-Laptop',
  description:
    'Cryptography research notes, CTF writeups, malware internals and small tools by Nguyen Trong Nhan, an Information Security student at UIT – VNUHCM.',
};

export type CategoryKey = 'writeup' | 'learning' | 'project' | 'life';

export interface Category {
  key: CategoryKey;
  label: string;
  plural: string;
  blurb: string;
  /** Star colour on the universe map and accents. */
  color: string;
  href: string;
}

export const CATEGORIES: Record<CategoryKey, Category> = {
  learning: {
    key: 'learning',
    label: 'Learning',
    plural: 'Learning notes',
    blurb: 'Long notes on lattices, homomorphic encryption, NTT, protocols and Windows internals.',
    color: '#a9b8ff',
    href: url('/categories/learning.html'),
  },
  writeup: {
    key: 'writeup',
    label: 'Writeup',
    plural: 'Writeups',
    blurb: 'CTF challenges, solved step by step — analysis, exploit and verification.',
    color: '#ffc98b',
    href: url('/categories/writeup.html'),
  },
  project: {
    key: 'project',
    label: 'Project',
    plural: 'Projects',
    blurb: 'Research prototypes and tools I build for CTF players.',
    color: '#8ef0c4',
    href: url('/categories/project.html'),
  },
  life: {
    key: 'life',
    label: 'Life',
    plural: 'Life',
    blurb: 'Competition travel, semesters and life beyond the terminal.',
    color: '#ff9fb8',
    href: url('/categories/life.html'),
  },
};

export const CATEGORY_ORDER: CategoryKey[] = ['learning', 'writeup', 'project', 'life'];

export function inferCategory(fileName: string): CategoryKey | null {
  const lower = fileName.split('/').pop()!.toLowerCase();
  if (lower.startsWith('writeup-')) return 'writeup';
  if (lower.startsWith('learning-')) return 'learning';
  if (lower.startsWith('project-')) return 'project';
  if (lower.startsWith('daily-') || lower.startsWith('life-')) return 'life';
  return null;
}

/** "ctf/writeup-n1ctf-2025" -> "/posts/ctf/writeup-n1ctf-2025.html" (spaces percent-encoded). */
export function postHref(id: string): string {
  return url(`/posts/${id.split('/').map(encodeURIComponent).join('/')}.html`);
}

export function tagHref(tag: string): string {
  return url(`/tags/index.html#${encodeURIComponent(tag)}`);
}

/** Drop a leading "[Project] " / "[Daily/Life] " label: the category is shown separately. */
export function cleanTitle(title: string): string {
  return title.replace(/^\[[^\]]{1,24}\]\s*/, '').trim();
}

export function formatDate(iso: string, style: 'short' | 'long' = 'short'): string {
  if (!iso) return 'Undated';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Stable small hash, used for view-transition names. */
export function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
