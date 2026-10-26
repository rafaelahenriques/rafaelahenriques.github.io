// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    // canonical address, used for absolute URLs (share previews, sitemap)
    site: 'https://rafaelahenriques.com',
    // code blocks take their colours from the site's tokens (global.css)
    markdown: { shikiConfig: { theme: 'css-variables' } },
    // dev server: 4321 unless a port is handed in (e.g. a second preview copy)
    server: { port: Number(process.env.PORT) || 4321 },
    // start loading a page as soon as a link to it is hovered or tapped
    prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
    // three.js for the home page Game Boy is one ~630 kB chunk (160 kB gzipped),
    // loaded only when the Game Boy comes near the screen
    vite: { build: { chunkSizeWarningLimit: 700 } },
    // sitemap-index.xml for search engines (the 404 page stays out)
    integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
});
