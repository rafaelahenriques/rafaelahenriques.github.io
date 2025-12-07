---
title: "Thrive Beer: 'Play & Unwind' Campaign"
year: "2025"
tech: ["Astro", "GSAP",  "Motion Design"]
role: "Creative Developer"
context: "Concept Campaign (Academic Brief)"
scope:
  - Scrollytelling Animation System
  - Performance Optimization (Core Web Vitals)
  - Responsive Component Architecture
description: "A high-performance digital campaign site designed to reposition Thrive Beer from a niche sports drink to a broader lifestyle brand. Built with Astro for speed and GSAP for immersive storytelling."
media:
    screenshot: "./home.png"
    gallery:
    - "./home.png"
    - "./pack.png"
    - "./ritual.png"
tags: ["Web Dev", "GSAP", "Astro", "Campaign", "Design"]
---

## The Challenge
**Thrive Beer** is a market leader in the sports recovery segment with their "Peak" beer. However, the brief challenged us to introduce two new varieties—**Thrive Play** and **Thrive Unwind IPA**—to a broader audience.

The goal was to shift perception: moving the brand from "post-marathon recovery" to "everyday healthy lifestyle." The campaign needed to target 25-45-year-olds in Flanders who value health, social engagement, and balance.

## The Solution: "Active Balance"
I designed and developed a mobile-first campaign site that uses motion to visualize the energy shift between the two products.
* **Thrive Play:** Represented by high-energy, dynamic animations.
* **Thrive Unwind:** Represented by slower, calming flow animations.

## Technical Highlights

### 1. Astro for Campaign Performance
Campaign sites often rely on paid social traffic (Instagram/Facebook ads), meaning most users arrive on mobile devices. Speed is critical.
* **Zero JavaScript Default:** I chose **Astro** to render the site as static HTML by default.
* **Partial Hydration:** I only loaded JavaScript for the interactive elements (the GSAP animations), keeping the Time to Interactive (TTI) near instant.

### 2. GSAP Scrollytelling
To educate the user on the "Functional Ingredients" (the brand's USP), I used **GSAP ScrollTrigger**.
* As the user scrolls, the beer can deconstructs, visually highlighting ingredients like vitamins and protein.
* This turns a boring "nutrition facts" list into an engaging visual narrative.

### 3. Accessible Motion
While the site is heavy on motion, I implemented a check for the user's system preferences.
```javascript
// If user prefers reduced motion, jump to end state immediately
let matchMedia = gsap.matchMedia();
matchMedia.add("(prefers-reduced-motion: no-preference)", () => {
  // .. run complex animation
});
```
## Result

A visually immersive experience that bridges the gap between online engagement and real-world tasting. The site successfully communicates the "Healthy Hedonism" lifestyle while maintaining a lighthouse performance score of 95+.

