// Screenshots every carousels/<name>/slide-NN.html to slide-NN.png at 1080x1350.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  for (const dir of fs.readdirSync(__dirname).filter((d) => fs.existsSync(path.join(__dirname, d, 'slide-01.html')))) {
    for (const f of fs.readdirSync(path.join(__dirname, dir)).filter((f) => f.endsWith('.html'))) {
      await p.goto('file://' + path.join(__dirname, dir, f));
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(__dirname, dir, f.replace('.html', '.png')) });
    }
  }
  await b.close();
})();
