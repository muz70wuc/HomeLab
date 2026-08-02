import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    allowedHosts: true, // Ermöglicht Anfragen über host.docker.internal
    proxy: {
      '/api/kuma': {
        target: process.env.VITE_KUMA_URL || 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kuma/, ''),
      },
      // Backend-Endpunkt zum Speichern der YAML-Datei
      '/api/config': {
        target: process.env.VITE_BACKEND_URL || 'http://dashboard-api:3000',
        changeOrigin: true,
      },
    },
  },
});