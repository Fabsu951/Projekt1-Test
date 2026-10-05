/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Tells the service worker (public/sw.js) which files make up this build, so
 * it can keep the whole app for use offline. The list and a version derived
 * from it are written into dist/sw.js; a new build changes the file, which
 * makes browsers install the new worker and drop the old copy.
 */
function offlineAppShell(): Plugin {
  let files: string[] = []
  let outDir = 'dist'
  return {
    name: 'offline-app-shell',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    generateBundle(_options, bundle) {
      files = Object.keys(bundle).filter((f) => !f.endsWith('.map'))
    },
    writeBundle() {
      const publicFiles = ['manifest.webmanifest', 'favicon.svg', 'icons/icon-192.webp', 'icons/icon-512.webp']
      const all = ['/', ...[...files, ...publicFiles].map((f) => `/${f}`)]
      const version = createHash('sha256').update(all.join('\n')).digest('hex').slice(0, 12)
      const path = join(outDir, 'sw.js')
      const sw = readFileSync(path, 'utf8')
        .replace('"__APP_VERSION__"', JSON.stringify(version))
        .replace('["__APP_FILES__"]', JSON.stringify(all))
      writeFileSync(path, sw)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineAppShell()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
