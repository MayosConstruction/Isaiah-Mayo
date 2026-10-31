// "Job interview at Mayo's" reel: open on the bear-hug, slow-mo hoist with a
// punch-in, a red HIRED stamp slams on, then the "day 2" series hook.
// Usage: node construction-content/edits/hired.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'raw-footage', 'B700A7F7.mov');
const TMP = path.join(__dirname, '.tmp', 'hired');
const OUT = path.join(ROOT, 'finished', 'hired.mp4');
const W = 1080, H = 1920, FPS = 30;
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const FRAME = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;

// Source in/out (seconds), speed, and punch-in amount.
const segs = [
  { from: 1.2, to: 2.6 },                           // bear-hugging the roll
  { from: 2.6, to: 3.4, speed: 0.45, punch: 0.15 }, // the hoist, slow motion
  { from: 3.4, to: 5.2 },                           // walking off with it overhead
];
const SLAM = 3.22; // output time the stamp hits, right as the roll lands

// TikTok-native captions: white, heavy, black outline.
const cap = (lines, top, size = 64) => `<!doctype html><html><body style="margin:0;width:${W}px;height:${H}px;background:transparent">
<div style="position:absolute;top:${top}px;left:70px;right:70px;text-align:center;color:#fff;font:800 ${size}px/1.15 Inter,sans-serif;
-webkit-text-stroke:10px #000;paint-order:stroke fill;text-wrap:balance">${lines}</div></body></html>`;
const stamp = () => `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap"></head>
<body style="margin:0;width:900px;height:520px;background:transparent;display:flex;align-items:center;justify-content:center">
<div style="transform:rotate(-9deg);border:16px solid #C4553B;border-radius:22px;padding:6px 46px 14px;color:#C4553B;
font:400 170px/1 'Archivo Black',sans-serif;letter-spacing:.04em;background:rgba(243,235,221,.18)">HIRED</div></body></html>`;

const captions = [
  { file: 'hook', html: cap("Job interview at Mayo's:", 250), from: 0, to: 99 },
  { file: 'q', html: cap('“Can you carry the insulation?”', 1260, 58), from: 0.35, to: SLAM - 0.05 },
  { file: 'follow', html: cap('follow to see if he survives day 2', 1300, 58), from: SLAM + 0.7, to: 99 },
];

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const b = await chromium.launch();
  let p = await b.newPage({ viewport: { width: W, height: H } });
  for (const c of captions) {
    await p.setContent(c.html, { waitUntil: 'networkidle' });
    await p.screenshot({ path: path.join(TMP, `${c.file}.png`), omitBackground: true });
  }
  p = await b.newPage({ viewport: { width: 900, height: 520 } });
  await p.setContent(stamp(), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(TMP, 'stamp.png'), omitBackground: true });
  await b.close();

  const parts = segs.map((s, i) => {
    const sp = s.speed || 1, len = (s.to - s.from) / sp;
    let v = `setpts=(PTS-STARTPTS)/${sp},${FRAME}`;
    if (s.punch) {
      const z = `(1+${s.punch}*min(1,t/${len.toFixed(2)}))`;
      v += `,scale=w='trunc(${W}*${z}/2)*2':h='trunc(${H}*${z}/2)*2':eval=frame,crop=${W}:${H}`;
    }
    v += `,fps=${FPS},format=yuv420p`;
    const tempo = sp < 0.5 ? `atempo=0.5,atempo=${(sp / 0.5).toFixed(3)}` : `atempo=${sp}`;
    const f = path.join(TMP, `part${i}.mp4`);
    ff(['-ss', String(s.from), '-to', String(s.to), '-i', SRC, '-vf', v,
      '-af', `${tempo},aresample=48000,aformat=channel_layouts=stereo`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-c:a', 'aac', '-b:a', '192k', f]);
    return f;
  });
  fs.writeFileSync(path.join(TMP, 'list.txt'), parts.map((f) => `file '${f}'`).join('\n'));
  const body = path.join(TMP, 'body.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'list.txt'), '-c', 'copy', body]);
  const len = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', body]).toString());

  // Captions, then the stamp: it starts 1.8x size and slams down to 1x in 0.13s,
  // with a quick white flash on impact.
  const inputs = ['-i', body, ...captions.flatMap((c) => ['-loop', '1', '-i', path.join(TMP, `${c.file}.png`)]),
    '-loop', '1', '-t', String(len), '-i', path.join(TMP, 'stamp.png')];
  let g = '[0:v]null[c0];';
  captions.forEach((c, i) => {
    g += `[c${i}][${i + 1}:v]overlay=0:0:shortest=1:enable='between(t,${c.from},${c.to})'[c${i + 1}];`;
  });
  const si = captions.length + 1, last = `c${captions.length}`;
  g += `[${si}:v]format=rgba,scale=w='trunc(900*max(1,1.8-6*t)/2)*2':h=-2:eval=frame,setpts=PTS+${SLAM}/TB[st];` +
       `[${last}][st]overlay=x='(W-w)/2':y='520-(h-520)/2':eof_action=pass:enable='gte(t,${SLAM})'[s1];` +
       `[s1]eq=brightness='if(between(t,${SLAM + 0.13},${SLAM + 0.2}),0.35,0)':eval=frame,format=yuv420p[v];` +
       `[0:a]volume=0.5[a]`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  ff([...inputs, '-filter_complex', g, '-map', '[v]', '-map', '[a]', '-t', len.toFixed(3),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', OUT]);
  console.log(`${OUT} (${len.toFixed(1)}s)`);
})();
