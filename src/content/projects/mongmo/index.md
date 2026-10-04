---
title: "Mongmo"
section: featured
order: 2
category: "Mobile"
year: "2026"
tech: ["React Native", "TypeScript", "Expo", "Supabase"]
role: "Design & development"
context: "Devine (Howest) — Creative Development, React challenge"
description: "A discovery and ordering app for Mongmo, a café in Kortrijk with a food truck that pops up around the city. Find the next pop-up, order ahead for pickup, check in on site and earn rewards — with every point and discount decided on the server."
scope:
  - Pop-up discovery with live occupancy
  - Order ahead with pickup time and live order status
  - QR and geofenced check-ins
  - Photo and dance challenges, points, badges and rewards
  - Owner tools for events, challenges and an order board
  - Supabase schema, row-level security and server-side logic
media:
  screenshot: "./cover.png"
tags: ["Mobile", "Product", "Supabase"]
---

## Overview
Mongmo is a café in Kortrijk that also runs a food truck. The app gives its
regulars one place to follow the truck: see where the next pop-up is and how
busy it is, order ahead from the café or the truck's menu, and collect points
for showing up.

## What I built
- **Ordering** — menu, cart, pickup location and time, checkout and a live
  order status screen that updates in real time.
- **Check-ins** — scanning a QR code at the truck, or a background geofence
  that recognises when you are within reach of a live pop-up.
- **Challenges** — photo challenges with the camera and dance challenges that
  use the phone's motion sensor, feeding points, badges and rewards.
- **Owner side** — creating pop-ups and challenges, and an order board to move
  orders through their statuses.

## Backend
The app reads and writes a real Supabase project: a Postgres schema of
seventeen tables behind row-level security. Points, badges, check-in
verification and order totals run as database functions, so the app can
only ever *ask* whether you earned something — the server decides. Realtime
channels push order updates and pop-up occupancy to the app.

## Native features
Background geofencing, the camera, the photo library, the motion sensor, the
calendar and native date pickers all need native modules, so the app runs as
an Expo development build rather than in Expo Go.
