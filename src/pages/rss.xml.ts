import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getSummaries } from '../lib/posts';
import { SITE } from '../lib/site';

export async function GET(context: APIContext) {
  const posts = await getSummaries();
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: posts.map((p) => ({
      title: p.title,
      link: p.href,
      pubDate: new Date(`${p.date}T00:00:00Z`),
      description: p.summary,
      categories: [p.category, ...p.tags],
    })),
  });
}
