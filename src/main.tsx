import React from 'react'
import ReactDOM from 'react-dom/client'
// Studio Episode UI 사용 (BobPT 백엔드와 통합됨)
import App from './components/studio-episode/App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
