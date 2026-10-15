import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/instrument-sans/wdth.css'
import './index.css'
import App from './App.tsx'
import AuthProvider from './auth/AuthProvider'
import FavoritesProvider from './favorites/FavoritesProvider'
import { Capacitor } from '@capacitor/core'
import { initNativeApp, isNativeApp } from './services/native'
import { initAppearance } from './services/appearance'

initAppearance()

// Also set by the inline script in index.html; this covers a late Capacitor bridge.
if (Capacitor.getPlatform() === 'android') document.documentElement.dataset.native = 'android'

void initNativeApp()

// Keeps the site itself on the device so it opens without coverage (see
// public/sw.js). Not in the apps: they carry their own copy of the site.
if (import.meta.env.PROD && !isNativeApp() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FavoritesProvider>
          <App />
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
