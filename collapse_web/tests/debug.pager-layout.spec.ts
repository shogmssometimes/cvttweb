import { test, devices } from '@playwright/test'

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/'
const iPhone = devices['iPhone 12']

test.use({...iPhone})

test('debug pager layout', async ({ page }) => {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' })
  const enterBtn = page.getByRole('button', { name: /enter player mode/i })
  if (await enterBtn.count() > 0) await enterBtn.click()
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('.pager')

  const pages = await page.$$('.pager-inner .page')
  console.log('pages found:', pages.length)
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    const box = await p.boundingBox()
    console.log(`page[${i}] bbox:`, box)
  }
  // Check per-page computed styles and visibility to ensure exclusivity
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    const bbox = await p.boundingBox()
    const computed = await p.evaluate((el: any) => ({
      position: getComputedStyle(el).position,
      transform: getComputedStyle(el).transform,
      opacity: getComputedStyle(el).opacity,
      visibility: getComputedStyle(el).visibility,
      ariaHidden: el.getAttribute('aria-hidden'),
      dataHidden: el.getAttribute('data-hidden'),
    }))
    console.log(`page[${i}] bbox:`, bbox, 'computed:', computed)
  }
  // Confirm exactly one page is visible via aria-hidden and computed opacity
  const visiblePages = await Promise.all(pages.map(p => p.evaluate((el: any) => ({ ariaHidden: el.getAttribute('aria-hidden'), dataHidden: el.getAttribute('data-hidden'), opacity: getComputedStyle(el).opacity }))))
  console.log('visible page states:', visiblePages)
  const visibleCount = visiblePages.reduce((acc, s) => acc + ((s.ariaHidden === 'false' || s.opacity === '1') ? 1 : 0), 0)
  console.log('visibleCount:', visibleCount)
  if (visibleCount !== 1) throw new Error(`Expected exactly 1 visible page, found ${visibleCount}`)
})
