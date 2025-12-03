const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/');
  await page.waitForFunction(() => typeof window.graph !== 'undefined', { timeout: 5000 });
  const hasAutoToggle = await page.$('#auto-max-toggle');
  if (hasAutoToggle) { console.error('Auto-fit toggle should be removed'); await browser.close(); process.exit(2); }
  const hasLockToggle = await page.$('#lock-scale-toggle');
  if (hasLockToggle) { console.error('Lock scale toggle should be removed'); await browser.close(); process.exit(3); }
  const hasDensity = await page.$('#density-select');
  if (hasDensity) { console.error('Layout density select should be removed'); await browser.close(); process.exit(4); }
  const autoState = await page.evaluate(() => window.graph && window.graph.autoMax);
  if (autoState !== true) { console.error('graph.autoMax should always be enabled now'); await browser.close(); process.exit(5); }
  const bodyHasClass = await page.evaluate(() => document.body.classList.contains('graph-auto-max'));
  if (!bodyHasClass) { console.error('body should always carry graph-auto-max when auto-fit is mandatory'); await browser.close(); process.exit(6); }
  console.log('auto-fit permanent enablement test passed');
  await browser.close();
})();
