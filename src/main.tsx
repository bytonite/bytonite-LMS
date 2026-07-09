import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'
import ErrorBoundary from './components/ErrorBoundary.tsx'

// Setup mock if electronAPI is not available
import './mockElectron'

// Check if electronAPI is available (will be provided by mock if running in browser)
if (!window.electronAPI) {
  console.error('ERROR: window.electronAPI is not available! Make sure preload script loaded correctly.');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)