import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // ⭐️ 타임아웃 설정 추가
        timeout: 300000,  // 5분
        proxyTimeout: 300000,  // 5분
      }
    }
  }
})
