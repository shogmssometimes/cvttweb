import { test, expect } from '@playwright/test'

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/'

// Run with viewport 1080x1920 (portrait)

test('1080x1920 portrait: page and cards fit viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 })
  await page.goto(SITE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#root')

  const inner = await page.evaluate(() => window.innerWidth)
  expect(inner).toBeGreaterThanOrEqual(360) // sanity check

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(inner + 2)

  const cards = await page.$$('.card')
  for (const card of cards) {
    const box = await card.boundingBox()
    if (!box) continue
    expect(box.x + box.width).toBeLessThanOrEqual(inner + 2)
  }
})

// Landscape: rotate viewport
test('1080x1920 landscape: page and cards fit viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(SITE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#root')

  const inner = await page.evaluate(() => window.innerWidth)
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(inner + 2)

  const cards = await page.$$('.card')
  for (const card of cards) {
    const box = await card.boundingBox()
    if (!box) continue
    expect(box.x + box.width).toBeLessThanOrEqual(inner + 2)
  }
})
