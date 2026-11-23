/* Site-wide progressive enhancement: header state, mobile menu, ⌘K search, reveals. */
import { initCommandPalette } from './command-palette';

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

/* Global Star Atlas Command Palette */
initCommandPalette();
