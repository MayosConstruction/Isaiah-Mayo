// Renders business-card.html to print files. Usage: node marketing/render-cards.js "$PWD/marketing"
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const dir = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 360, height: 216 }, deviceScaleFactor: 3.125 }); // 3.75in x 2.25in at 300 dpi
  await p.goto('file://' + dir + '/business-card.html');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  const cards = await p.$$('.card');
  const names = ['FRONT', 'BACK-Isaiah', 'BACK-Moss'];
  for (let i = 0; i < cards.length; i++) await cards[i].screenshot({ path: `${dir}/Mayos-business-card-${names[i]}.png` });
  // One print-ready PDF per person: page 1 front, page 2 back.
  for (const [who, idx] of [['Isaiah', 1], ['Moss', 2]]) {
    await p.evaluate((keep) => document.querySelectorAll('.card').forEach((c, i) => (c.style.display = i === 0 || i === keep ? '' : 'none')), idx);
    await p.pdf({ path: `${dir}/Mayos-business-card-${who}-print.pdf`, width: '3.75in', height: '2.25in', printBackground: true });
  }
  await b.close();
})();
