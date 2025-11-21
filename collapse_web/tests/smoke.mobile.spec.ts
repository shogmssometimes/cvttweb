import { test, expect, devices } from '@playwright/test';

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/';

test.describe('Mobile smoke: basic flows and PWA presence', () => {
  test('mobile: layout, pager navigation, and service worker', async ({ browser }) => {
    // Emulate a Pixel 5 mobile device
    const context = await browser.newContext({ ...(devices['Pixel 5']) });
    const page = await context.newPage();
    await page.goto(SITE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#root', { timeout: 10000 });

    // Ensure we're on the DeckBuilder page; if we land on the Role selection, click through
    const builderHeading = page.getByRole('heading', { name: 'Engram Deck Builder' });
    if (!(await builderHeading.isVisible())) {
      const enterPlayerButton = page.getByRole('button', { name: 'Enter Player Mode' });
      if (await enterPlayerButton.isVisible()) {
        await enterPlayerButton.click();
      }
    }
    // Mobile layout: check the primary builder header and a key control
    await expect(page.getByRole('heading', { name: 'Engram Deck Builder' })).toBeVisible({ timeout: 5000 });
    // Pager navigation: ensure we can navigate to 'Deck Operations' (second page)
    await page.locator('.pager-nav .pager-item').nth(1).click();
    await expect(page.getByRole('heading', { name: 'Deck Operations' })).toBeVisible({ timeout: 5000 });
    // Pager bar should be fixed at bottom in mobile layouts
    const pagerPosition = await page.evaluate(() => getComputedStyle(document.querySelector('.pager-nav') as Element).position);
    expect(pagerPosition === 'fixed' || pagerPosition === 'sticky').toBeTruthy();

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
