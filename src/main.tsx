import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

registerSW({ immediate: true })

const splashShownAt = Date.now()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Fade the splash screen out once the app has mounted, keeping it
// visible long enough for the logo animation to play.
const MIN_SPLASH_MS = 900
const splash = document.getElementById('splash')
if (splash) {
  const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - splashShownAt))
  window.setTimeout(() => {
    splash.classList.add('out')
    splash.addEventListener('transitionend', () => splash.remove(), { once: true })
    // Fallback removal in case transitionend never fires
    window.setTimeout(() => splash.remove(), 600)
  }, remaining)
}
