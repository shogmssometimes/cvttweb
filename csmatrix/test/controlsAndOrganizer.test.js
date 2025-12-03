const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:8080/');
  await page.waitForFunction(() => typeof window.graph !== 'undefined' && window.graph.nodes, { timeout: 5000 });
  const controlsVisibleInitial = await page.evaluate(() => window.getComputedStyle(document.querySelector('#controls')).display !== 'none');
  const nodesVisibleInitial = await page.evaluate(() => window.getComputedStyle(document.querySelector('#node-list-section')).display !== 'none');
  console.log('initial controls visible:', controlsVisibleInitial, 'nodes visible:', nodesVisibleInitial);
  if (controlsVisibleInitial) { console.error('controls should be hidden until toggled'); await browser.close(); process.exit(2); }
  if (nodesVisibleInitial) { console.error('node organizer should be hidden until toggled'); await browser.close(); process.exit(3); }
  await page.click('#btn-toggle-controls');
  await page.waitForTimeout(250);
  await page.click('#btn-toggle-nodes');
  await page.waitForTimeout(250);
  const controlsVisibleAfter = await page.evaluate(() => window.getComputedStyle(document.querySelector('#controls')).display !== 'none');
  const nodesVisibleAfter = await page.evaluate(() => window.getComputedStyle(document.querySelector('#node-list-section')).display !== 'none');
  console.log('after toggle controls visible:', controlsVisibleAfter, 'nodes visible:', nodesVisibleAfter);
  if (!controlsVisibleAfter) { console.error('controls did not appear after toggle'); await browser.close(); process.exit(4); }
  if (!nodesVisibleAfter) { console.error('node organizer did not appear after toggle'); await browser.close(); process.exit(5); }
  console.log('controls & node organizer toggle test passed');
  await browser.close();
})();
