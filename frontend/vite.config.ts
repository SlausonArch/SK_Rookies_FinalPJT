import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: mode === 'bank' ? 15174 : 15173,
    strictPort: true,
  },
}))
