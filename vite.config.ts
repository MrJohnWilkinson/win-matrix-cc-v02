import { defineConfig } from 'vite'

// Four static pages, no router (Q28, Q33). Base path matches the GitHub Pages project URL.
export default defineConfig({
  base: '/win-matrix-cc-v02/',
  build: {
    rollupOptions: {
      input: { index: 'index.html', matrix: 'matrix.html', scoreboard: 'scoreboard.html', display: 'display.html' },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
})
