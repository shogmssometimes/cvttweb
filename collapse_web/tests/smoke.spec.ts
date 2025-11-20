import { test, expect } from '@playwright/test';

// smoke test: verify the public site loads and a key element exists
test.describe('Live site basic smoke', () => {
  test('index loads and shows Player Mode', async ({ page }) => {
    const site = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/';
    await page.goto(site, { waitUntil: 'domcontentloaded' });
    // page root should exist
    await page.waitForSelector('#root', { timeout: 10000 });
    // expectation: the top of the page contains 'Player Mode' and 'GM Mode' items
    await expect(page.getByRole('heading', { name: 'Player Mode' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Enter Player Mode' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Enter GM Mode' })).toBeVisible({ timeout: 5000 });
  });
});
