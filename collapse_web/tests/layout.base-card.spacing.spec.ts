import { test, expect, devices } from '@playwright/test'

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/'

const iPhone = devices['iPhone 12']

test.use({...iPhone})

test('base card header control spacing', async ({ page }) => {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' })
  const enterBtn = page.getByRole('button', { name: /enter player mode/i })
  if (await enterBtn.count() > 0) await enterBtn.click()
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('main')

  // Select all base cards
  const cards = await page.$$('.card.base-card')
  for (const card of cards) {
    const cardBox = await card.boundingBox() || { x: 0, width: 0 }
    // find the last button inside the card
    const buttons = await card.$$('button')
    if (buttons.length === 0) continue
    const lastButton = buttons[buttons.length - 1]
    const btnBox = await lastButton.boundingBox() || { x: 0, width: 0 }
    const gap = (cardBox.x + cardBox.width) - (btnBox.x + btnBox.width)
    // Ensure at least 6px of gap between button and right card edge for visual comfort
    expect(gap).toBeGreaterThanOrEqual(6)
  }
})
