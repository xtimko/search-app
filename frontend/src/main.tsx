import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/onest/400.css'
import '@fontsource/onest/500.css'
import '@fontsource/onest/600.css'
import '@fontsource/onest/700.css'
import '@fontsource/onest/800.css'
import '@fontsource/unbounded/500.css'
import '@fontsource/unbounded/600.css'
import '@fontsource/unbounded/700.css'
import './styles/theme.css'
import App from './App'
import { initVk } from './vk'

// Пробуем получить личность из vk-bridge (внутри ВК), но не блокируем рендер
// дольше таймаута: в обычном браузере bridge.send «висит» — рендерим по таймауту.
function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}

Promise.race([initVk(), new Promise<void>((r) => setTimeout(r, 800))]).finally(render)
