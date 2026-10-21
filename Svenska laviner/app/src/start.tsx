import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/instrument-sans/wdth.css'
import './index.css'
import App from './App.tsx'
import AuthProvider from './auth/AuthProvider'
import FavoritesProvider from './favorites/FavoritesProvider'
import { initNativeApp, isNativeApp } from './services/native'
import { initAppearance } from './services/appearance'

initAppearance()

void initNativeApp()

// Keeps the site itself on the device so it opens without coverage (see
// public/sw.js). Not in the apps: they carry their own copy of the site.
if (import.meta.env.PROD && !isNativeApp() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// A page's code that can't be loaded usually means a new version was
// published while this one was open (the old files are gone): load the new
// version, at most once a minute so a real outage can't loop.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('fjallkoll:reloaded-at') ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem('fjallkoll:reloaded-at', String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

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
