import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './route-editor.css'
import { RouteEditor } from './RouteEditor'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouteEditor />
  </StrictMode>,
)
