import { test, expect, devices } from '@playwright/test'

const DEVICES = ['iPhone 12', 'Pixel 5', 'iPhone SE']
const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/'

test.describe('Mobile viewport coverage', () => {
  for (const name of DEVICES) {
    const device = devices[name]
    test(name + ' no overflow portrait', async ({ browser }) => {
      const context = await browser.newContext({ ...device })
      const page = await context.newPage()
      await page.goto(SITE, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('#root')

      const inner = await page.evaluate(() => window.innerWidth)
      const overflows = await page.evaluate(() => {
        const inner = window.innerWidth
        return Array.from(document.querySelectorAll('body *')).filter((node: any) => {
          try { const rect = node.getBoundingClientRect(); return rect.right > inner + 1 }
          catch (e) { return false }
        }).length
      })
      expect(overflows).toBe(0)
      await context.close()
    })

    test(name + ' no overflow landscape', async ({ browser }) => {
      const context = await browser.newContext({ ...device, viewport: { width: device.viewport?.height ?? 800, height: device.viewport?.width ?? 1280 }})
      const page = await context.newPage()
      await page.goto(SITE, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('#root')

      const inner = await page.evaluate(() => window.innerWidth)
      const overflows = await page.evaluate(() => {
        const inner = window.innerWidth
        return Array.from(document.querySelectorAll('body *')).filter((node: any) => {
          try { const rect = node.getBoundingClientRect(); return rect.right > inner + 1 }
          catch (e) { return false }
        }).length
      })
      expect(overflows).toBe(0)
      await context.close()
    })
  }
})
