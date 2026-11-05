/**
 * Renders public/galaxy-poster.webp (no-WebGL fallback + first paint) and public/og.jpg
 * from the real galaxy engine. Run against a running server:
 *
 *   npm run dev            # in another terminal
 *   node scripts/render-poster.cjs http://localhost:4321
 *
 * Needs Playwright (with Chromium) and ImageMagick (`magick` or `convert`).
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const base = process.argv[2] || 'http://localhost:4321';
const out = path.join(__dirname, '..', 'public');
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'poster-'));
const magick = (() => {
  for (const bin of ['magick', 'convert']) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' });
      return bin;
    } catch {}
  }
  throw new Error('ImageMagick not found');
})();

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  // An init script survives the dev server's reloads; addStyleTag would not.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = 'main > section, header, footer, nav, dialog, .fixed.bottom-5, [data-poster] { display: none !important; } canvas { transition: none !important; }';
      document.head.append(s);
    });
  });
  await page.goto(`${base}/?poster`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__posterReady, null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const png = path.join(tmp, 'poster.png');
  await page.screenshot({ path: png });
  execFileSync(magick, [png, '-quality', '78', path.join(out, 'galaxy-poster.webp')]);

  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const img = fs.readFileSync(png).toString('base64');
  await og.setContent(`<!doctype html><html><head><style>
    body{margin:0;width:1200px;height:630px;background:#020309 url(data:image/png;base64,${img}) 62% 50%/cover;font-family:system-ui,sans-serif;color:#edeff5;display:flex;align-items:flex-end}
    .t{padding:64px;background:linear-gradient(90deg,rgba(2,3,9,.85),rgba(2,3,9,0));width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;gap:14px}
    h1{margin:0;font-size:76px;letter-spacing:-.05em;font-weight:600;line-height:1}
    p{margin:0;font-size:28px;color:#a3aabd;max-width:640px}
    span{font:500 20px ui-monospace,monospace;color:#ffc98b;letter-spacing:.08em;text-transform:uppercase}
  </style></head><body><div class="t"><span>nhan-laptop.github.io</span><h1>Nhan's Security Log</h1><p>Cryptography, CTF writeups and malware internals.</p></div></body></html>`);
  const ogPng = path.join(tmp, 'og.png');
  await og.screenshot({ path: ogPng });
  execFileSync(magick, [ogPng, '-quality', '86', path.join(out, 'og.jpg')]);
  await browser.close();
  console.log('Wrote public/galaxy-poster.webp and public/og.jpg');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
