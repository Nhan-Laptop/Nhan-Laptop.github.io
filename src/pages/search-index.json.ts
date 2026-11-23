import type { APIContext } from 'astro';
import { getPosts, SEMESTER_LOG } from '../lib/posts';
import { CATEGORIES, CATEGORY_ORDER, postHref, tagHref, type CategoryKey } from '../lib/site';

interface SearchHeading {
  id: string;
  text: string;
  depth: number;
}

interface SearchPost {
  title: string;
  href: string;
  category: CategoryKey;
  categoryLabel: string;
  topic: string;
  date: string;
  minutes: number;
  summary: string;
  tags: string[];
  headings: SearchHeading[];
}

function cleanExcerpt(text: string): string {
  return String(text || '')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(_context: APIContext) {
  const markdownPosts = await getPosts();

  const posts: SearchPost[] = markdownPosts.map((p) => ({
    title: p.data.title,
    href: postHref(p.id),
    category: p.data.category,
    categoryLabel: CATEGORIES[p.data.category].label,
    topic: p.data.topic,
    date: p.data.date,
    minutes: p.data.minutes,
    summary: cleanExcerpt(p.data.summary),
    tags: p.data.tags,
    headings: p.data.headings
      .filter((h) => h.depth >= 2 && h.depth <= 3 && h.id && h.text)
      .map((h) => ({ id: h.id, text: h.text, depth: h.depth })),
  }));

  posts.push({
    title: SEMESTER_LOG.title,
    href: SEMESTER_LOG.href,
    category: SEMESTER_LOG.category,
    categoryLabel: CATEGORIES[SEMESTER_LOG.category].label,
    topic: SEMESTER_LOG.topic,
    date: SEMESTER_LOG.date,
    minutes: SEMESTER_LOG.minutes,
    summary: cleanExcerpt(SEMESTER_LOG.summary),
    tags: SEMESTER_LOG.tags,
    headings: [],
  });

  posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  const categories = CATEGORY_ORDER.map((key) => {
    const cat = CATEGORIES[key];
    return {
      key: cat.key,
      label: cat.label,
      plural: cat.plural,
      blurb: cat.blurb,
      color: cat.color,
      href: cat.href,
      count: posts.filter((p) => p.category === key).length,
    };
  });

  const tagCounts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) {
      const clean = tag.replace(/^#/, '').toLowerCase();
      if (!clean) continue;
      tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
    }
  }

  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({
      name,
      count,
      href: tagHref(name),
    }));

  const colors = Object.fromEntries(CATEGORY_ORDER.map((k) => [k, CATEGORIES[k].color]));

  return new Response(
    JSON.stringify({
      version: 1,
      colors,
      categories,
      tags,
      posts,
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}
