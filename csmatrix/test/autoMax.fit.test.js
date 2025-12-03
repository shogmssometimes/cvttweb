const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/');
  await page.waitForFunction(() => typeof window.graph !== 'undefined', { timeout: 5000 });
  // Ensure autoMax is enabled by default and pad values are near zero
  const auto = await page.evaluate(() => !!(window.graph && window.graph.autoMax));
  if (!auto) { console.error('AutoMax not enabled by default'); await browser.close(); process.exit(2); }
  const padValues = await page.evaluate(() => ({ left: window.graph.pad.left, right: window.graph.pad.right, top: window.graph.pad.top, bottom: window.graph.pad.bottom }));
  console.log('pad values under autoMax:', padValues);
  if (padValues.left > 4 || padValues.right > 4 || padValues.top > 4 || padValues.bottom > 4) {
    console.error('Pad values too large under autoMax; expected near-zero');
    await browser.close(); process.exit(3);
  }
  console.log('autoMax fit test passed');
  await browser.close();
})();
