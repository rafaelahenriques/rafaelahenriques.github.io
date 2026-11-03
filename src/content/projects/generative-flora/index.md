---
title: "Generative Flora"
section: featured
order: 4
category: "Real-time 3D"
types: ["web", "interactive"]
year: "2026"
tech: ["TypeScript", "Three.js", "GLSL", "ml5.js HandPose", "Zustand", "GSAP", "Vite", "Vitest"]
role: "Design and development"
context: "Personal project"
description: "A 3D plant you grow with your hands. Set a climate or choose a real place, and a climate model picks which of eight real species could live there. Pinch your fingers to move it through its growth stages, and move your palm to scan its x-ray in colour."
media:
  live: "https://rafaelahenriques.github.io/virtualplant/"
  repo: "https://github.com/rafaelahenriques/virtualplant"
  screenshot: "./media/cover.jpg"
  thumbnail: "./media/thumb.jpg"
tags: ["Three.js", "GLSL", "Hand tracking"]
customPage: true
clip: "/media/clips/generative-flora.mp4"
tagline: "A 3D plant you grow with your hands: set a climate or choose a real place, and a climate model picks which of eight real species could live there."
---

## Climate decides the plant

Four real-world measurements decide which species grows: temperature during the growing season, relative humidity, rainfall and direct sun.

Each species has a minimum, an optimal range and a maximum for every factor. A factor scores 1 inside the optimal range, 0 outside the limits, and falls in a straight line between. The plant’s score is its worst factor, because a plant does only as well as its limiting condition allows. This is the limiting-factor approach used by FAO’s EcoCrop model, and the highest score wins.

If every species scores 0, the closest one stays on show and the interface says it would not survive there, so you never have to get every value right to see a plant. While a slider moves, the plant on show stays until another fits at least 10 points better, so it doesn’t keep swapping between plants that fit about equally well.

Each species file holds its full ranges and its sources, such as FAO EcoCrop, Flora of North America, the American Orchid Society and NASA, and marks each factor as published or derived. Derived means the sources describe the habitat rather than give a number, so the range is worked out from that habitat’s climate. Those are informed estimates.

## Eight real species

Every plant is built in code to its published description, in real centimetres, with no 3D model files. A trillium has three bracts, three sepals and three petals, an arctic poppy has four petals and drops its two sepals as it opens, and a sunflower’s disc florets sit on the golden angle and open from the rim inwards.

Unit tests check these counts and sizes. They also check that each species has one real place, from Tucson to Svalbard, and that the place gets the species it is known for.

Plants of the same species all look the same.

## Pinch to grow

Growth changes the plant’s form, not its size. Spreading your thumb and index finger moves it forward through its stages, and closing them plays the stages back in reverse. Each species does this in its own way: a poppy bud nods then lifts as it opens, and an orchid opens its lowest flower first.

The camera follows the growth, starting close on the seedling and settling on the flower, so the plant’s real proportions stay intact. A scale bar shows how large it really is.

No model training is involved. ml5 HandPose is already trained and returns 21 landmarks per hand. A pinch is the distance between two of them, divided by palm length so it reads the same near or far from the camera. With no hand in view, the plant holds its current stage.

## Scan window

Outside the scan window the plant is an x-ray. Inside it, the same plant at the same growth stage renders as a solid flower in colour. The window follows the centre of your palm, which stays still while your fingers pinch, so one hand controls growth and position at once.

The scene is drawn twice each frame: the x-ray across the whole screen, then the colour look clipped to the window with a scissor test. The x-ray is drawn at a lower resolution, and each frame is blended into the ones before it, so thin tissue doesn’t flicker as it sways from one pixel to the next.

The visual direction is plants as x-ray specimens under machine observation. The interface stays monochrome, so colour only ever appears inside the window.

## Architecture

Gestures never touch rendering directly. Tracking only reports what the hands are doing, the interaction layer turns that into changes to growth and the scan window, and the renderer reads from the store.

The camera is only used on your device. Video frames go to the hand model in your browser and are never sent anywhere. The hand tracking library and model download only when you first press Start hand tracking, about 9 MB, and the model comes from Google’s TensorFlow Hub, so Google sees that request as it would any download.

Each push to main is checked and deployed through GitHub Actions and GitHub Pages.

## Loading

The loading screen reports real work as it happens: your graphics hardware, the triangles built for each species, the shaders compiled and whether a camera is present. The numbers on it are measured, and each line stays up long enough to read. The camera stays off throughout.

A stippled flower sharpens from coarse blocks to fine dots as loading progresses, then a scan line sweeps down to uncover the live page and the plant grows in from a seedling. With reduced motion turned on, the sweep and the growing in are skipped.

## Credits

The music is “Vestige” by Lennon Hutton, licensed from Epidemic Sound. It stays off until you press the button, and nothing downloads until then. The code is MIT licensed.
