// Exports transparent PNGs of each SVG in svg/ (long side 2400px) and a square
// 1080px Instagram profile picture.  Usage: node render_png.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
(async () => {
  const b = await chromium.launch();
  fs.mkdirSync(path.join(DIR, 'png'), { recursive: true });
  for (const f of fs.readdirSync(path.join(DIR, 'svg')).filter((f) => f.endsWith('.svg'))) {
    const src = fs.readFileSync(path.join(DIR, 'svg', f), 'utf8');
    const [, , , vw, vh] = src.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/).map(Number);
    const s = 2400 / Math.max(vw, vh), w = Math.round(vw * s), h = Math.round(vh * s);
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
    await p.screenshot({ path: path.join(DIR, 'png', f.replace('.svg', '.png')), omitBackground: true });
    await p.close();
  }
  const src = fs.readFileSync(path.join(DIR, 'svg', 'avatar.svg'), 'utf8');
  const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
  await p.setContent(`<html><body style="margin:0;background:#C4553B">${src.replace('<svg ', '<svg width="1080" height="1080" ')}</body></html>`);
  await p.screenshot({ path: path.join(DIR, 'png', 'instagram-profile-1080.png') });
  await b.close();
})();
