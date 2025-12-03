const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // small viewport mobile simulation
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('http://127.0.0.1:8080/');
  await page.waitForFunction(() => typeof window.graph !== 'undefined', { timeout: 5000 });
  // compute svg and wrapper heights
  const result = await page.evaluate(() => {
    const svg = document.getElementById('matrix-svg');
    const wrap = document.getElementById('matrix-canvas-wrap');
    if (!svg || !wrap) return { ok: false, reason: 'no svg or wrap' };
    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    return { svgH: svgRect.height, wrapH: wrapRect.height };
  });
  console.log('svg height:', result.svgH, 'wrap height:', result.wrapH);
  // Allow small 2px leeway for borders
  if (Math.abs(result.svgH - result.wrapH) > 4) { console.error('Wrapper height does not match svg height; padding present'); await browser.close(); process.exit(2); }
  console.log('no vertical padding test passed');
  await browser.close();
})();
