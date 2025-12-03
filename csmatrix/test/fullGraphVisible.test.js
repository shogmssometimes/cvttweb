const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/');
  await page.waitForFunction(() => typeof window.graph !== 'undefined' && window.graph.nodes && window.graph.nodes.length > 0, { timeout: 5000 });
  // Get bounding rect of svg and check viewBox value
  const visible = await page.evaluate(() => {
    const svg = document.getElementById('matrix-svg');
    if (!svg) return { ok: false, msg: 'no svg' };
    const svgRect = svg.getBoundingClientRect();
    // find extreme tick text (6, -6) - there are multiple '6' elements; pick those that appear near corners
    const ticks = Array.from(svg.querySelectorAll('text.tick'));
    const coords = ticks.map(t => {
      const r = t.getBoundingClientRect(); return { text: t.textContent, x: r.x, y: r.y, w: r.width, h: r.height };
    }).sort((a,b) => a.y - b.y);
    // get top-most and bottom-most ticks
    const top = coords[0]; const bottom = coords[coords.length-1];
    // ensure they are within the svg rect and not clipped
    const within = (r) => r.x >= svgRect.x - 1 && (r.x + r.w) <= (svgRect.x + svgRect.width + 1) && r.y >= svgRect.y - 1 && (r.y + r.h) <= (svgRect.y + svgRect.height + 1);
    const svgEl = document.getElementById('matrix-svg');
    const viewBox = svgEl.getAttribute('viewBox');
    return { ok: within(top) && within(bottom), svgRect, top, bottom, viewBox };
  });
  if (!visible.ok) { console.error('Full graph not visible: ', visible); await browser.close(); process.exit(2); }
  // ensure the viewBox is 1000x1000
  if (!visible.viewBox || visible.viewBox.indexOf('1000 1000') === -1) { console.error('viewBox not updated to 1000x1000', visible.viewBox); await browser.close(); process.exit(3); }
  console.log('full graph visible test passed');
  await browser.close();
})();
