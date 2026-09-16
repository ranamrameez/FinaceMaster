import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main/site.css'
import './theme.css'
import './brighter-theme.css'
import './theme-bright-card-overrides.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
