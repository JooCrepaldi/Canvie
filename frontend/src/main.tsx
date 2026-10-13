import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { DocumentPersistence } from './persistence'
import './index.css'
import './App.css'

const root = document.getElementById('root')

if (root === null) {
  throw new Error('Canvie root element is missing')
}

const persistence = new DocumentPersistence()
const initialLoad = persistence.load()

// A debounced change is written before the page is hidden or torn down.
window.addEventListener('pagehide', () => persistence.flush())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistence.flush()
})

createRoot(root).render(
  <StrictMode>
    <App persistence={persistence} initialLoad={initialLoad} />
  </StrictMode>,
)
