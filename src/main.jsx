import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { setUpNative } from './lib/native.js'
import { applyReduceTransparency } from './lib/prefs.js'

setUpNative()
applyReduceTransparency() // before first paint, so the glass never flashes in

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
