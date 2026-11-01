// "Hook stacking" reels: open on the payoff for a beat (visual hook), a white title
// box that frames the video for its whole length (text hook), then short captions
// that build to the punchline. Usage: node construction-content/edits/hook-stack.js [name ...]
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'raw-footage');
const W = 1080, H = 1920, FPS = 30;
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const FRAME = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;

// The first shot of each reel is the flash-forward to the best moment.
const REELS = {
  'big-slide': {
    title: 'Dad vs. 2 year old:<br>the big slide',
    shots: [
      { file: 'IMG_2248.mov', from: 7.0, to: 8.0, text: '' },
      { file: 'IMG_2248.mov', from: 0.0, to: 3.0, text: 'He said it was too scary' },
      { file: 'IMG_2248.mov', from: 3.0, to: 6.3, text: 'so I took him down myself' },
      { file: 'IMG_2248.mov', from: 6.3, to: 8.7, text: 'We’ve done it 37 times since', low: true },
    ],
  },
  'slide-rules': {
    title: 'Dad vs. 2 year old:<br>how slides work',
    shots: [
      { file: 'IMG_0068.mov', from: 18.0, to: 19.0, text: '' },
      { file: 'IMG_0068.mov', from: 5.5, to: 10.5, text: 'He loved the slide', low: true },
      { file: 'IMG_0068.mov', from: 12.5, to: 15.0, text: 'Me: buddy, the stairs are over there', low: true },
      { file: 'IMG_0068.mov', from: 15.0, to: 21.2, text: 'Him:' },
    ],
  },
  'sleeping-in': {
    title: 'Dad vs. 2 year old:<br>sleeping in on Saturday',
    shots: [
      { file: 'IMG_8266.mov', from: 6.0, to: 7.0, text: '' },
      { file: 'IMG_8266.mov', from: 0.0, to: 3.6, text: 'Me: 5 more minutes', low: true },
      { file: 'IMG_8266.mov', from: 4.4, to: 8.4, text: 'Him:', low: true },
      { file: 'IMG_8266.mov', from: 8.4, to: 10.2, text: 'He won. He always wins.', low: true },
    ],
  },
  'milk-contest': {
    title: 'Dad vs. 2 year old:<br>milk chugging contest',
    shots: [
      { file: '79AE81E5.mp4', from: 17.0, to: 18.0, text: '' },
      { file: '79AE81E5.mp4', from: 0.2, to: 3.4, text: 'He went first' },
      { file: '79AE81E5.mp4', from: 4.0, to: 6.2, text: 'and gave me this look' },
      { file: '79AE81E5.mp4', from: 16.0, to: 20.6, speed: 1.3, text: 'so obviously I had to win' },
      { file: '79AE81E5.mp4', from: 23.2, to: 29.4, text: 'I did not win', low: true },
    ],
  },
  'job-interview': {
    title: 'How to pass a job interview<br>at a construction company',
    shots: [
      { file: 'B700A7F7.mov', from: 4.4, to: 5.3, text: '' },
      { file: 'B700A7F7.mov', from: 0.0, to: 1.4, text: 'Step 1: show up' },
      { file: 'B700A7F7.mov', from: 1.4, to: 2.7, text: 'Step 2: hug the insulation' },
      { file: 'B700A7F7.mov', from: 2.7, to: 3.9, text: 'Step 3: lift with your legs (I didn’t)', low: true },
      { file: 'B700A7F7.mov', from: 3.9, to: 6.1, text: 'Step 4: never mention it again', low: true },
    ],
  },
  'making-content': {
    title: 'Contractors trying to make<br>Instagram content be like:',
    shots: [
      { file: '541C1FC1.mov', from: 1.3, to: 2.1, text: '' },
      { file: '541C1FC1.mov', from: 0.2, to: 1.3, text: '“just be yourself on camera”', low: true },
      { file: '541C1FC1.mov', from: 2.1, to: 4.4, text: '“okay now do it again but funny”', low: true },
    ],
  },
};

const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=TikTok+Sans:wght@500;700&display=swap">';
const overlay = (title, text, low) => `<!doctype html><html><head>${FONT}</head>
<body style="margin:0;width:${W}px;height:${H}px;background:transparent;font-family:'TikTok Sans',sans-serif">
<div style="position:absolute;top:400px;left:0;right:0;text-align:center">
  <span style="display:inline;background:#fff;color:#000;font-weight:700;font-size:54px;line-height:1.42;padding:6px 18px;
  border-radius:14px;-webkit-box-decoration-break:clone;box-decoration-break:clone">${title}</span></div>
<div style="position:absolute;top:${low ? 1240 : 640}px;left:120px;right:120px;text-align:center;color:#fff;font-weight:700;
  font-size:56px;line-height:1.2;text-wrap:balance;text-shadow:0 2px 6px rgba(0,0,0,.65),0 0 14px rgba(0,0,0,.35)">${text}</div>
</body></html>`;

async function build(name, reel, page) {
  const tmp = path.join(__dirname, '.tmp', 'hook-stack', name);
  fs.mkdirSync(tmp, { recursive: true });
  const parts = [];
  for (const [i, s] of reel.shots.entries()) {
    const png = path.join(tmp, `ov${i}.png`);
    await page.setContent(overlay(reel.title, s.text, s.low), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: png, omitBackground: true });
    const sp = s.speed || 1;
    const f = path.join(tmp, `part${i}.mp4`);
    ff(['-ss', String(s.from), '-to', String(s.to), '-i', path.join(RAW, s.file), '-loop', '1', '-i', png,
      '-filter_complex', `[0:v]setpts=(PTS-STARTPTS)/${sp},${FRAME},fps=${FPS},format=yuv420p[b];` +
        `[b][1:v]overlay=0:0:shortest=1,format=yuv420p[v];[0:a]atempo=${sp},aresample=48000,aformat=channel_layouts=stereo,volume=0.6[a]`,
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
