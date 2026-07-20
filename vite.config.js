import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/kubika/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'docs',
    sourcemap: false
  },
  server: {
    port: 3000,
    open: true
  }
})
