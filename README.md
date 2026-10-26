# rafaelahenriques.com

Source code for my portfolio: [rafaelahenriques.com](https://rafaelahenriques.com).

It's a static Astro site with GSAP for motion, deployed on Cloudflare Workers. Every project is a Markdown entry in a typed content collection, so adding a case study means adding a folder rather than writing a new page.

## Features

- Project case studies generated from `src/content/projects/*/index.md`, validated by a Zod schema in `src/content.config.ts`
- A 3D Game Boy on the home page (three.js) that plays each selected project on its screen, with working buttons
- A projects index shown as an arcade cabinet whose screen flips through the projects (sticks and buttons work), or as a list or grid, with a type filter
- Pixel edges where the page dissolves into the dark blocks (footer, next project, the arcade)
- A command menu for searching projects, pages and contact actions
- GitHub numbers on the about page (commits, contributions, most used languages, the last year day by day), refreshed from GitHub's public data before every build (`scripts/github-stats.mjs`)
- Light and dark themes, and animations that respect reduced-motion settings
- A script that generates typographic cover images for projects without screenshots yet (`scripts/build-covers.mjs`)

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run check    # Astro and TypeScript diagnostics
```

## Structure

| Path | Contents |
|---|---|
| `src/pages/` | Home, about, projects index, project detail and 404 routes |
| `src/content/projects/` | One folder per project: Markdown plus images and videos |
| `src/components/` | The home page Game Boy, the projects arcade, pixel edges, chapters, lightbox, command menu, header and footer |
| `src/scripts/` | GSAP animations, the Game Boy and arcade scenes (`gameboy.ts`, `arcade.ts`) and the pixel edges (`pixels.ts`) |
| `wrangler.jsonc` | Cloudflare Workers static-assets deployment |

## Credits

- Game Boy model: [“GAME BOY in voxel”](https://sketchfab.com/3d-models/game-boy-in-voxel-0a99ab3b9cac4bdeacc90118df63a8c9) by Dani, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Split into parts and exported for the web; in `public/models/gameboy.glb`.
- Arcade model: [“Arcade Invaders”](https://sketchfab.com/3d-models/arcade-invaders-8c96ac36c52e4cf2a33cf605bd762014) by tef, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Split into parts, its artwork replaced with my own and restyled; in `public/models/arcade.glb`.
