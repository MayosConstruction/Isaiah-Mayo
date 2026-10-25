// Builds vertical reels from raw footage: trims clips, crops to 1080x1920,
// adds a top caption and the Mayo's end card.
// Usage: node construction-content/edits/build.js [reel-name ...]
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'raw-footage');
const OUT = path.join(ROOT, 'finished');
const TMP = path.join(__dirname, '.tmp');
const LOGO = path.resolve(ROOT, '../public/logo.png');
const W = 1080, H = 1920, FPS = 30, END_SECONDS = 2.5;

const reels = require('./reels.json');

const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

async function renderPng(page, html, file) {
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: true });
}

const captionHtml = (text, top = 300) => `<!doctype html><html><head><style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; background: transparent; }
  .cap { position: absolute; top: ${top}px; left: 90px; right: 90px; text-align: center;
    font: 700 58px/1.22 Inter, sans-serif; color: #fff; letter-spacing: -0.01em; text-wrap: balance;
    text-shadow: 0 2px 6px rgba(0,0,0,.75), 0 0 18px rgba(0,0,0,.45); }
  .cap div + div { margin-top: 14px; }
</style></head><body><div class="cap">${[].concat(text).map((l) => `<div>${l}</div>`).join('')}</div></body></html>`;

const endCardHtml = () => `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@600&display=swap">
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; background: #faf3e2; color: #151515; }
  .wrap { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 180px; }
  img { width: 520px; height: 520px; }
  .name { font: 800 104px/1 'Barlow Condensed', sans-serif; text-transform: uppercase; margin-top: 30px; }
  .where { font: 700 40px/1 'Barlow Condensed', sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #a42f28; margin-top: 18px; }
  .band { margin-top: 70px; background: #a42f28; color: #fff; border-top: 14px solid #151515; width: 100%; text-align: center; padding: 34px 0 40px; }
  .free { font: 800 52px/1 'Barlow Condensed', sans-serif; letter-spacing: .06em; }
  .phone { font: 800 130px/1 'Barlow Condensed', sans-serif; letter-spacing: .02em; margin-top: 10px; }
  .text { font: 600 38px/1 Barlow, sans-serif; margin-top: 34px; }
</style></head><body><div class="wrap">
  <img src="data:image/png;base64,${fs.readFileSync(LOGO).toString('base64')}">
  <div class="name">Mayo's Construction</div>
  <div class="where">Father &amp; son · Hot Springs, AR</div>
  <div class="band"><div class="free">CALL OR TEXT FOR A FREE ESTIMATE</div><div class="phone">870-617-3507</div></div>
</div></body></html>`;

// Scale to cover 1080x1920 and center-crop. ffmpeg auto-rotates iPhone footage.
const FRAME = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},format=yuv420p`;

async function build(name, reel, page) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });

  // "bw": true turns a clip black and white, for the punchline switch.
  const parts = reel.clips.map((c, i) => {
    const file = path.join(dir, `part${i}.mp4`);
    ff(['-ss', String(c.from), '-to', String(c.to), '-i', path.join(RAW, c.file),
      '-vf', FRAME + (c.bw ? ',hue=s=0,eq=contrast=1.08' : ''), '-af', 'aresample=48000,aformat=channel_layouts=stereo',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', file]);
    return file;
  });

  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const body = path.join(dir, 'body.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', body]);
  const bodyLen = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', body]).toString());

  // Captions: either one "caption" for the whole reel, or timed "captions"
  // ({ from, to, text, top }) so punchline lines can pop in one at a time.
  const captions = reel.captions || [{ from: 0, to: bodyLen, text: reel.caption }];
  const capFiles = [];
  for (const [i, c] of captions.entries()) {
    const file = path.join(dir, `caption${i}.png`);
    await renderPng(page, captionHtml(c.text, c.top), file);
    capFiles.push(file);
  }
  let chain = `[0:v]null[c0];`;
  captions.forEach((c, i) => {
    chain += `[c${i}][${i + 1}:v]overlay=0:0:shortest=1:enable='between(t,${c.from},${c.to ?? bodyLen})'[c${i + 1}];`;
  });
  const last = `[c${captions.length}]`;
  const capInputs = capFiles.flatMap((f) => ['-loop', '1', '-i', f]);
  const out = path.join(OUT, `${name}.mp4`);
  const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out];
  // Job-site audio is kept quiet so a trending sound can go on top in Instagram/TikTok.
  const vol = reel.volume ?? 0.5;

  if (reel.endCard === false) {
    ff(['-i', body, ...capInputs, '-filter_complex', `${chain}${last}format=yuv420p[v];[0:a]volume=${vol}[a]`,
      '-map', '[v]', '-map', '[a]', '-t', bodyLen.toFixed(3), ...enc]);
    console.log(`${out} (${bodyLen.toFixed(1)}s)`);
    return;
  }

  // Quick fade into the Mayo's end card.
  const end = path.join(TMP, 'endcard.png');
  if (!fs.existsSync(end)) await renderPng(page, endCardHtml(), end);
  const n = capFiles.length + 1;
  ff(['-i', body, ...capInputs, '-loop', '1', '-t', String(END_SECONDS + 0.5), '-i', end,
    '-filter_complex',
    `${chain}${last}format=yuv420p,settb=1/${FPS}[main];` +
    `[${n}:v]scale=${W}:${H},fps=${FPS},setsar=1,format=yuv420p,settb=1/${FPS}[card];` +
    `[main][card]xfade=transition=fade:duration=0.4:offset=${(bodyLen - 0.4).toFixed(3)}[v];` +
    `[0:a]volume=${vol},apad,afade=t=out:st=${(bodyLen - 0.4).toFixed(3)}:d=0.4[a]`,
    '-map', '[v]', '-map', '[a]', '-t', (bodyLen + END_SECONDS).toFixed(3), ...enc]);
  console.log(`${out} (${(bodyLen + END_SECONDS).toFixed(1)}s)`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(reels);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (const n of names) await build(n, reels[n], page);
  await browser.close();
})();
