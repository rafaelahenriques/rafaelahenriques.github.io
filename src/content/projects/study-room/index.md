---
title: "Study Room"
section: featured
order: 5
category: "Real-time 3D"
types: ["web", "interactive"]
year: "2026"
tech: ["Blender 5", "Three.js r186", "WebGPU", "WGSL", "Rapier", "Vite", "TypeScript"]
role: "Solo development, 3D modelling, shader porting, front-end development"
context: "Devine (Howest) — Creative Development"
description: "An interactive isometric study room that responds to local time and weather. Rain runs across the window, following your hand as you drag across the glass. The room combines a custom 3D environment, real-time shaders, physics, and interactive objects."
media:
  live: "https://studywebgl.netlify.app"
  repo: "https://github.com/rafaelahenriques/study-room"
  screenshot: "./media/cover.jpg"
  gallery:
    - "./media/cover.jpg"
    - "./media/room-night.jpg"
    - "./media/room-snow.jpg"
tags: ["WebGPU", "Three.js", "Shaders"]
customPage: true
tagline: "An isometric study room that follows your local time and weather, with a custom 3D environment, real-time shaders, physics and interactive objects."
clip: "/media/clips/study-room.mp4"
---

## The challenge

Port Shadertoy’s Heartfelt rain shader from GLSL to WGSL, integrate it into a Three.js scene, and connect user interaction to the shader.

I expanded the exercise into a complete environment with dynamic lighting, weather effects, animated objects, and physics-based interactions.

## Building the room

I modelled the room and its props in Blender, baked ambient occlusion using Cycles, and exported the scene as a GLB with ten animation clips.

In Three.js, I integrated the model, dynamic lighting, shaders, and physics. Baking only ambient occlusion allowed the lighting to change with the time of day without losing depth and contact shadows.

## Porting the shader

The original shader renders full-screen using a fixed texture. I adapted it to run on the window inside a 3D scene, refracting the environment behind the glass.

The port required translating GLSL to WGSL, adapting texture coordinates, and replacing the fixed input texture with the current viewport texture. Explicit mip-level sampling creates the blur behind the droplets.

```wgsl
// GLSL: float rainAmount = iMouse.z>0. ? M.y : sin(T*.05)*.3+.7;
let rainAmount = select(weatherRain, M.y, iMouse.z > 0.0);

// GLSL: vec3 col = textureLod(iChannel0, UV+n, focus).rgb;
let sampleUV = screenUV + screenU * n.x + screenV * n.y;
var col = textureSampleLevel(iChannel0, iChannel0Sampler, sampleUV, focus * fog).rgb;
```

```ts
const heartfelt = wgslFn(heartfeltShader);
// iChannel0 = what is rendered behind the glass (passed twice: as texture and as sampler)
const iChannel0 = viewportMipTexture();

const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
material.colorNode = heartfelt({
  fragCoord,
  iTime: uniforms.iTime,
  iMouse: uniforms.iMouse,
  iResolution: uniforms.iResolution,
  iChannel0,
  iChannel0Sampler: iChannel0,
  // … the glass mapping, weather, fog and storm uniforms
});
```

A raycast connects pointer input to the shader. Dragging vertically changes the rain intensity, while horizontal movement controls the animation. Releasing the window returns the rain to the current weather conditions.

I also ported a second Shadertoy shader for snowfall, adapting its loop logic and skipping unnecessary calculations when snow is inactive.

A third port turns spilled coffee into ripples. The water simulation renders into a render target and reads its own previous frame, so two targets swap after every step, and the image pass reads the result as `iChannel0`.

## Bringing the room to life

- **Weather and lighting:** Open-Meteo provides weather data, while the sun and interior lights respond to local time and conditions.
- **Interactions:** Rapier powers throwable paper balls and movable books. Other objects trigger animations.
- **Audio:** Music from Audius drives headphone animations through an audio analyser.
- **Monitor:** A canvas-based desktop displays animated applications, including a code editor showing the shader.
- **Sensors:** An optional ESP32 and MQTT integration supports motion and sound input. Hardware testing remains outstanding.

## Things to try

Every object that does something glows when you hover over it, with a short label. *What can I click?* shows all of them at once, and they also appear briefly after the room loads.

- **Easel:** the camera moves to the canvas and you can doodle in the room's colours, with three brush sizes, an eraser and undo. The drawing stays on the easel in your browser and can be saved as a PNG.
- **Mug:** tapping it tips the mug over and spills the coffee into a rippling puddle. A loud noise sends new ripples through it.
- **Calendar:** shows today's date in the room's city. Pressing it flips to the next day, and the light swings through a day change.
- **Globe and chair:** the globe spins once and the chair turns on its swivel.

## Technical decisions

**Dynamic lighting.** I baked ambient occlusion instead of all lighting, preserving the ability to change the room’s atmosphere throughout the day.

**WebGPU compatibility.** Since WGSL requires WebGPU, the application checks browser support and reports an error instead of attempting to run incompatible shaders.

**Failure handling.** I tested the application with weather, music, and AO resources unavailable. The core room and rain interaction continued working, with failures reported in the interface.

## Performance

Measured on an Apple M4 using Chromium 152 with WebGPU, at 1360 × 918 resolution.

No measurable resource growth was observed after 30 paper-ball throws and four object interaction cycles.

## Next steps

- Test the ESP32 sensor and MQTT integration with physical hardware.
- Improve paper-ball accuracy; approximately three in ten throws currently land in the bin.
- Reduce the physics download and test performance on additional hardware.

## Credits

Rain: [Heartfelt](https://www.shadertoy.com/view/ltffzl) by Martijn Steinrucken (BigWings). Snow: Shadertoy [Mdt3Df](https://www.shadertoy.com/view/Mdt3Df). Coffee ripples: [Simple Water Ripple Effect](https://www.shadertoy.com/view/wdtyDH) by Polygon. All three shaders are licensed under [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/). Weather by [Open-Meteo](https://open-meteo.com), music by [Audius](https://audius.co), physics by [Rapier](https://rapier.rs).
