// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    rollupOptions: {
      output: {
        // The framework/UI-kit dependencies rarely change between deploys
        // and were previously bundled into the single ~2.5MB main chunk
        // alongside every eagerly-imported page — splitting them out lets
        // browsers cache them across releases and lets the main chunk
        // shrink to just this app's own code.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
  server: {
    proxy: {
      // Forward all /api requests to backend
      '/api': {
        target: 'http://localhost:10000', // your backend p
        changeOrigin: true,
      },
    },
  },
})
