import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` permite publicar la app en cualquier carpeta (GitHub Pages, servidor propio...).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 800 },
  server: {
    // En desarrollo, las llamadas a /api van al servidor del hogar (npm start).
    proxy: { '/api': 'http://localhost:8787' },
  },
});
