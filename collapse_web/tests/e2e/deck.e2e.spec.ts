import { test, expect, devices } from '@playwright/test';

const SITE = process.env.SITE_URL ?? 'https://shogmssometimes.github.io/cvttweb/';

function makeBuilderState(deck: string[], handLimit = 5) {
  const nullCount = 0;
  // Minimal state: baseCounts/modCounts are empty
  const baseCounts = {};
  const modCounts = {};
  deck.forEach((id) => {
    // no counts
  });
  return {
    baseCounts,
    modCounts,
    nullCount,
    modifierCapacity: 10,
    deck,
    hand: [],
    discard: [],
    isLocked: true,
    deckName: 'e2e',
    savedDecks: {},
    handLimit,
  };
}

test.describe('E2E deck builder flows', () => {
  test('LIFO draw - draw order should be reverse of deck array', async ({ browser }) => {
    const context = await browser.newContext({ ...(devices['Pixel 5']) });
    const page = await context.newPage();
    const deck = ['base-athletics', 'base-strength', 'base-stealth'];
    await page.addInitScript((state) => {
      localStorage.setItem('collapse.deck-builder.v2', JSON.stringify(state));
    }, makeBuilderState(deck));
    await page.goto(SITE);
    await page.waitForSelector('#root');
    // If landing role selected, enter Player Mode
    if (await page.locator('text=Enter Player Mode').count() > 0) {
      await page.click('text=Enter Player Mode');
    }
    // Draw three times
    for (let i = 0; i < 3; i++) {
      await page.click('text=Draw 1');
    }
    // Read the hand area from localStorage for deterministic ordering
    const hand = await page.evaluate(() => JSON.parse(localStorage.getItem('collapse.deck-builder.v2') || '{}').hand || []);
    expect(hand.length).toBe(3);
    // deck: ['base-athletics', 'base-strength', 'base-stealth'] -> expected draw: stealth, strength, athletics
    expect(hand[0].id).toBe('base-stealth');
    expect(hand[1].id).toBe('base-strength');
    expect(hand[2].id).toBe('base-athletics');
    await context.close();
  });

  test('Hand limit should prevent extra draws', async ({ browser }) => {
    const context = await browser.newContext({ ...(devices['Pixel 5']) });
    const page = await context.newPage();
    const deck = ['base-athletics', 'base-strength', 'base-stealth'];
    await page.addInitScript((state) => {
      localStorage.setItem('collapse.deck-builder.v2', JSON.stringify(state));
    }, makeBuilderState(deck, 2));
    await page.goto(SITE);
    await page.waitForSelector('#root');
    if (await page.locator('text=Enter Player Mode').count() > 0) {
      await page.click('text=Enter Player Mode');
    }
    // Draw twice - should be ok
    await page.click('text=Draw 1');
    await page.click('text=Draw 1');
    // Third draw should be disabled (button disabled)
    const disabled = await page.$eval('button:has-text("Draw 1")', (btn) => (btn as HTMLButtonElement).disabled);
    expect(disabled).toBe(true);
    await context.close();
  });

  test('Play base card from hand', async ({ browser }) => {
    const context = await browser.newContext({ ...(devices['Pixel 5']) });
    const page = await context.newPage();
    const deck = ['base-athletics'];
    await page.addInitScript((state) => {
      localStorage.setItem('collapse.deck-builder.v2', JSON.stringify(state));
    }, makeBuilderState(deck));
    await page.goto(SITE);
    await page.waitForSelector('#root');
    if (await page.locator('text=Enter Player Mode').count() > 0) {
      await page.click('text=Enter Player Mode');
    }
    // Draw the only card
    await page.click('text=Draw 1');
    // Now play it (start + finalize)
    await page.click('text=Play (Select Base)');
    await page.click('text=Finalize Play');
    // The card in hand should change to 'Played' text
    // After finalize, the card should be moved to the discard pile with origin 'played'
    const discardState = await page.evaluate(() => JSON.parse(localStorage.getItem('collapse.deck-builder.v2') || '{}').discard || []);
    expect(discardState[0].origin).toBe('played');
    await context.close();
  });

  test('Export triggers a JSON download', async ({ browser }) => {
    const context = await browser.newContext({ ...(devices['Pixel 5']) });
    const page = await context.newPage();
    const deck = ['base-athletics'];
    await page.addInitScript((state) => {
      localStorage.setItem('collapse.deck-builder.v2', JSON.stringify(state));
    }, makeBuilderState(deck));
    await page.goto(SITE);
    await page.waitForSelector('#root');
    if (await page.locator('text=Enter Player Mode').count() > 0) {
      await page.click('text=Enter Player Mode');
    }
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('text=Export')
    ]);
    const path = await download.path();
    expect(path).toBeTruthy();
    await context.close();
  });
});
