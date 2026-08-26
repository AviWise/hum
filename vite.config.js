import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/out-dc/',
  plugins: [react()],
  server: { port: 5180 },
  optimizeDeps: { exclude: ['maplibre-gl'] },
})
