// "What our camera roll looks like" reel: moody opener with a serif caption, then
// bursts of photo cards popping onto a changing background, then the logo on black.
// Usage: node construction-content/edits/camera-roll.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'raw-footage');
const TMP = path.join(__dirname, '.tmp', 'camera-roll');
const OUT = path.join(ROOT, 'finished', 'camera-roll.mp4');
const LOGO = path.resolve(ROOT, '../public/logo.png');
const W = 1080, H = 1920, FPS = 30, END = 1.3;

const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const FRAME = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},format=yuv420p`;
// Warm, faded, darker film look like the reference.
const GRADE = 'eq=brightness=-0.09:contrast=1.12:saturation=0.85,colorbalance=rs=0.14:gs=0.04:bs=-0.14:rm=0.12:gm=0.03:bm=-0.12:rh=0.06:bh=-0.08,curves=all=0/0.03 0.5/0.40 1/0.86,vignette=PI/4';

const opener = { file: 'B700A7F7.mov', from: 0.6, to: 4.6 };
const captions = [
  { from: 0, to: 2.9, text: 'So you do repairs, right?' },
  { from: 2.9, to: 4.0, text: 'and so much more...' },
];
// Each burst: a background clip, with cards popping on every ~0.3s.
const bursts = [
  { bg: { file: 'IMG_2148.mov', from: 1.0, to: 2.8 }, cards: [
    ['IMG_4458.mov', 1.0, 'p'], ['IMG_2235.mov', 2.0, 's'], ['286CBA62-05B5-407D-BB65-7426E54C714D.mov', 0.3, 'l'],
    ['IMG_4464.mov', 6.5, 'p'], ['IMG_2340.mov', 2.0, 's']] },
  { bg: { file: 'IMG_4467.mov', from: 3.6, to: 5.3 }, cards: [
    ['IMG_2240.mov', 1.0, 's'], ['IMG_4462.mov', 3.5, 'l'], ['286CBA62-05B5-407D-BB65-7426E54C714D.mov', 4.0, 'p'],
    ['IMG_4464.mov', 11.0, 's'], ['IMG_2241.mov', 6.0, 'p']] },
  { bg: { file: 'IMG_2241.mov', from: 0.3, to: 2.1 }, cards: [
    ['IMG_4467.mov', 8.0, 's'], ['IMG_4466.mov', 1.0, 'l'], ['IMG_4458.mov', 3.5, 'p'],
    ['IMG_2239.mov', 3.0, 's'], ['IMG_4464.mov', 3.0, 'l']] },
];
// Card shapes (width x height) and spots, roughly where the reference places them.
const SHAPES = { p: [520, 650], s: [560, 560], l: [640, 480] };
const SPOTS = [[300, 560], [760, 760], [420, 1080], [700, 1300], [520, 860]];

async function png(page, html, file) {
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: true });
}

const captionHtml = (t) => `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap">
<style>html,body{margin:0;width:${W}px;height:${H}px;background:transparent}
.c{position:absolute;top:640px;left:250px;right:250px;text-align:center;color:#fff;
font:400 104px/1.0 'Instrument Serif',serif;text-wrap:balance;text-shadow:0 2px 14px rgba(0,0,0,.45)}</style>
</head><body><div class="c">${t}</div></body></html>`;

const endHtml = () => `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&display=swap">
<style>html,body{margin:0;width:${W}px;height:${H}px;background:#000;color:#fff}
.w{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:120px}
img{width:420px;height:420px}
.n{font:800 92px/1 'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.06em;margin-top:34px}
.s{font:700 34px/1 'Barlow Condensed',sans-serif;letter-spacing:.32em;text-transform:uppercase;margin-top:18px;color:#d8c9a8}</style>
</head><body><div class="w"><img src="data:image/png;base64,${fs.readFileSync(LOGO).toString('base64')}">
<div class="n">Mayo's Construction</div><div class="s">Father &amp; son · Hot Springs, AR</div></div></body></html>`;

const seg = (c, file) => ff(['-ss', String(c.from), '-to', String(c.to), '-i', path.join(RAW, c.file), '-an', '-vf', FRAME,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', file]);

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const capFiles = [];
  for (const [i, c] of captions.entries()) {
    const f = path.join(TMP, `cap${i}.png`); await png(page, captionHtml(c.text), f); capFiles.push(f);
  }
  const endPng = path.join(TMP, 'end.png');
  await png(page, endHtml(), endPng);
  await browser.close();

  // Background: opener, then one clip per burst.
  const segs = [opener, ...bursts.map((b) => b.bg)].map((c, i) => {
    const f = path.join(TMP, `bg${i}.mp4`); seg(c, f); return f;
  });
  fs.writeFileSync(path.join(TMP, 'bg.txt'), segs.map((s) => `file '${s}'`).join('\n'));
  const bg = path.join(TMP, 'bg.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'bg.txt'), '-c', 'copy', bg]);

  // Cards: still frames cropped to a shape, timed to pop on and clear at the next cut.
  const cards = [];
  let t = opener.to - opener.from;
  bursts.forEach((b, bi) => {
    const len = b.bg.to - b.bg.from;
    b.cards.forEach(([file, at, shape], ci) => {
      const [cw, ch] = SHAPES[shape];
      const f = path.join(TMP, `card${bi}_${ci}.png`);
      ff(['-ss', String(at), '-i', path.join(RAW, file), '-frames:v', '1',
        '-vf', `scale=${cw}:${ch}:force_original_aspect_ratio=increase,crop=${cw}:${ch}`, f]);
      const [cx, cy] = SPOTS[(ci + bi * 2) % SPOTS.length];
      cards.push({ f, x: Math.round(cx - cw / 2), y: Math.round(cy - ch / 2), from: t + 0.12 + ci * 0.3, to: t + len });
    });
    t += len;
  });
  const bodyLen = t;

  const inputs = ['-i', bg, ...cards.flatMap((c) => ['-i', c.f]), ...capFiles.flatMap((f) => ['-loop', '1', '-i', f]),
    '-loop', '1', '-t', String(END), '-i', endPng, '-f', 'lavfi', '-t', String(bodyLen + END), '-i', 'anullsrc=r=48000:cl=stereo'];
  let g = '[0:v]null[v0];';
  cards.forEach((c, i) => {
    g += `[v${i}][${i + 1}:v]overlay=${c.x}:${c.y}:enable='between(t,${c.from.toFixed(2)},${c.to.toFixed(2)})'[v${i + 1}];`;
  });
  let last = `v${cards.length}`;
  g += `[${last}]${GRADE}[g0];`;
  const capBase = cards.length + 1;
  captions.forEach((c, i) => {
    g += `[g${i}][${capBase + i}:v]overlay=0:0:shortest=1:enable='between(t,${c.from},${c.to})'[g${i + 1}];`;
  });
  const endIdx = capBase + captions.length;
  g += `[g${captions.length}]trim=duration=${bodyLen.toFixed(3)},setpts=PTS-STARTPTS,format=yuv420p[body];` +
       `[${endIdx}:v]fps=${FPS},format=yuv420p,setsar=1[end];[body][end]concat=n=2:v=1:a=0[v]`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  ff([...inputs, '-filter_complex', g, '-map', '[v]', '-map', `${endIdx + 1}:a`, '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', OUT]);
  console.log(`${OUT} (${(bodyLen + END).toFixed(1)}s)`);
})();
