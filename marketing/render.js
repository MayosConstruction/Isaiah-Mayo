const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const dir = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 888, height: 624 }, deviceScaleFactor: 3.125 }); // 9.25in x 6.5in at 300 dpi
  await p.goto('file://' + dir + '/postcard.html'); await p.waitForTimeout(1500);
  await p.evaluate(() => document.fonts.ready);
  const cards = await p.$$('.card');
  await cards[0].screenshot({ path: dir + '/Mayos-postcard-FRONT.png' });
  await cards[1].screenshot({ path: dir + '/Mayos-postcard-BACK.png' });
  await p.pdf({ path: dir + '/Mayos-EDDM-postcard-print.pdf', width: '9.25in', height: '6.5in', printBackground: true });
  console.log('fonts:', await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + f.weight).join(',')));
  await b.close();
})();
