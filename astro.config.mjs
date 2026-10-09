// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    // canonical address, used for absolute URLs (share previews, sitemap)
    site: 'https://rafaelahenriques.com',
    // code blocks take their colours from the site's tokens (global.css)
    markdown: { shikiConfig: { theme: 'css-variables' } },
    // dev server: 4321 unless a port is handed in (e.g. a second preview copy)
    server: { port: Number(process.env.PORT) || 4321 },
});
