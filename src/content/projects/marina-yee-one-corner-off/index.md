---
title: "Marina Yee — One Corner Off"
section: featured
order: 4
status: in-progress
category: "Creative Development"
types: ["web", "interactive"]
year: "2026"
tech: ["Vite", "JavaScript", "GSAP", "CSS"]
role: "Design & development"
context: "Devine (Howest) — Integration 3, for MoMu Antwerp"
description: "An interactive, scroll-driven longread designed and developed for MoMu, the Fashion Museum Antwerp."
media:
  live: "https://momu-marina-yee.netlify.app"
  screenshot: "./media/card.jpg"
  gallery:
    - "./media/card.jpg"
    - "./media/site-cover.png"
    - "./media/still-beyond.jpg"
    - "./media/site-film.png"
tags: ["Creative Development", "GSAP", "Editorial"]
customPage: true
---

## The project
Marina Yee is usually introduced as one of the Antwerp Six. One Corner Off moves away from that label and focuses on how she worked: reconstructing existing garments, keeping what mattered and changing only what needed to change.

The title comes from an expression Yee used to describe her process: make something feel finished, then deliberately disturb it.

That idea became the basis for both the design and development of the longread. Throughout the site, finished compositions are cut, unfolded, shifted or taken apart. By the end, the reader is invited to do the same.

## The challenge
The main challenge was turning research about reconstruction, reuse and restraint into an experience that still felt like a museum publication without becoming a wall of text.

Motion also had to serve the story. Instead of adding animations after designing the page, I treated interaction as part of the editorial structure. If an animation did not communicate something, it did not need to be there.

At the same time, the site had to remain responsive, accessible, readable without JavaScript and usable with reduced motion.

## Finding the visual direction
The design changed significantly during the project.

Early versions explored editorial collage, monochrome layouts, cursor interactions and more traditional fashion-editorial compositions. After several rounds of critique, I stopped evaluating each redesign as a complete direction and looked instead at which sections were actually working.

Four stood out: the cover, the horizontal Beyond Sustainability chapter, a paragraph that turns over line by line, and the final Look Closer spread.

They shared oversized typography, strong contrast, physical-looking images, restrained colour and layouts somewhere between a fashion publication, an archive and a working notebook. Those elements became the visual system for the rest of the site.

## Visual system
The longread alternates between two types of pages. Black spreads use oversized condensed typography, justified text and floating photographic prints. Paper-coloured pages are quieter and give longer passages more room to breathe.

The site uses the variable typeface Archivo. Its width and weight axes let the same family move between condensed display typography and normal reading text. Reenie Beanie is used sparingly for handwritten annotations.

The palette is almost entirely black, paper and white, with biro blue for annotations and red for paper clips.

Photographs are treated like physical objects, with white borders, shadows, small rotations and occasional SVG paper clips. Scanned pen marks are recoloured through SVG filters to work on both light and dark backgrounds.

Colours and typography are controlled through CSS tokens, while dark sections switch theme values through a `data-theme` attribute.

## One Corner Off
The opening introduces the central idea immediately.

The title fills the screen before one corner is cut away. The missing piece drops from the composition and can be picked up and thrown with the cursor. As the reader leaves the cover, the words and photographs begin drifting apart.

Instead of explaining “one corner off” first, the page performs it.

## Moving away from the spotlight
The story begins with Yee’s connection to the Antwerp Six, then deliberately moves away from it.

In a pinned section, THE ANTWERP SIX initially fills a spotlight. As the reader scrolls, the spotlight moves into the distance and Yee’s actual practice comes into view around it: garments, drawings, studio images and working material.

The interaction turns the sentence “move away from the spotlight, and her practice becomes easier to see” into something the reader physically does.

## Working with what was already there
Yee frequently worked from existing garments, so I designed this chapter as an index of looks rather than a conventional gallery.

Four garment categories appear as oversized outlined typography. Selecting one fills its title and reveals the corresponding garment, description and details.

The controls are real radio inputs. CSS handles the visual state, while JavaScript only controls which content is shown. On larger screens, CSS subgrid lets the index, description and garment share the same structure.

## Text as movement
In one chapter, two paragraphs occupy the same space. As the reader scrolls, each line rotates in 3D to reveal the corresponding line of the second paragraph on its reverse side.

Elsewhere, a sentence about repair, reuse and upcycling becomes an oversized marquee. Individual letters move between font weights as they cross the screen by animating Archivo’s variable weight axis.

Typography becomes part of the storytelling rather than something sitting on top of it.

## M.Y. Project
The M.Y. Project chapter presents seven garments one at a time inside the same frame.

As the section is pinned, each piece wipes upward over the previous one while its name rolls into place beside it. The counter is calculated from the animation timeline, keeping the text, image and numbering synchronised.

The section gradually transitions to black, which continues directly into the next chapter.

## Beyond sustainability
The discussion of sustainability becomes a horizontal chapter containing five full-screen panels.

Each panel reveals as it enters the viewport, while archive images move independently across the composition. At the end, the bottom corner of the final page breaks away and falls, repeating the visual idea introduced on the cover.

## The main interaction: folding the page
The final interaction gives the reader control over the idea behind the story.

A finished black page labelled ALREADY FINISHED covers a photograph of an M.Y. field jacket worn over a shirt assembled from scraps. The reader can grab the page’s corner and fold it backwards, revealing as much or as little of the garment underneath as they choose.

Once the page has been opened far enough, the message changes:

> That is the whole method. Something was already there, you decided where to change it, and both are still visible.

Unlike most of the site’s motion, the fold is written entirely in vanilla JavaScript.

The page corner and pointer position define the fold. A Sutherland–Hodgman clipping operation calculates which part of the original page remains visible, while the removed polygon is reflected across the crease to create the folded flap. CSS handles the shading, reverse of the paper and shadow.

The fold position is stored relative to the page dimensions, so it survives resizing without jumping.

It also works without a pointer. The corner behaves as an ARIA slider and can be controlled with the arrow keys, Home and End. Reduced-motion users keep the interaction itself, but without the easing between states.

## Progressive enhancement
The HTML contains the complete story. JavaScript enhances it rather than making it readable.

Without JavaScript, the garment picker displays every look, the M.Y. Project becomes an image grid, the horizontal chapter becomes vertical and the folding page becomes a static composition with a cut corner.

`prefers-reduced-motion` is checked before the GSAP modules are dynamically imported. Accessibility also influenced how components were built from the beginning: real form controls, keyboard interactions, visible focus states, alt text, live regions and decorative elements removed from the accessibility tree.

## Managing scroll-based animation
The project contains six pinned ScrollTrigger sections. Because pinning changes the total scroll distance of the page, the order in which those sections are measured matters.

Pins are initialised from top to bottom with explicit refresh priorities. Text-dependent animations wait for `document.fonts.ready`, and the page is measured once everything affecting layout is ready.

This also influenced design decisions. The garment picker, for example, keeps a consistent height regardless of the selected look because changing its height would shift every pinned animation below it.

A large part of building the site was learning that reliable scroll animation depends as much on stable layout as it does on animation code.

## Tooling and performance
I built two image-processing workflows for the project.

`npm run images` uses Sharp to generate responsive WebP versions of the photography, with `srcset`, `sizes` and lazy loading.

`npm run cutouts` processes Yee’s studio photographs into transparent garment cutouts. It flood-fills from the edges to identify the neutral background while preserving details such as the soft floor shadow.

The project also has a quality check that runs ESLint, Stylelint, Prettier and a production build before changes are committed.

The initial JavaScript bundle is approximately 11.7 KB (4.6 KB gzipped) and the CSS 40.6 KB (8.7 KB gzipped). GSAP and its plugins load separately and only when motion is enabled, keeping roughly 64.6 KB gzipped out of the initial JavaScript path for reduced-motion users.

## What I learned
The biggest lesson was not technical.

During critique, deciding whether an entire design direction was “good” or “bad” was not particularly useful. Identifying the individual sections that worked was much more productive. Once I understood what those sections had in common, I had the beginnings of a design system.

Technically, the project changed how I approach animation-heavy websites. Small layout inconsistencies become large problems once several sections depend on scroll position. Stable dimensions, predictable loading and clear ownership between CSS and JavaScript matter as much as the animation itself.

Most importantly, the strongest interaction came directly from the subject. The folding page works because it is not an effect added to make the project more interactive. It gives the reader Yee’s method: start with something that already exists, decide where to intervene, and leave both the original and the change visible.

## Next steps
The next stage is testing the deployed experience on physical devices, particularly iOS Safari, followed by a complete VoiceOver and NVDA pass.

I also plan to measure Core Web Vitals on the production build and refine image loading around the opening section.
