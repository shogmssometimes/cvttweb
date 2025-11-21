import { test, expect, devices } from '@playwright/test'

// Emulate iPhone 12 viewport
const iPhone = devices['iPhone 12']

test.use({ ...iPhone })

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/'

test('mobile pages have no horizontal overflow', async ({ page }) => {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' })
  // Click enter player mode if present
  const enterBtn = page.getByRole('button', { name: /enter player mode/i })
  if (await enterBtn.count() > 0) {
    await enterBtn.click()
  }
  await page.waitForLoadState('networkidle')

  // Wait for main content to render
  await page.waitForSelector('main')

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const innerWidth = await page.evaluate(() => window.innerWidth)
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 2)

  // Verify visual bound for each card
  const cards = await page.$$('.card')
  for (const card of cards) {
    const { x, width } = await card.boundingBox() || { x: 0, width: 0 }
    expect(x + width).toBeLessThanOrEqual(innerWidth + 2)
  }

  // Navigate to Deck Ops and repeat
  const deckOps = page.getByText(/deck ops/i)
  await deckOps.click()
  await page.waitForTimeout(250)

  const scrollWidth2 = await page.evaluate(() => document.documentElement.scrollWidth)
  const innerWidth2 = await page.evaluate(() => window.innerWidth)
  expect(scrollWidth2).toBeLessThanOrEqual(innerWidth2 + 2)

  const cards2 = await page.$$('.card')
  for (const card of cards2) {
    const { x, width } = await card.boundingBox() || { x: 0, width: 0 }
    expect(x + width).toBeLessThanOrEqual(innerWidth2 + 2)
  }
})
