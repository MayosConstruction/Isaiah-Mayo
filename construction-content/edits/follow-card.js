// "Delusional contractor" trend: one self-aware caption over the hero shot. No
// handle or logo; Instagram adds its own watermark when a reel is saved or shared.  Usage: node construction-content/edits/follow-card.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'raw-footage', 'B700A7F7.mov');
const TMP = path.join(__dirname, '.tmp', 'follow-card');
const OUT = path.join(ROOT, 'finished', 'follow-card.mp4');
const W = 1080, H = 1920, FPS = 30;
const CAPTION = 'Just a delusional contractor that thinks people will follow him because he can carry insulation…';
const CLIP = { from: 0.0, to: 6.1 };
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@600&family=Inter:wght@500&display=swap">';
const page = (body) => `<!doctype html><html><head>${FONTS}</head><body style="margin:0;width:${W}px;height:${H}px;background:transparent">${body}</body></html>`;

const pngs = {
  caption: page(`<div style="position:absolute;top:470px;left:130px;right:130px;text-align:center;color:#fff;
    font:500 50px/1.3 Inter,sans-serif;text-shadow:0 2px 6px rgba(0,0,0,.75),0 0 18px rgba(0,0,0,.45)">${CAPTION}</div>`),
};

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  for (const [name, html] of Object.entries(pngs)) {
    await p.setContent(html, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(TMP, `${name}.png`), omitBackground: true });
  }
  await b.close();

  const len = CLIP.to - CLIP.from;
  const g = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},format=yuv420p[v0];` +
            `[v0][1:v]overlay=0:0:shortest=1,format=yuv420p[v];[0:a]volume=0.5[a]`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  ff(['-ss', String(CLIP.from), '-to', String(CLIP.to), '-i', SRC, '-loop', '1', '-i', path.join(TMP, 'caption.png'),
    '-filter_complex', g, '-map', '[v]', '-map', '[a]', '-t', len.toFixed(2),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', OUT]);
  console.log(`${OUT} (${len.toFixed(1)}s)`);
})();
