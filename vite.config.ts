import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // dist/.vite/manifest.json: the chunk graph (which chunk imports which, and which are dynamic entries). The platform's payload
    // test (src/platform/shell/payload.test.ts) reads it to hold that the landing loads no other world's code (spec 2.4).
    manifest: true,
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
})

