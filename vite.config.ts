import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom domain (mpqukis.web.id) serves at root, so base is '/'.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
