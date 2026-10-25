// Renders the final monogram to transparent PNGs (300 dpi at 1.5" and 2", plus a
// 3000px master), vector PDFs at 2" wide, and the spec sheet.
// Usage: node construction-content/brand/final/render.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

(async () => {
  const b = await chromium.launch();
  for (const v of ['print', 'embroidery']) {
    for (const c of ['white', 'black']) {
      const src = fs.readFileSync(path.join(DIR, 'svg', `mc-monogram-${v}-${c}.svg`), 'utf8');
      const [, vw, vh] = src.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
      for (const [label, px] of [['2in-300dpi', 600], ['1.5in-300dpi', 450], ['3000px', 3000]]) {
        const h = Math.round(px * vh / vw);
        const p = await b.newPage({ viewport: { width: px, height: h } });
        await p.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${px}" height="${h}" `)}</body></html>`);
        await p.screenshot({ path: path.join(DIR, 'png', `mc-monogram-${v}-${c}-${label}.png`), omitBackground: true });
        await p.close();
      }
      const p = await b.newPage();
      await p.goto('file://' + path.join(DIR, `_${v}-${c}.html`));
      await p.pdf({ path: path.join(DIR, 'pdf', `mc-monogram-${v}-${c}-2in.pdf`), width: '2in', height: `${(2 * vh / vw).toFixed(4)}in`, printBackground: false, pageRanges: '1' });
      await p.close();
    }
  }
  const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(DIR, 'spec-sheet.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(DIR, 'spec-sheet.png'), fullPage: true });
  await b.close();
})();
