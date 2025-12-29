import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/flights': {
        target: 'https://opensky-network.org/api/states/all',
        changeOrigin: true,
        secure: false, // Sometimes needed for https targets
        rewrite: (path) => path.replace(/^\/api\/flights/, ''),
      },
      // Fallback/debug
      '/api': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
