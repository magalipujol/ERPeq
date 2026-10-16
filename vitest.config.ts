import { defineConfig } from 'vitest/config'

// Solo pruebas unitarias de lógica pura; las de punta a punta (tests/) las corre Playwright.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
