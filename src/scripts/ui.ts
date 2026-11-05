/* Site-wide progressive enhancement: header state, mobile menu, ⌘K search, reveals. */

const header = document.querySelector<HTMLElement>('[data-header]');
const onScroll = () => header?.toggleAttribute('data-scrolled', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* Mobile menu */
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.getElementById('mobile-menu');
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  if (menu) menu.hidden = !open;
  header?.toggleAttribute('data-scrolled', open || scrollY > 24);
});

/* Reveal on scroll */
const reveal = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        reveal.unobserve(e.target);
      }
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
);
document.querySelectorAll('[data-reveal], .split-word').forEach((el) => reveal.observe(el));

/* Command palette */
const dialog = document.querySelector<HTMLDialogElement>('[data-cmdk]');
const input = document.querySelector<HTMLInputElement>('[data-cmdk-input]');
const list = document.querySelector<HTMLUListElement>('[data-cmdk-list]');
const empty = document.querySelector<HTMLElement>('[data-cmdk-empty]');
const dataEl = document.querySelector('[data-cmdk-data]');

type Item = { t: string; h: string; c: string; d: string; g: string };
let items: Item[] = [];
let colors: Record<string, string> = {};
try {
  const data = JSON.parse(dataEl?.textContent || '{}');
  items = data.posts || [];
  colors = data.colors || {};
} catch {
  /* no data, no palette */
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
let selected = 0;

function render() {
  if (!list || !input) return;
  const q = fold(input.value.trim());
  const terms = q.split(/\s+/).filter(Boolean);
  const results = items
    .filter((p) => {
      const hay = fold(`${p.t} ${p.c} ${p.g}`);
      return terms.every((t) => hay.includes(t));
    })
    .slice(0, 40);
  selected = Math.min(selected, Math.max(0, results.length - 1));
  list.replaceChildren(
    ...results.map((p, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === selected));
      const a = document.createElement('a');
      a.href = p.h;
      a.className =
        'flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors hover:bg-white/[0.05] ' + (i === selected ? 'bg-white/[0.07]' : '');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.color = colors[p.c] || '#fff';
      const title = document.createElement('span');
      title.className = 'min-w-0 flex-1 truncate';
      title.textContent = p.t;
      const meta = document.createElement('span');
      meta.className = 'hidden font-mono text-[11px] uppercase text-dim sm:inline';
      meta.textContent = `${p.c} · ${p.d.slice(0, 7)}`;
      a.append(dot, title, meta);
      li.append(a);
      return li;
    }),
  );
  if (empty) empty.hidden = results.length > 0;
}

function open() {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  input!.value = '';
  selected = 0;
  render();
  input!.focus();
}

document.querySelectorAll('[data-cmdk-open]').forEach((b) => b.addEventListener('click', open));
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    dialog?.open ? dialog.close() : open();
  } else if (e.key === '/' && !dialog?.open && !(e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) {
    e.preventDefault();
    open();
  }
});
input?.addEventListener('input', () => {
  selected = 0;
  render();
});
input?.addEventListener('keydown', (e) => {
  const count = list?.children.length || 0;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + count) % Math.max(count, 1);
    render();
    list?.children[selected]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const a = list?.children[selected]?.querySelector('a');
    if (a) location.href = a.href;
  }
});
dialog?.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});
