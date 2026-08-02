import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

/**
 * Short commit the build came from, shown in the footer so a reported problem
 * can be traced to exact code. Cloudflare Pages sets CF_PAGES_COMMIT_SHA on
 * every deploy; locally we ask git; a bare source copy reports "dev".
 */
function buildSha(): string {
  const fromPages = process.env.CF_PAGES_COMMIT_SHA;
  if (fromPages) return fromPages.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  plugins: [
    react(),
    /**
     * Race meets happen in fields with no signal. The app has no backend, so
     * once its files are on the device everything works offline -- but the
     * plain HTTP cache expires assets after four hours, and a cold open past
     * that window with no coverage fails to load at all. Precaching the whole
     * build (about 1.2 MB) removes that cliff.
     *
     * registerType 'prompt', never 'autoUpdate': a new version must not swap
     * itself in under a secretary who is part-way through scoring a meet.
     * UpdatePrompt offers it and they choose the moment.
     */
    VitePWA({
      registerType: 'prompt',
      workbox: {
        // Covers the favicons and PWA icons too, so no `includeAssets` -- listing
        // them there as well puts every icon in the precache manifest twice.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Single-page app: any unknown path resolves to the shell, mirroring
        // the `/*  /index.html  200` rule in public/_redirects.
        navigateFallback: 'index.html',
        // The bundle is ~1.1 MB, over Workbox's 2 MiB default only if it grows
        // a lot, but be explicit so a future dependency does not silently drop
        // the main chunk from the precache.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'AOK9 Race Secretary',
        short_name: 'AOK9',
        description: 'Run an AOK9 sprint race meet: entries, draw, scoring and reports. Works offline.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#fafbfc', // --bg
        theme_color: '#171f2e',      // --primary
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // Android crops icons to its own shape; the maskable copy keeps the
          // artwork inside the safe zone so nothing important is clipped.
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Leave `npm run dev` alone -- a service worker caching during development
      // is a reliable way to spend an hour debugging a stale bundle.
      devOptions: { enabled: false },
    }),
  ],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(buildSha()),
  },
});
