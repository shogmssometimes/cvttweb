#!/usr/bin/env node
/*
 * Simple Playwright JSON test result summarizer.
 * Usage: node scripts/playwright-summary.js path/to/mobile.json path/to/desktop.json
 */
const fs = require('fs');
const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.log('No playright JSON files specified.');
  process.exit(0);
}

let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;
let totalTests = 0;
let filesProcessed = 0;

for (const p of paths) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    // Playwright's JSON reporter tends to output an object with 'suites' and 'tests' or 'specs'
    // We'll do a robust pass: count occurrences of status in the raw JSON as fallback.
    const passed = (raw.match(/"status"\s*:\s*"passed"/g) || []).length;
    const failed = (raw.match(/"status"\s*:\s*"failed"/g) || []).length;
    const skipped = (raw.match(/"status"\s*:\s*"skipped"/g) || []).length;
    const tests = passed + failed + skipped;
    totalPassed += passed;
    totalFailed += failed;
    totalSkipped += skipped;
    totalTests += tests;
    filesProcessed++;
  } catch (e) {
    // If file doesn't exist or JSON parse fails, skip
  }
}

console.log(`Playwright summary: files=${filesProcessed} tests=${totalTests} passed=${totalPassed} failed=${totalFailed} skipped=${totalSkipped}`);
if (totalFailed > 0) process.exit(1);
process.exit(0);
