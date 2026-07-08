import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/oswald/500.css'
import '@fontsource/oswald/600.css'
import '@fontsource/oswald/700.css'
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
