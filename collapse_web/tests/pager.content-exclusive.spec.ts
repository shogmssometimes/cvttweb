import { test, expect, devices } from '@playwright/test'

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/'
const desktop = { viewport: { width: 1280, height: 1024 } }

test.use({ ...desktop })

test('builder and deckops pages have exclusive content (wide viewport)', async ({ page }) => {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' })
  const enterBtn = page.getByRole('button', { name: /enter player mode/i })
  if (await enterBtn.count() > 0) await enterBtn.click()
  // Ensure the default page (Builder) shows Base Skill Cards
  expect(await page.isVisible('h2:has-text("Base Skill Cards")')).toBeTruthy()

  // Click Builder (page 2)
  await page.getByRole('button', { name: /Navigate to Builder/i }).click()
  await page.waitForTimeout(200)
  expect(await page.isVisible('h2:has-text("Base Skill Cards")')).toBeTruthy()
  expect(await page.isVisible('h2:has-text("Deck Operations")')).toBeFalsy()

  // Click Deck Ops (page 2)
  await page.getByRole('button', { name: /Navigate to Deck Ops/i }).click()
  await page.waitForTimeout(200)
  expect(await page.isVisible('h2:has-text("Deck Operations")')).toBeTruthy()
  expect(await page.isVisible('h2:has-text("Base Skill Cards")')).toBeFalsy()
})
