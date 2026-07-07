import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/epilogue/400.css'
import '@fontsource/epilogue/500.css'
import '@fontsource/epilogue/600.css'
import '@fontsource/epilogue/700.css'
import '@fontsource/epilogue/800.css'
import '@fontsource/anton/400.css'
import './styles/theme.css'
import App from './App'
import { initVk } from './vk'

// Пробуем получить личность из vk-bridge (внутри ВК), но не блокируем рендер
// дольше таймаута: в обычном браузере bridge.send «висит» — рендерим по таймауту.
function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

Promise.race([initVk(), new Promise<void>((r) => setTimeout(r, 800))]).finally(render)
