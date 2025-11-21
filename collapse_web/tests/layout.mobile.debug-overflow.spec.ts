import { test, expect, devices } from '@playwright/test'

const iPhone = devices['iPhone 12']

test.use({ ...iPhone })

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/'

test('debug: show elements overflowing on the page', async ({ page }) => {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#root')

  const overflows = await page.evaluate(() => {
    const results: any[] = []
    const inner = window.innerWidth
    const nodes = Array.from(document.querySelectorAll('body *'))
    for (const node of nodes) {
      try {
        const rect = (node as HTMLElement).getBoundingClientRect()
        if (rect.right > inner + 2) {
          results.push({ tag: node.tagName, rect, html: node.outerHTML ? node.outerHTML.slice(0, 200) : '' })
        }
      } catch (e) {
        // ignore
      }
    }
    return { inner, overs: results.slice(0, 30) }
  })

  console.log('Inner width: ', overflows.inner)
  console.log('Found overflow elements: ', overflows.overs.length)
  for (const el of overflows.overs) {
    console.log(el.tag, el.rect, el.html)
  }

  expect(overflows.overs.length).toBe(0)
})
