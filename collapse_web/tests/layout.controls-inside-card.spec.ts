import { test, expect, devices } from '@playwright/test'

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/'

// Default to iPhone 12 emulation for this test
const iPhone = devices['iPhone 12']
test.use({...iPhone})

test('control buttons stay inside card bounds', async ({ page }) => {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' })
  const enterBtn = page.getByRole('button', { name: /enter player mode/i })
  if (await enterBtn.count() > 0) await enterBtn.click()
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('main')

  const cards = await page.$$('.card')
  for (const card of cards) {
    const cardBox = await card.boundingBox() || { x: 0, width: 0 }
    // find the last button inside the card (the '+' button)
    const buttons = await card.$$('button')
    if (buttons.length === 0) continue
    const lastButton = buttons[buttons.length - 1]
    const btnBox = await lastButton.boundingBox() || { x: 0, width: 0 }
    // Assert the right edge of the button is <= right edge of card
    expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1)
    // Assert the left edge of the button is >= left card x
    expect(btnBox.x).toBeGreaterThanOrEqual(cardBox.x - 1)
  }

})
