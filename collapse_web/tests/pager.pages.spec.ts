import { test, expect, devices } from '@playwright/test'

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/'
const iPhone = devices['iPhone 12']

test.use({...iPhone})

test('pager nav pages show correct content', async ({ page }) => {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' })
  const enterBtn = page.getByRole('button', { name: /enter player mode/i })
  if (await enterBtn.count() > 0) await enterBtn.click()
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('main')

    // Default page should be Builder
    expect(await page.isVisible('h2:has-text("Base Skill Cards")')).toBeTruthy()

  // Click Builder (use pager nav button role to avoid ambiguous matches)
  await page.getByRole('button', { name: /Navigate to Builder/i }).click()
  await page.waitForTimeout(200)
  await page.waitForSelector('h2:has-text("Base Skill Cards")')
  expect(await page.isVisible('h2:has-text("Base Skill Cards")')).toBeTruthy()

  // Click Deck Ops
  await page.getByRole('button', { name: /Navigate to Deck Ops/i }).click()
  await page.waitForTimeout(200)
  // ensure Hand & Deck Operations & Discard Pile are visible
  expect(await page.isVisible('h3:has-text("Hand")')).toBeTruthy()
  expect(await page.isVisible('h2:has-text("Deck Operations")')).toBeTruthy()
  expect(await page.isVisible('h3:has-text("Discard Pile")')).toBeTruthy()
})
