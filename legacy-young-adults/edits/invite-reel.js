// Legacy Young Adults invite reel: hook over arrivals, fast cuts of kickball night
// with a slow-motion kick, then a "come hang with us" end card.
// Usage: node legacy-young-adults/edits/invite-reel.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'raw-footage');
const TMP = path.join(ROOT, '.tmp', 'invite-reel');
const OUT = path.join(ROOT, 'finished', 'invite-reel.mp4');
const W = 1080, H = 1920, FPS = 30, END = 2.4;

const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const FRAME = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
// Warm, punchy sunset look.
const GRADE = 'eq=contrast=1.08:saturation=1.15:brightness=0.01,colorbalance=rs=0.04:bs=-0.04:rh=0.03:bh=-0.03,vignette=PI/5';

// speed < 1 is slow motion; punch zooms in over the clip.
const shots = [
  { file: 'IMG_2244.mov', from: 0.3, to: 2.0 },
  { file: 'IMG_4197.mov', from: 0.0, to: 1.6 },
  { file: 'IMG_4198.mov', from: 0.3, to: 2.5 },
  { file: 'IMG_4198.mov', from: 2.5, to: 3.2, speed: 0.4, punch: 0.18 },
  { file: 'IMG_4198.mov', from: 3.2, to: 4.7, speed: 1.5 },
  { file: 'IMG_4197.mov', from: 5.8, to: 8.3 },
];
// Captions on the output timeline (seconds).
const captions = [
  { from: 0, to: 1.7, lines: ['Your new favorite', 'night of the week'] },
  { from: 1.7, to: 5.5, lines: ['Kickball night'] },
  { from: 8.25, to: 10.75, lines: ['Good people.', 'Good times.'] },
];

async function png(page, html, file) {
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: true });
}
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@600&display=swap">';
const captionHtml = (lines) => `<!doctype html><html><head>${FONTS}<style>
html,body{margin:0;width:${W}px;height:${H}px;background:transparent}
.c{position:absolute;top:560px;left:80px;right:80px;text-align:center;color:#fff;text-transform:uppercase;
font:400 118px/1.0 Anton,sans-serif;letter-spacing:.01em;text-shadow:0 4px 24px rgba(0,0,0,.55),0 2px 4px rgba(0,0,0,.4)}
</style></head><body><div class="c">${lines.join('<br>')}</div></body></html>`;
const endHtml = () => `<!doctype html><html><head>${FONTS}<style>
html,body{margin:0;width:${W}px;height:${H}px;background:#0d0d0d;color:#fff}
.w{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:140px;text-align:center}
.k{font:600 40px Inter,sans-serif;letter-spacing:.34em;text-transform:uppercase;color:#f2b33d;margin-bottom:36px}
.l{font:400 250px/0.9 Anton,sans-serif;letter-spacing:.04em;text-transform:uppercase}
.y{font:600 46px Inter,sans-serif;letter-spacing:.62em;text-transform:uppercase;margin-top:30px;padding-left:.62em}
.r{width:120px;height:6px;background:#f2b33d;margin:56px auto 0}
</style></head><body><div class="w"><div class="k">Come hang with us</div><div class="l">Legacy</div>
<div class="y">Young Adults</div><div class="r"></div></div></body></html>`;

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const capFiles = [];
  for (const [i, c] of captions.entries()) {
    const f = path.join(TMP, `cap${i}.png`); await png(page, captionHtml(c.lines), f); capFiles.push(f);
  }
  const endPng = path.join(TMP, 'end.png');
  await png(page, endHtml(), endPng);
  await browser.close();

  // Each shot: trim, retime (video and audio), optional punch-in zoom, to 1080x1920.
  const parts = shots.map((s, i) => {
    const sp = s.speed || 1, len = (s.to - s.from) / sp;
    let v = `setpts=(PTS-STARTPTS)/${sp},${FRAME}`;
    if (s.punch) {
      const z = `(1+${s.punch}*min(1,t/${len.toFixed(2)}))`;
      v += `,scale=w='trunc(${W}*${z}/2)*2':h='trunc(${H}*${z}/2)*2':eval=frame,crop=${W}:${H}`;
    }
    v += `,fps=${FPS},format=yuv420p`;
    const tempo = sp < 0.5 ? `atempo=0.5,atempo=${(sp / 0.5).toFixed(3)}` : `atempo=${sp}`;
    const f = path.join(TMP, `part${i}.mp4`);
    ff(['-ss', String(s.from), '-to', String(s.to), '-i', path.join(RAW, s.file), '-vf', v,
      '-af', `${tempo},aresample=48000,aformat=channel_layouts=stereo`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-c:a', 'aac', '-b:a', '192k', f]);
    return f;
  });
  fs.writeFileSync(path.join(TMP, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
  const body = path.join(TMP, 'body.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'list.txt'), '-c', 'copy', body]);
  const bodyLen = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', body]).toString());

  // Grade, captions, then a quick fade into the end card. Field audio stays low
  // so a song can go on top in Instagram/TikTok.
  const inputs = ['-i', body, ...capFiles.flatMap((f) => ['-loop', '1', '-i', f]), '-loop', '1', '-t', String(END + 0.5), '-i', endPng];
  let g = `[0:v]${GRADE}[c0];`;
  captions.forEach((c, i) => {
    g += `[c${i}][${i + 1}:v]overlay=0:0:shortest=1:enable='between(t,${c.from},${c.to})'[c${i + 1}];`;
  });
  const e = captions.length + 1;
  g += `[c${captions.length}]format=yuv420p,settb=1/${FPS}[main];[${e}:v]fps=${FPS},format=yuv420p,setsar=1,settb=1/${FPS}[end];` +
       `[main][end]xfade=transition=fade:duration=0.3:offset=${(bodyLen - 0.3).toFixed(3)}[v];` +
       `[0:a]volume=0.4,apad,afade=t=out:st=${(bodyLen - 0.3).toFixed(3)}:d=0.3[a]`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  ff([...inputs, '-filter_complex', g, '-map', '[v]', '-map', '[a]', '-t', (bodyLen + END).toFixed(3),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', OUT]);
  console.log(`${OUT} (${(bodyLen + END).toFixed(1)}s)`);
})();
