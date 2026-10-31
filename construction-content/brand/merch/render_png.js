// Transparent 300 dpi PNGs of the tee print files: back 12" wide (3600px),
// left chest 2" wide (600px).  Usage: node render_png.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
(async () => {
  const b = await chromium.launch();
  for (const f of fs.readdirSync(path.join(DIR, 'svg'))) {
    let src = fs.readFileSync(path.join(DIR, 'svg', f), 'utf8');
    const [, , , vw, vh] = src.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/).map(Number);
    // Lay out at 1/3 size and render at 3x pixel density (one huge screenshot fails).
    const w = (f.startsWith('back') ? 3600 : 600) / 3, h = Math.round(w * vh / vw);
    src = src.replace(/ width="[^"]*"/, '').replace(/ height="[^"]*"/, '').replace('<svg ', `<svg width="${w}" height="${h}" style="display:block" `);
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 3 });
    await p.setContent(`<html><body style="margin:0;background:transparent">${src}</body></html>`);
    await p.screenshot({ path: path.join(DIR, 'png', f.replace('.svg', '-300dpi.png')), omitBackground: true });
    await p.close();
  }
  await b.close();
})();
