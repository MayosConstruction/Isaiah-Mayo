// Instagram highlight covers, 1080x1080. Instagram crops them to a circle, so the
// striped ring sits just inside that circle.  Usage: node make_highlights.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const RED = '#C4553B', CREAM = '#F3EBDD', NAVY = '#1E2A3A';
const svgFile = (f) => fs.readFileSync(path.join(DIR, 'svg', f), 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');
const STAR = `<svg viewBox="-10 -10 20 20" width="56%" height="56%"><polygon fill="${CREAM}" points="0,-9 2.1,-2.9 8.6,-2.8 3.4,1.1 5.3,7.3 0,3.6 -5.3,7.3 -3.4,1.1 -8.6,-2.8 -2.1,-2.9"/></svg>`;
const covers = [
  ['jobs', `<div style="width:100%;height:100%">${svgFile('avatar.svg')}</div>`],
  ['reviews', STAR],
  ['merch', `<div style="width:92%;height:92%">${svgFile('badge-one-color.svg')}</div>`],
  ['estimates', `<span style="font:400 300px Yellowtail;color:${CREAM};margin-top:-30px">Free</span>`],
  ['before-after', `<span style="font:400 170px/0.95 Yellowtail;color:${CREAM};text-align:center;margin-top:-10px">Before<br>&amp; After</span>`],
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
  for (const [name, icon] of covers) {
    await p.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yellowtail&display=swap"></head>
<body style="margin:0;width:1080px;height:1080px;background:${RED};display:flex;align-items:center;justify-content:center">
<div style="width:1080px;height:1080px;border-radius:50%;background:repeating-conic-gradient(${CREAM} 0 7.5deg, ${RED} 7.5deg 15deg);display:flex;align-items:center;justify-content:center">
<div style="width:960px;height:960px;border-radius:50%;background:${NAVY};display:flex;align-items:center;justify-content:center">
<div style="width:920px;height:920px;border-radius:50%;background:${RED};overflow:hidden;display:flex;align-items:center;justify-content:center">${icon}</div></div></div></body></html>`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(DIR, 'highlights', `highlight-${name}.png`) });
  }
  await b.close();
})();
