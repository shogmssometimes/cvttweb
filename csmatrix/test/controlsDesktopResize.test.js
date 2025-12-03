const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // Desktop viewport
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:8080/');
  await page.waitForFunction(() => typeof window.graph !== 'undefined' && window.graph.nodes, { timeout: 5000 });
  // Enforced mobile layout should hide controls by default even on desktop
  const controlsVisible = await page.evaluate(() => window.getComputedStyle(document.querySelector('#controls')).display !== 'none');
  if (controlsVisible) { console.error('controls should be hidden until toggled'); await browser.close(); process.exit(2); }
  const matrixWrap = await page.$('#matrix-canvas-wrap');
  const before = await matrixWrap.boundingBox();
  console.log('desktop width before showing controls:', before.width);
  // Toggle controls on via the Show Controls button
  const toggleBtn = await page.$('#btn-toggle-controls');
  if (!toggleBtn) { console.error('show controls button missing'); await browser.close(); process.exit(3); }
  await toggleBtn.click();
  await page.waitForTimeout(260);
  const controlsVisibleAfter = await page.evaluate(() => window.getComputedStyle(document.querySelector('#controls')).display !== 'none');
  if (!controlsVisibleAfter) { console.error('controls did not show after toggle'); await browser.close(); process.exit(4); }
  const after = await matrixWrap.boundingBox();
  console.log('desktop width after showing controls:', after.width);
  // The matrix should retain essentially full width in forced mobile layout
  if (Math.abs(after.width - before.width) > 8) { console.error('Matrix width changed unexpectedly when controls toggled'); await browser.close(); process.exit(5); }
  console.log('desktop controls forced-mobile layout test passed');
  await browser.close();
})();
