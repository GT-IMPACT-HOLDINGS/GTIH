import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadGtihSdk } from './lib/gtihClient'

async function boot() {
  await loadGtihSdk()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

boot().catch((err) => {
  console.error(err)
  const root = document.getElementById('root')
  if (root) {
    root.textContent =
      'Failed to load GTIH SDK. Flip DEPLOY_TARGET in src/deployTarget.ts (dev|prod) or check the GTIH host is reachable.'
  }
})
