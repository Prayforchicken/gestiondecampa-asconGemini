import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// `base: './'` permite publicar la app en cualquier carpeta (GitHub Pages, servidor propio...).
// Dos páginas: la app completa (index.html) y la versión móvil de prueba (movil.html).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), movil: resolve(__dirname, 'movil.html') },
    },
  },
  server: {
    // En desarrollo, las llamadas a /api van al servidor del hogar (npm start).
    proxy: { '/api': 'http://localhost:8787' },
  },
});
