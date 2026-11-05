import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, postHref, url, type CategoryKey } from './site';

export type Post = CollectionEntry<'posts'>;

export interface PostSummary {
  id: string;
  href: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  category: CategoryKey;
  topic: string;
  minutes: number;
}

let cache: Post[] | null = null;

/** All published posts, newest first (ties broken by title for a stable order). */
export async function getPosts(): Promise<Post[]> {
  if (!cache) {
    const all = await getCollection('posts');
    cache = all.sort((a, b) => b.data.date.localeCompare(a.data.date) || a.data.title.localeCompare(b.data.title));
  }
  return cache;
}

export function toSummary(post: Post): PostSummary {
  return {
    id: post.id,
    href: postHref(post.id),
    title: post.data.title,
    date: post.data.date,
    summary: post.data.summary,
    tags: post.data.tags,
    category: post.data.category,
    topic: post.data.topic,
    minutes: post.data.minutes,
  };
}

/** The hand-written semester log has no Markdown source but belongs in the Life archive. */
export const SEMESTER_LOG: PostSummary = {
  id: 'life/daily-semester-log',
  href: url('/posts/life/daily-semester-log.html'),
  title: 'Semester Sprint: Balancing CTF and University',
  date: '2026-03-18',
  summary: 'Nhat ky thuc te ve cach phan bo thoi gian cho hoc tap, CTF, va viec viet note de khong bi roi nhip.',
  tags: ['life', 'learning'],
  category: 'life',
  topic: 'life',
  minutes: 2,
};

export async function getSummaries(): Promise<PostSummary[]> {
  const list = (await getPosts()).map(toSummary);
  list.push(SEMESTER_LOG);
  return list.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export function countByCategory(list: PostSummary[]) {
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, 0])) as Record<CategoryKey, number>;
  for (const p of list) counts[p.category] += 1;
  return counts;
}

/** Posts that belong to a numbered series in the same folder, e.g. learning-Malware-for-beginner-part-3. */
export function seriesOf(post: Post, all: Post[]) {
  const m = post.id.match(/^(.*-part-)(\d+)$/i);
  if (!m) return null;
  const parts = all
    .filter((p) => p.id.toLowerCase().startsWith(m[1].toLowerCase()) && /-part-\d+$/i.test(p.id))
    .sort((a, b) => Number(a.id.match(/(\d+)$/)![1]) - Number(b.id.match(/(\d+)$/)![1]));
  return parts.length > 1 ? parts : null;
}
