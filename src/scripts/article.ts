/* Article enhancements: reading progress, TOC scroll-spy, code copy, image lightbox. */

const article = document.querySelector<HTMLElement>('[data-article]');
const bar = document.querySelector<HTMLElement>('[data-progress]');

function progress() {
  if (!article || !bar) return;
  const r = article.getBoundingClientRect();
  const total = r.height - innerHeight * 0.6;
  const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
  bar.style.transform = `scaleX(${p})`;
}
addEventListener('scroll', progress, { passive: true });
addEventListener('resize', progress);
progress();

/* TOC scroll-spy */
const links = new Map<string, HTMLElement>();
document.querySelectorAll<HTMLElement>('[data-toc-link]').forEach((a) => links.set(a.dataset.tocLink!, a));
if (links.size) {
  const headings = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
  let current = '';
  const spy = () => {
    let id = headings[0]?.id || '';
    for (const h of headings) if (h.getBoundingClientRect().top < innerHeight * 0.3) id = h.id;
    if (id === current) return;
    links.get(current)?.removeAttribute('data-active');
    links.get(id)?.setAttribute('data-active', '');
    current = id;
  };
  addEventListener('scroll', spy, { passive: true });
  spy();
}

/* Code blocks: language label + copy button */
article?.querySelectorAll('pre > code').forEach((code) => {
  const pre = code.parentElement!;
  const lang = [...code.classList].find((c) => c.startsWith('language-'))?.slice(9) || 'text';
  const bar = document.createElement('div');
  bar.className = 'code-bar';
  const label = document.createElement('span');
  label.textContent = lang;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'code-copy';
  btn.textContent = 'Copy';
  btn.setAttribute('aria-label', `Copy ${lang} code`);
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent || '');
      btn.textContent = 'Copied';
      btn.setAttribute('data-copied', '');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.removeAttribute('data-copied');
      }, 1600);
    } catch {
      btn.textContent = 'Press ⌘C';
    }
  });
  bar.append(label, btn);
  pre.prepend(bar);
});

/* Image lightbox */
const box = document.querySelector<HTMLDialogElement>('[data-lightbox]');
const boxImg = box?.querySelector('img');
article?.addEventListener('click', (e) => {
  const img = (e.target as HTMLElement).closest('img');
  if (!img || !box || !boxImg || img.closest('a')) return;
  boxImg.src = img.currentSrc || img.src;
  boxImg.alt = img.alt;
  box.showModal();
});
box?.addEventListener('click', () => box.close());
