import React from 'react'
import ReactDOM from 'react-dom/client'
import '@vkontakte/vkui/dist/vkui.css'
import App from './App'
import { initVk } from './vk'

// Пробуем получить личность из vk-bridge, но НЕ блокируем рендер дольше таймаута:
// внутри ВК промис резолвится быстро, в обычном браузере send «висит» — рендерим по таймауту.
function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

Promise.race([initVk(), new Promise<void>((r) => setTimeout(r, 800))]).finally(render)
