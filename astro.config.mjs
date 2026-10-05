// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    // canonical address, used for absolute URLs (share previews, sitemap)
    site: 'https://rafaelahenriques.com',
    // code blocks take their colours from the site's tokens (global.css)
    markdown: { shikiConfig: { theme: 'css-variables' } },
});
