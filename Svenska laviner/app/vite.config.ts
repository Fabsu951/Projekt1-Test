/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { pageHead, withPageHead } from './src/components/pageHead'

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

/**
 * Writes a copy of index.html for every page in public/sitemap.xml
 * (dist/karta.html, dist/omrade/<id>.html …) with that page's title,
 * description and address in <head>. Cloudflare Pages serves karta.html at
 * /karta, so link previews and crawlers that don't run JavaScript see the
 * right text; the app itself starts exactly as from index.html.
 */
function pageHeads(): Plugin {
  let outDir = 'dist'
  let siteUrl = 'https://snolage.se'
  return {
    name: 'page-heads',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
      siteUrl = loadEnv(config.mode, config.envDir || process.cwd(), 'VITE_').VITE_PUBLIC_SITE_URL || siteUrl
    },
    writeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf8')
      const sitemap = readFileSync(join(outDir, 'sitemap.xml'), 'utf8')
      const paths = [...sitemap.matchAll(/<loc>(.+?)<\/loc>/g)].map((m) => new URL(m[1]).pathname)
      for (const path of paths) {
        if (path === '/') continue
        const file = join(outDir, `${path.replace(/\/+$/, '')}.html`)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, withPageHead(html, pageHead(path, siteUrl)))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineAppShell(), pageHeads()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
