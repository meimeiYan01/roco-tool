import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import router from './router'
import { initStore } from './services/breedingService'
import './styles/tailwind.css'
import './styles/global.css'

async function bootstrap() {
  // 先从 IndexedDB 恢复数据（首次则从 JSON 初始化并持久化）
  await initStore()

  const app = createApp(App)
  app.use(ElementPlus)
  app.use(router)
  app.mount('#app')
}

bootstrap()
