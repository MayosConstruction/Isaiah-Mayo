// Renders business-card.html to print files. Usage: node marketing/render-cards.js "$PWD/marketing"
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const dir = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 360, height: 216 }, deviceScaleFactor: 3.125 }); // 3.75in x 2.25in at 300 dpi
  await p.goto('file://' + dir + '/business-card.html');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  await (await p.$('.card')).screenshot({ path: `${dir}/Mayos-business-card.png` });
  await p.pdf({ path: `${dir}/Mayos-business-card-print.pdf`, width: '3.75in', height: '2.25in', printBackground: true });
  await b.close();
})();
