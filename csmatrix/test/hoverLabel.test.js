const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/');
  // Ensure the page has loaded the graph and window.graph is available
  await page.waitForFunction(() => { return typeof window.graph !== 'undefined' && window.graph.nodes; }, { timeout: 5000 });
  // Add a node if there are no nodes
  const nodeCount = await page.evaluate(() => { return window.graph.nodes.length; });
  if (nodeCount === 0) {
    await page.evaluate(() => { window.graph.addNode({ name: 'playwright-test', gx: 0, gy: 0 }); });
    await page.waitForTimeout(200);
  }
  // Find first node group (g.node)
  const g = await page.$('svg g.node');
  if (!g) {
    console.error('no node group found'); await browser.close(); process.exit(2);
  }
  // hover over the node using bounding box center
  const box = await g.boundingBox();
  if (!box) {
    console.error('bounding box not found'); await browser.close(); process.exit(2);
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(250);
  // get computed opacity of the node label
  const opacity = await page.evaluate((gEl) => {
    const text = gEl.querySelector('text.node-label');
    return window.getComputedStyle(text).opacity;
  }, g);
  console.log('computed label opacity:', opacity);
  if (opacity !== '1') {
    console.error('label did not become visible on hover'); await browser.close(); process.exit(3);
  }
  console.log('hover label test passed');
  await browser.close();
})();
