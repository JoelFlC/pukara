import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Configuración oficial PWA de PUKARA según la Sección 9.4 del documento rector:
 * - Manifest instalable standalone para Android/Chrome/Desktop
 * - Precache del App Shell
 * - Estrategias de caché diferenciadas: NetworkFirst para /api/estado y StaleWhileRevalidate para contenidos
 * - Prohibición estricta de precarga masiva de teselas de tile.openstreetmap.org
 */
export const CONFIG_PWA_PUKARA = {
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  manifest: {
    name: 'PUKARA — Consulta Informativa de Lluvias (Sector Llojeta)',
    short_name: 'PUKARA',
    description:
      'Prototipo académico PWA de consulta de niveles informativos de lluvia y recomendaciones preventivas generales para Llojeta / Bajo Llojeta (La Paz).',
    theme_color: '#0f172a',
    background_color: '#f8fafc',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    scope: '/',
    lang: 'es-BO',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      // Regla 1 — Estado y nivel informativo (NetworkFirst con respaldo)
      {
        urlPattern: ({ url }) =>
          url.pathname.startsWith('/api/estado') ||
          url.pathname.startsWith('/api/historial'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pukara-estado-network-first',
          networkTimeoutSeconds: 4,
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 7,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Regla 2 — Recomendaciones, contactos y referencias (StaleWhileRevalidate)
      {
        urlPattern: ({ url }) =>
          url.pathname.startsWith('/api/recomendaciones') ||
          url.pathname.startsWith('/api/contactos') ||
          url.pathname.startsWith('/api/capas') ||
          url.pathname.startsWith('/api/puntos'),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'pukara-contenidos-swr',
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24 * 14,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA(CONFIG_PWA_PUKARA),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
