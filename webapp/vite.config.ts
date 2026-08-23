/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Deployed to a subpath of the existing GitHub Pages project site
  // (github.com/ranamrameez/FinaceMaster -> ranamrameez.github.io/FinaceMaster/webapp/),
  // alongside the still-live legacy static files at the repo root — this
  // is Phase 1, not a cutover. HashRouter means routing itself doesn't
  // care about the base path; this only affects built asset URLs.
  base: '/FinaceMaster/webapp/',
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
