import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.*'],
    coverage: {
      provider: 'istanbul',
      include: ['src/utils/**/*.ts', 'src/utils/**/*.tsx']
    }
  }
})
