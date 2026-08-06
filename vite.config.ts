import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      'obsidian': path.resolve(__dirname, './src/api/obsidian-shim.ts')
    }
  },
  define: {
    // Excalidraw uses process.env internally
    'process.env.IS_PREACT': JSON.stringify('false'),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  optimizeDeps: {
    include: ['@excalidraw/excalidraw'],
  },
  server: {
    port: 5173,
    strictPort: true,
    open: false,
  }
})

