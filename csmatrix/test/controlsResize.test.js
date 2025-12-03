const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // Emulate a mobile viewport so the controls-open toggle is effective
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://127.0.0.1:8080/');
  await page.waitForFunction(() => typeof window.graph !== 'undefined' && window.graph.nodes, { timeout: 5000 });
  // ensure controls are initially open and visible
  const controls = await page.$('#controls');
  if (!controls) { console.error('no #controls element found'); await browser.close(); process.exit(2); }
  const matrixWrap = await page.$('#matrix-canvas-wrap');
  const beforeBox = await matrixWrap.boundingBox();
  const ctlStyle = await page.evaluate(() => ({ bodyClasses: document.body.className, controlsDisplay: window.getComputedStyle(document.querySelector('#controls')).display }));
  console.log('initial body class:', ctlStyle.bodyClasses, 'controls display:', ctlStyle.controlsDisplay);
  console.log('matrix width before:', beforeBox.width);
  // Ensure controls are currently visible (for the test). If not, enable them, then toggle off.
  await page.evaluate(() => { if (!document.body.classList.contains('controls-open')) document.body.classList.add('controls-open'); try { if (window.updateControlsVisibility) window.updateControlsVisibility(); } catch(e) {} });
  await page.waitForTimeout(150);
  const beforeBox2 = await matrixWrap.boundingBox();
  console.log('matrix width with controls visible:', beforeBox2.width);
  // Now hide controls
  await page.evaluate(() => { document.body.classList.remove('controls-open'); try { if (window.updateControlsVisibility) window.updateControlsVisibility(); } catch(e) {} });
  await page.waitForTimeout(260); // wait for CSS transition
  const afterBox = await matrixWrap.boundingBox();
  const ctlStyleAfter = await page.evaluate(() => ({ bodyClasses: document.body.className, controlsDisplay: window.getComputedStyle(document.querySelector('#controls')).display }));
  console.log('after body class:', ctlStyleAfter.bodyClasses, 'controls display:', ctlStyleAfter.controlsDisplay);
  console.log('matrix width after hiding controls:', afterBox.width);
  if (Math.abs(afterBox.width - beforeBox2.width) > 6) {
    console.error('Matrix width changed unexpectedly when toggling controls'); await browser.close(); process.exit(3);
  }
  console.log('controls single-column width test passed');
  await browser.close();
})();
