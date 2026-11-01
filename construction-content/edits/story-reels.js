// Three story-style reels in the "A Life I Showed Up For" look: one short white line
// per shot, centered, natural color. Usage: node construction-content/edits/story-reels.js [name ...]
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'raw-footage');
const W = 1080, H = 1920, FPS = 30;
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const FRAME = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
const GRADE = 'eq=contrast=1.03:saturation=1.05,colorbalance=rs=0.02:bs=-0.02';

// Each shot: file, in/out (s), optional speed, the line shown over it, and
// low: true to put the line in the lower third when the subject is up top.
const REELS = {
  'somebodys-home': [
    { file: 'IMG_2148.mov', from: 1.0, to: 3.2, text: 'Every job we pull up to' },
    { file: 'IMG_2548.mov', from: 0.2, to: 2.4, text: 'is somebody’s home.' },
    { file: 'IMG_4464.mov', from: 6.5, to: 8.8, text: 'Somebody’s first deck.' },
    { file: 'IMG_4467.mov', from: 4.0, to: 6.3, text: 'Somebody’s Saturday mornings.' },
    { file: '286CBA62-05B5-407D-BB65-7426E54C714D.mov', from: 0.2, to: 1.5, speed: 0.65, text: 'Where their kids will learn to walk.' },
    { file: 'IMG_4462.mov', from: 0.6, to: 3.2, text: 'So we build it like it’s ours.' },
  ],
  'never-a-quick-fix': [
    { file: 'IMG_2241.mov', from: 0.3, to: 2.3, text: 'Things that are never a quick fix:' },
    { file: 'IMG_2239.mov', from: 0.5, to: 2.6, text: 'a vent cover' },
    { file: 'IMG_2624.mov', from: 0.5, to: 2.7, text: 'an unlabeled breaker panel' },
    { file: 'IMG_4458.mov', from: 0.3, to: 2.2, text: '“just one more board”' },
    { file: 'IMG_2454.mov', from: 0.0, to: 1.5, speed: 0.55, text: 'anything Dad says will “take 5 minutes”' },
  ],
  'father-and-son': [
    { file: 'B700A7F7.mov', from: 1.2, to: 2.7, text: 'Father & son. Hot Springs, Arkansas.' },
    { file: 'IMG_2148.mov', from: 2.0, to: 3.9, text: 'Building a business' },
    { file: 'IMG_4467.mov', from: 4.0, to: 5.9, text: 'one job at a time.' },
    { file: 'IMG_2239.mov', from: 0.5, to: 2.6, text: 'Plus a lot of 5-minute fixes that take all day.' },
    { file: 'B700A7F7.mov', from: 2.8, to: 5.4, text: 'Follow along. We’re just getting started.', low: true },
  ],
};

const caption = (text, low) => `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500&display=swap"></head>
<body style="margin:0;width:${W}px;height:${H}px;background:transparent">
<div style="position:absolute;${low ? 'top:1240px' : 'top:330px'};left:110px;right:110px;text-align:center;color:#fff;
font:500 50px/1.3 Montserrat,sans-serif;text-wrap:balance;text-shadow:0 2px 6px rgba(0,0,0,.6),0 0 16px rgba(0,0,0,.35)">${text}</div></body></html>`;

async function build(name, shots, page) {
  const tmp = path.join(__dirname, '.tmp', 'story', name);
  fs.mkdirSync(tmp, { recursive: true });
  const parts = [];
  for (const [i, s] of shots.entries()) {
    const png = path.join(tmp, `cap${i}.png`);
    await page.setContent(caption(s.text, s.low), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: png, omitBackground: true });
    const sp = s.speed || 1;
    const tempo = sp < 0.5 ? `atempo=0.5,atempo=${(sp / 0.5).toFixed(3)}` : `atempo=${sp}`;
    const f = path.join(tmp, `part${i}.mp4`);
    ff(['-ss', String(s.from), '-to', String(s.to), '-i', path.join(RAW, s.file), '-loop', '1', '-i', png,
      '-filter_complex', `[0:v]setpts=(PTS-STARTPTS)/${sp},${FRAME},fps=${FPS},${GRADE},format=yuv420p[b];` +
        `[b][1:v]overlay=0:0:shortest=1,format=yuv420p[v];[0:a]${tempo},aresample=48000,aformat=channel_layouts=stereo,volume=0.35[a]`,
      '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-c:a', 'aac', '-b:a', '192k', f]);
    parts.push(f);
  }
  fs.writeFileSync(path.join(tmp, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
  const out = path.join(ROOT, 'finished', `${name}.mp4`);
  ff(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
  const len = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  console.log(`${out} (${parseFloat(len).toFixed(1)}s)`);
}

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(REELS);
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: W, height: H } });
  for (const n of names) await build(n, REELS[n], page);
  await b.close();
})();
