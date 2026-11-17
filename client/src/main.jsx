import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {
  iniciarCapturaPromptInstalacion,
  registrarServiceWorker,
} from './utils/pwaRegister.js'

// Captura temprana del prompt PWA y registro del Service Worker (P12)
iniciarCapturaPromptInstalacion();
registrarServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
