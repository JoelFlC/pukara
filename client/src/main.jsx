import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registrarServiceWorker } from './utils/pwaRegister.js'

// Registro no bloqueante del Service Worker (P12)
registrarServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
