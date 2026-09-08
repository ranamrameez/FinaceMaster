/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Deployed at the root of the GitHub Pages project site
  // (github.com/ranamrameez/FinaceMaster -> ranamrameez.github.io/FinaceMaster/).
  // The legacy static apps that used to occupy the repo root (and the
  // /webapp/ subpath this app used to deploy to alongside them) are gone —
  // see .github/workflows/static.yml's own history/comment for why. HashRouter
  // means routing itself doesn't care about the base path; this only
  // affects built asset URLs.
  base: '/FinaceMaster/',
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
