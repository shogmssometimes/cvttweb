import { test, expect, devices } from '@playwright/test';

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/';

test.describe('Mobile smoke: basic flows and PWA presence', () => {
  test('mobile: layout, pager navigation, and service worker', async ({ browser }) => {
    // Emulate a Pixel 5 mobile device
    const context = await browser.newContext({ ...(devices['Pixel 5']) });
    const page = await context.newPage();
    await page.goto(SITE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#root', { timeout: 10000 });

    // Mobile layout: if landing screen is role select, enter the Player Mode to reach the deck builder
    const enterPlayerBtn = page.getByRole('button', { name: /Enter Player Mode/i });
    if (await enterPlayerBtn.count() > 0) {
      await enterPlayerBtn.click();
    }
    // Mobile layout: check the primary builder header and a key control
    await expect(page.getByRole('heading', { name: 'Engram Deck Builder' })).toBeVisible({ timeout: 7000 });
    // Pager navigation: ensure we can navigate to 'Deck Operations' (second page)
    await page.locator('.pager-nav .pager-item').nth(1).click();
    await expect(page.getByRole('heading', { name: 'Deck Operations' })).toBeVisible({ timeout: 5000 });

    // Simulate a swipe back to the previous page (builder) by dispatching pointer events
    const box = await page.locator('.pager').boundingBox();
    if (box) {
      const startX = Math.round(box.x + box.width * 0.8)
      const endX = Math.round(box.x + box.width * 0.2)
      const midY = Math.round(box.y + box.height * 0.5)
      await page.dispatchEvent('.pager', 'pointerdown', { clientX: startX, clientY: midY, pointerType: 'touch' })
      // move left to swipe back
      await page.dispatchEvent('.pager', 'pointermove', { clientX: endX, clientY: midY, pointerType: 'touch' })
      await page.dispatchEvent('.pager', 'pointerup', { clientX: endX, clientY: midY, pointerType: 'touch' })
      await expect(page.getByRole('heading', { name: 'Engram Deck Builder' })).toBeVisible({ timeout: 4000 });
    }

    // Now validate swipe threshold: short swipe should not change the page; long swipe should
    const box2 = await page.locator('.pager').boundingBox();
    if (box2) {
      const thresholdPx = Math.round(Math.max(48, Math.min(150, box2.width * 0.22)));
      const midY = Math.round(box2.y + box2.height * 0.5);

      // Ensure we are on Deck Ops first again (tap to navigate back)
      await page.locator('.pager-nav .pager-item').nth(1).click();
      await expect(page.getByRole('heading', { name: 'Deck Operations' })).toBeVisible({ timeout: 3000 });

      // Short swipe (less than threshold) - should not change page
      const sStart = Math.round(box2.x + box2.width * 0.5)
      const sEnd = Math.round(sStart + Math.floor(thresholdPx * 0.4))
      await page.dispatchEvent('.pager', 'pointerdown', { clientX: sStart, clientY: midY, pointerType: 'touch' })
      await page.dispatchEvent('.pager', 'pointermove', { clientX: sEnd, clientY: midY, pointerType: 'touch' })
      await page.dispatchEvent('.pager', 'pointerup', { clientX: sEnd, clientY: midY, pointerType: 'touch' })
      await expect(page.getByRole('heading', { name: 'Deck Operations' })).toBeVisible({ timeout: 3000 });

      // Long swipe (greater than threshold) - should change page
      const lStart = Math.round(box2.x + box2.width * 0.5)
      const lEnd = Math.round(lStart + Math.floor(thresholdPx * 1.25))
      await page.dispatchEvent('.pager', 'pointerdown', { clientX: lStart, clientY: midY, pointerType: 'touch' })
      await page.dispatchEvent('.pager', 'pointermove', { clientX: lEnd, clientY: midY, pointerType: 'touch' })
      await page.dispatchEvent('.pager', 'pointerup', { clientX: lEnd, clientY: midY, pointerType: 'touch' })
      await expect(page.getByRole('heading', { name: 'Engram Deck Builder' })).toBeVisible({ timeout: 4000 });
    }

    // Assert the pager nav is fixed to the bottom of the viewport
    const isFixed = await page.$eval('.pager-nav', (el) => getComputedStyle(el).position === 'fixed');
    expect(isFixed).toBe(true);

    // Assert the pager nav bounding box touches the bottom of the viewport (+/- 10px tolerance)
    const navBox = await page.locator('.pager-nav').boundingBox();
    if (navBox) {
      const viewport = page.viewportSize();
      if (viewport) {
        const navBottom = Math.round(navBox.y + navBox.height);
        const viewportHeight = viewport.height;
        expect(Math.abs(navBottom - viewportHeight)).toBeLessThanOrEqual(12);
      }
    }

    // Ensure the manifest is linked
    const manifestHref = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute('href'));
    expect(manifestHref).toBeTruthy();

    // Wait for service worker registration (if the site is served over https; GH Pages is)
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        return !!reg;
      } catch (e) {
        return false;
      }
    });
    expect(swRegistered).toBeTruthy();
    await context.close();
  });
});
