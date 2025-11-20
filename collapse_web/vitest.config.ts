import { defineConfig } from 'vitest/config'

// Configure vitest to only run unit tests in `src/` and exclude Playwright tests
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx,js,jsx}', 'src/**/*.spec.{ts,tsx,js,jsx}'],
    exclude: ['tests/**', 'src/**/e2e/**', '**/*.e2e.spec.{ts,tsx,js,jsx}'],
  },
})
