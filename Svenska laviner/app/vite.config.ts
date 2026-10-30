/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { pageHead, withPageHead } from './src/components/pageHead'

/** The npm package a bundled file comes from, e.g. "leaflet" or "@capacitor/core". */
export function packageOf(file: string): string | null {
  const i = file.lastIndexOf('node_modules/')
  if (i < 0) return null
  const parts = file.slice(i + 'node_modules/'.length).split('/')
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
}

/**
 * Writes dist/licenser.txt: every open-source package that ends up in the
 * built app (site and native apps alike), with its licence text. MIT, BSD,
 * Apache, ISC and the OFL (fonts) all ask for their notice to travel with
 * copies of the code; the About page links here.
 */
function thirdPartyLicenses(): Plugin {
  const used = new Set<string>()
  return {
    name: 'third-party-licenses',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        const files = item.type === 'chunk' ? Object.keys(item.modules) : (item.originalFileNames ?? [])
        for (const f of files) {
          const name = packageOf(f.replace(/\\/g, '/'))
          if (name) used.add(name)
        }
      }
      const sections = [...used].sort().map((name) => {
        const dir = join('node_modules', name)
        const pkg = existsSync(join(dir, 'package.json')) ? JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) : {}
        const licenceFile = existsSync(dir) ? readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f)) : undefined
        const text = licenceFile ? readFileSync(join(dir, licenceFile), 'utf8').trim() : `Licens: ${pkg.license ?? 'se paketet'}`
        return `${name} ${pkg.version ?? ''} (${pkg.license ?? '?'})\n${pkg.homepage ?? ''}\n\n${text}`
      })
      this.emitFile({
        type: 'asset',
        fileName: 'licenser.txt',
        // The byte-order mark makes browsers read å, ä and ö right whatever the server says.
        source:
          '\ufeff' +
          'Snöläge bygger på öppen källkod. Här är paketen som ingår i appen och deras licenser.\n' +
          'Snöläge is built with open-source software. These are the packages included in the app and their licences.\n\n' +
          sections.join('\n\n' + '='.repeat(72) + '\n\n') +
          '\n',
      })
    },
  }
}

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

/**
 * Writes dist/_headers for Cloudflare Pages: a content security policy that
 * only lets the site load code from itself (plus Turnstile) and talk to the
 * hosts it really uses, and no framing by other sites. The worker and map
 * addresses come from the build's env; the inline theme script in
 * index.html is allowed by its hash, so editing it updates the policy.
 * (The apps bundle the site and don't get these headers.)
 */
function securityHeaders(): Plugin {
  let outDir = 'dist'
  let env: Record<string, string> = {}
  return {
    name: 'security-headers',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
      env = loadEnv(config.mode, config.envDir || process.cwd(), 'VITE_')
    },
    writeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf8')
      const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
        (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
      )
      const origin = (url: string | undefined) => {
        try {
          return url ? new URL(url).origin : ''
        } catch {
          return ''
        }
      }
      const ours = [origin(env.VITE_MAP_PROXY_URL), origin(env.VITE_TILE_DIRECT_URL)].filter(Boolean).join(' ')
      const turnstile = 'https://challenges.cloudflare.com'
      // Cloudflare Web Analytics (cookieless visitor counts), which Pages adds to the site.
      const analytics = 'https://static.cloudflareinsights.com'
      const beacon = 'https://cloudflareinsights.com'
      const elevation = 'https://tiles.mapterhorn.com'
      // Kartverket: the map of Norway on top of ours (shown and saved offline).
      const norway = 'https://cache.kartverket.no'
      // NVE: the slope map of Norway (tiles only).
      const nve = 'https://gis3.nve.no'
      const csp = [
        "default-src 'self'",
        `script-src 'self' ${hashes.join(' ')} ${turnstile} ${analytics}`,
        // Leaflet and React set inline styles.
        "style-src 'self' 'unsafe-inline'",
        // OpenStreetMap: the fallback map, and where the worker sends tiles it doesn't have.
        `img-src 'self' data: blob: ${ours} https://tile.openstreetmap.org ${norway} ${nve} ${elevation}`,
        `connect-src 'self' ${ours} ${norway} ${elevation} https://opendata-download-metfcst.smhi.se https://opendata-download-metobs.smhi.se ${turnstile} ${beacon}`,
        `frame-src ${turnstile}`,
        "worker-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
      const headers = [
        '/*',
        `  Content-Security-Policy: ${csp.replace(/ +/g, ' ')}`,
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '  Permissions-Policy: geolocation=(self), camera=(self), microphone=(), payment=(), usb=()',
        '/sw.js',
        '  Cache-Control: no-cache',
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '',
      ].join('\n')
      writeFileSync(join(outDir, '_headers'), headers)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineAppShell(), pageHeads(), securityHeaders(), thirdPartyLicenses()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
