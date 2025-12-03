const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/');
  await page.waitForFunction(() => typeof window.graph !== 'undefined' && window.graph.nodes && window.graph.nodes.length > 0, { timeout: 5000 });
  // get the first node circle r attribute
  const circle = await page.$('svg g.node circle[data-node-id]');
  if (!circle) { console.error('no node circle found'); await browser.close(); process.exit(2); }
  const rAttr = await circle.getAttribute('r');
  console.log('circle r attr:', rAttr);
  if (!rAttr) { console.error('circle r attribute missing'); await browser.close(); process.exit(3); }
  const rVal = parseInt(rAttr, 10);
  if (Number.isNaN(rVal)) { console.error(`r attribute is not a number: '${rAttr}'`); await browser.close(); process.exit(4); }
  if (rVal < 28 || rVal > 72) { console.error(`expected r to be between 28 and 72 but got r='${rVal}'`); await browser.close(); process.exit(5); }
  console.log('circle size test passed');
  await browser.close();
})();
