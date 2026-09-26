import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': `http://127.0.0.1:${process.env.PORT || '3001'}` } },
  preview: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'], testTimeout: 30000, hookTimeout: 30000 },
})
