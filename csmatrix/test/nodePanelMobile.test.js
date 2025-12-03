const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://127.0.0.1:8080/');
  await page.waitForFunction(() => typeof window.graph !== 'undefined' && window.graph.nodes, { timeout: 5000 });
  // If no nodes, add one
  const nodeCount = await page.evaluate(() => window.graph.nodes.length);
  if (nodeCount === 0) {
    await page.click('#btn-add-node');
    await page.waitForTimeout(200);
  }
  // Click in the center of first node's group
  const g = await page.$('svg g.node');
  if (!g) { console.error('no node group found'); await browser.close(); process.exit(2); }
  const box = await g.boundingBox();
  await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  await page.waitForTimeout(200);
  // Panel is now embedded into the node card. Find the selected card and check its inline panel visibility.
  const panelVisible = await page.evaluate(() => {
    const panel = document.querySelector('.node-card.selected .node-panel-inline');
    return !!panel && window.getComputedStyle(panel).display !== 'none';
  });
  console.log('panel visible:', panelVisible);
  if (!panelVisible) { console.error('Node panel is not visible on mobile after selection'); await browser.close(); process.exit(3); }
  console.log('node panel mobile visibility test passed');
  await browser.close();
})();
