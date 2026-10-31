// "Delusional contractor" follow-card trend: a self-aware caption over the hero shot
// with a small Instagram watermark, then the video dims to a big animated Instagram
// logo and the handle.  Usage: node construction-content/edits/follow-card.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'raw-footage', 'B700A7F7.mov');
const TMP = path.join(__dirname, '.tmp', 'follow-card');
const OUT = path.join(ROOT, 'finished', 'follow-card.mp4');
const W = 1080, H = 1920, FPS = 30;
const HANDLE = '@ITS_MAYOS_CONSTRUCTION';
const CAPTION = 'Just a delusional contractor that thinks people will follow him because he can carry insulation…';
const CLIP = { from: 0.0, to: 6.1 };
const CARD = 4.0; // seconds of end card
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@600&family=Inter:wght@500&display=swap">';
const igIcon = (stroke, size) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}">
<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".3" stop-color="#FA7E1E"/>
<stop offset=".55" stop-color="#D62976"/><stop offset=".8" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs>
<g fill="none" stroke="${stroke}" stroke-width="9"><rect x="8" y="8" width="84" height="84" rx="24"/><circle cx="50" cy="50" r="20"/></g>
<circle cx="74" cy="26" r="6" fill="${stroke}"/></svg>`;
const page = (body) => `<!doctype html><html><head>${FONTS}</head><body style="margin:0;width:${W}px;height:${H}px;background:transparent">${body}</body></html>`;

const pngs = {
  // Caption with the small watermark tucked at its right end, like the trend.
  caption: page(`<div style="position:absolute;top:470px;left:150px;right:190px;text-align:center;color:#fff;
    font:500 50px/1.3 Inter,sans-serif;text-shadow:0 2px 6px rgba(0,0,0,.75),0 0 18px rgba(0,0,0,.45)">${CAPTION}</div>
    <div style="position:absolute;top:476px;right:36px;text-align:center;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))">${igIcon('#fff', 46)}
    <div style="font:600 15px Oswald,sans-serif;color:#fff;letter-spacing:.04em;margin-top:2px">${HANDLE}</div></div>`),
  cardColor: page(`<div style="position:absolute;top:780px;left:0;right:0;text-align:center">${igIcon('url(#g)', 150)}
    <div style="font:600 34px Oswald,sans-serif;color:#fff;letter-spacing:.04em;margin-top:30px">${HANDLE}</div></div>`),
  cardWhite: page(`<div style="position:absolute;top:780px;left:0;right:0;text-align:center">${igIcon('#fff', 150)}
    <div style="font:600 34px Oswald,sans-serif;color:#fff;letter-spacing:.04em;margin-top:30px">${HANDLE}</div></div>`),
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

  const clipLen = CLIP.to - CLIP.from, total = clipLen + CARD;
  const t0 = clipLen; // end card starts
  // Footage freezes on its last frame under the card; it dims in over 0.35s. The
  // logo is in Instagram colors, then flips to white, then back, like the trend.
  const g =
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},` +
    `tpad=stop_mode=clone:stop_duration=${CARD},format=yuv420p,` +
    `eq=brightness='-0.42*min(1,max(0,(t-${t0})/0.35))':eval=frame[v0];` +
    `[v0][1:v]overlay=0:0:enable='lt(t,${t0})'[v1];` +
    `[v1][2:v]overlay=0:0:enable='between(t,${t0},${t0 + 1.3})+between(t,${t0 + 2.6},${total})'[v2];` +
    `[v2][3:v]overlay=0:0:enable='between(t,${t0 + 1.3},${t0 + 2.6})',format=yuv420p[v];` +
    `[0:a]volume=0.5,apad,afade=t=out:st=${t0 + 0.5}:d=1[a]`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  ff(['-ss', String(CLIP.from), '-to', String(CLIP.to), '-i', SRC,
    '-loop', '1', '-i', path.join(TMP, 'caption.png'),
    '-loop', '1', '-i', path.join(TMP, 'cardColor.png'),
    '-loop', '1', '-i', path.join(TMP, 'cardWhite.png'),
    '-filter_complex', g, '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', OUT]);
  console.log(`${OUT} (${total.toFixed(1)}s)`);
})();
