import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Registered unconditionally at app load, not only when a user opts into push
// (lib/push.js's subscribeToPush also calls .register("/sw.js") — idempotent,
// browsers just return the existing registration). Most browsers require an
// active service worker before offering the install/"Add to Home Screen"
// prompt at all, so deferring registration until a push opt-in meant the app
// often wasn't actually installable as a PWA for anyone who never touched
// that toggle.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
