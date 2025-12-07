---
title: "UI Game Menu Mock Assets"
year: "2024"
tech: ["Photoshop", "Graphic Tablet"]
role: "UI Artist & Designer"
context: "Standalone Asset Kit"
scope:
  - Component Hierarchy
  - Button States (Hover/Active)
  - Color Theme Systems
description: "A comprehensive UI kit for a hypothetical game. I designed and illustrated the assets from scratch in Photoshop, focusing on modularity, affordance, and implementation-readiness."
media:
  screenshot: "./mainUi.png"
  gallery:
    - "./mainUi.png"
    - "./pause.png"
    - "./ColourVariation.png"
tags: ["UI", "Design", "Photoshop", "Game Dev"]
---

## Overview
This project is a high-fidelity User Interface (UI) kit designed for a hypothetical game. The goal was to create a cohesive visual language that covers the essential game states: **Start Menu**, **Settings Panel**, and **Pause Overlay**.

Unlike standard "concept art," these assets were built with implementation in mind—ensuring they could be easily sliced and exported for a game engine like Unity or Unreal.

## Design Philosophy
My approach focused on clarity and modularity. I didn't want to just make "pretty pictures"; I wanted to build a functional system.

* **Hierarchy & Readability:** I used size, contrast, and spacing to ensure the primary actions (like "Play" or "Resume") draw the eye first, preventing user confusion.
* **Affordance:** Buttons look clickable. Panels look distinct from the background. I designed specific visual states (Hover, Pressed, Disabled) to ensure the UI feels responsive to user input.
* **Thematic Consistency:** The design uses a unified color palette and shape language (rounded corners, specific border weights) to maintain visual glue across different screens.



## Technical Workflow
I used **Adobe Photoshop** and a **Graphic Tablet** to hand-draw and assemble the vector shapes.

* **Non-Destructive Editing:** All assets are built using Vector Smart Objects and Shape Layers. This means they can be scaled up or down without pixelating—crucial for supporting different screen resolutions (1080p vs 4k).
* **Developer-Ready Organization:** The PSD is structured logically. Buttons, panels, and text are grouped into named folders. This organization mimics the structure a frontend developer would use in CSS or Unity Canvas, making the "hand-off" from design to code seamless.
* **Theme Variations:** I utilized Adjustment Layers to create rapid color variations, demonstrating how the UI could adapt to different biomes or game modes (e.g., "Dark Mode" or "Forest Theme").

## Why this matters
As a developer, understanding how UI assets are created allows me to:
1.  Communicate better with artists.
2.  Structure my code (CSS/Unity UI) to match the modularity of the design.
3.  Bridge the gap between a static design file and a dynamic, responsive application.

## Result
A production-ready UI asset pack that balances aesthetic appeal with technical practicality.