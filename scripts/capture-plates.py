#!/usr/bin/env python3
"""Photographs each world from the homepage sky for the archive-page heads.

Serve the repo root on port 8000, then run: python3 scripts/capture-plates.py
Needs Playwright and a local Chromium. Writes assets/plates/*.webp.
"""
import io
import pathlib

from PIL import Image
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'plates'
HIDE = '#sky-root h1,#sky-root h2,#sky-root p,#sky-root a,.chapter-scrim,.hero-scrim,.site-header,.sky-rail,.cosmic-motion-button,.tabbar{visibility:hidden!important}'
# name, section selector, crop side, crop centre (x, y) at 1920x1080. Centres follow each scene's lens shift.
PLATES = [
    ('learning', '#topics', 860, 1340, 550),
    ('writeup', '#chapter-writeup', 1000, 1300, 530),
    ('project', '#chapter-project', 820, 1360, 530),
    ('life', '#chapter-life', 900, 1380, 560),
    ('galaxy', '[data-scene]:last-of-type', 840, 960, 421),
]
SETTLE = "s => { const all = [...document.querySelectorAll('[data-scene]')]; const e = s.includes('last') ? all.at(-1) : document.querySelector(s); const r = e.getBoundingClientRect(); scrollTo({ top: r.top + scrollY + (r.height - innerHeight) / 2, behavior: 'instant' }); }"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'])
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    page.goto('http://127.0.0.1:8000/index.html', wait_until='load')
    page.wait_for_timeout(6000)  # Past the opening comet, so no wake is on screen.
    page.add_style_tag(content=HIDE)
    OUT.mkdir(exist_ok=True)
    for name, selector, side, x, y in PLATES:
        page.evaluate(SETTLE, selector)
        page.wait_for_timeout(3500)
        shot = Image.open(io.BytesIO(page.screenshot())).convert('RGB')
        top = max(y - side // 2, 0)
        plate = shot.crop((x - side // 2, top, x + side // 2, top + side)).resize((640, 640), Image.LANCZOS)
        plate.save(OUT / f'{name}.webp', quality=78, method=6)
        print(name, (OUT / f'{name}.webp').stat().st_size)
    browser.close()
