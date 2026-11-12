import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = { '@shared': resolve('src/shared') }

// Strict CSP for the packaged renderer (dev needs inline scripts for React refresh).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'"
].join('; ')

const csp = {
  name: 'okiro-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
}

export default defineConfig({
  main: {
    resolve: { alias: shared },
    build: { rollupOptions: { external: ['node:sqlite'] } }
  },
  preload: {
    resolve: { alias: shared }
  },
  renderer: {
    resolve: { alias: { ...shared, '@renderer': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss(), csp]
  }
})
