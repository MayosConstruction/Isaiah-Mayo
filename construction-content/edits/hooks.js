// Fill-in-the-blank hook reels ("You seem happier." / "I tried ___ so you don't have
// to" / "I wish more people knew ___" / "The biggest lesson I learned about ___").
// Shots are cut back to back; captions are timed on the finished timeline.
// Usage: node construction-content/edits/hooks.js [name ...]
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'raw-footage');
const W = 1080, H = 1920, FPS = 30;
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const FRAME = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
const END = 99;

const REELS = {
  'you-seem-happier': {
    shots: [
      ['IMG_0068.mov', 7.0, 9.2], ['IMG_2248.mov', 6.3, 8.7], ['79AE81E5.mp4', 4.0, 6.0],
      ['IMG_0177.mov', 0.0, 1.8], ['IMG_2116.mov', 4.5, 6.5], ['IMG_8266.mov', 0.0, 2.2],
    ],
    captions: [{ from: 0, to: END, text: '“You seem happier.”<br>“Thank you, I started leaving work at work.”' }],
  },
  'tried-so-you-dont': {
    shots: [['B700A7F7.mov', 0.0, 6.1]],
    captions: [
      { from: 0, to: END, text: 'I tried carrying a whole roll of insulation by myself so you don’t have to' },
      { from: 4.4, to: END, text: '(just hire us. we’ll do it.)', low: true },
    ],
  },
  'wish-more-people-knew': {
    shots: [
      ['IMG_2241.mov', 0.3, 2.1], ['IMG_2624.mov', 0.5, 2.3], ['IMG_2235.mov', 0.5, 2.4],
      ['IMG_4467.mov', 4.0, 5.9], ['IMG_2340.mov', 1.0, 3.0],
    ],
    captions: [{ from: 0, to: END, text: 'I wish more people knew a father & son crew will take the small jobs the big companies won’t' }],
  },
  'biggest-lesson': {
    shots: [
      ['IMG_4462.mov', 0.6, 2.6], ['IMG_2148.mov', 1.0, 3.0], ['IMG_2548.mov', 0.2, 2.2],
      ['IMG_2248.mov', 4.6, 8.7], ['IMG_0068.mov', 7.0, 10.0],
    ],
    captions: [
      { from: 0, to: 6.0, text: 'The biggest lesson I learned about running a business with my dad (and why it matters)' },
      { from: 6.0, to: 10.1, text: 'You’re not just building it for you.', low: true },
      { from: 10.1, to: END, text: 'You’re building it for him.', low: true },
    ],
  },
};

const caption = (text, low) => `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=TikTok+Sans:wght@500&display=swap"></head>
<body style="margin:0;width:${W}px;height:${H}px;background:transparent">
<div style="position:absolute;top:${low ? 1240 : 430}px;left:110px;right:110px;text-align:center;color:#fff;
font:500 52px/1.28 'TikTok Sans',sans-serif;text-wrap:balance;text-shadow:0 1px 3px rgba(0,0,0,.8),0 0 10px rgba(0,0,0,.6),0 0 24px rgba(0,0,0,.4)">${text}</div></body></html>`;

async function build(name, reel, page) {
  const tmp = path.join(__dirname, '.tmp', 'hooks', name);
  fs.mkdirSync(tmp, { recursive: true });
  const parts = reel.shots.map(([file, from, to], i) => {
    const f = path.join(tmp, `part${i}.mp4`);
    ff(['-ss', String(from), '-to', String(to), '-i', path.join(RAW, file), '-vf', `${FRAME},fps=${FPS},format=yuv420p`,
      '-af', 'aresample=48000,aformat=channel_layouts=stereo', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
      '-c:a', 'aac', '-b:a', '192k', f]);
    return f;
  });
  fs.writeFileSync(path.join(tmp, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
  const body = path.join(tmp, 'body.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', body]);
  const len = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', body]).toString());

  const pngs = [];
  for (const [i, c] of reel.captions.entries()) {
    const f = path.join(tmp, `cap${i}.png`);
    await page.setContent(caption(c.text, c.low), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: f, omitBackground: true });
    pngs.push(f);
  }
  let g = '[0:v]null[c0];';
  reel.captions.forEach((c, i) => {
    g += `[c${i}][${i + 1}:v]overlay=0:0:shortest=1:enable='between(t,${c.from},${Math.min(c.to, len)})'[c${i + 1}];`;
  });
  g += `[c${reel.captions.length}]format=yuv420p[v];[0:a]volume=0.4[a]`;
  const out = path.join(ROOT, 'finished', `${name}.mp4`);
  ff(['-i', body, ...pngs.flatMap((p) => ['-loop', '1', '-i', p]), '-filter_complex', g, '-map', '[v]', '-map', '[a]',
    '-t', len.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    '-b:a', '192k', '-movflags', '+faststart', out]);
  console.log(`${out} (${len.toFixed(1)}s)`);
}

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(REELS);
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: W, height: H } });
  for (const n of names) await build(n, REELS[n], page);
  await b.close();
})();
