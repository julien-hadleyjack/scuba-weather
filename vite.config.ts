/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages can't set headers, so the policy goes in a <meta> tag. Build only:
// the dev server needs inline styles and a websocket.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: https://tile.openstreetmap.org",
  'connect-src https://api.open-meteo.com https://marine-api.open-meteo.com https://geocoding-api.open-meteo.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// `base` is relative so the build works both at the domain root and under a
// GitHub Pages project path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    {
      name: 'csp',
      apply: 'build',
      transformIndexHtml: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
          injectTo: 'head-prepend',
        },
      ],
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Scuba Weather',
        short_name: 'Scuba Weather',
        description: 'Dive-relevant weather for one dive spot: rain, storms, wind and waves.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#EEF2F5',
        theme_color: '#0A5F86',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only (OFF-1). Forecast data lives in localStorage; map tiles
        // are deliberately not cached (OFF-6).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,svelte}'],
      exclude: ['src/test/**', 'src/**/*.test.ts', 'src/main.ts'],
      reporter: ['text', 'html'],
    },
  },
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
});
