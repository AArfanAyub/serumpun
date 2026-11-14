import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Serumpun build configuration.
 *
 * The output is a pure static bundle with relative asset URLs (`base: './'`), so the
 * same `dist/` folder works from any free static host, from a local file share, or
 * from the optional Electron wrapper.
 *
 * Leaflet is loaded ONLY through `await import('leaflet')` inside FieldMap.tsx. We
 * deliberately do NOT declare a `manualChunks` rule for it: an explicit chunk makes
 * Vite emit a `<link rel="modulepreload">` for Leaflet in index.html, which would
 * download the ~150 kB map library on the welcome screen. Relying on the native
 * dynamic import keeps Leaflet in a genuine async chunk with a solid-colour + pin
 * fallback for the first paint and for offline / blocked-tile situations.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 350,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    restoreMocks: true,
  },
});
