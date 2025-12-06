---
title: "Howl's Game"
year: "2021"
tech: ["Unity", "C#", "Pixel Art"]
role: "Gameplay & UI Programmer"
context: "Team of 3 (Game Jam/University Project)"
scope:
  - Resource Management Systems (Energy)
  - UI State Machine
  - Parallax Backgrounds
description: "A pixel-art platformer inspired by 'Howl’s Moving Castle'."
media:
  repo: "https://github.com/bryanb619/HowlsGame"
  screenshot: "/src/assets/howls/start.png"
  gallery:
    - "/src/assets/howls/start.png" 
tags: ["Unity", "Platformer", "Game Design"]
---

## Overview
**Howl's Game** is a 2D pixel-art platformer where the player controls Sophie. The objective is to navigate through hostile environments filled with "Blob" enemies to reach Howl.

Unlike standard platformers where you can shoot indefinitely, this game features a **Risk vs. Reward** combat system. The player has a limited "Energy" pool (represented by Calcifer). Using magic to destroy blobs drains this energy. If you run out of energy, you cannot fight.

## Key Technical Contributions

### 1. The "Calcifer" Resource System
I programmed the core mechanic that links Combat to Resource Management.
* **The Logic:** I created a `PlayerStats` class that manages the current Energy values.
* **The Trade-off:** Every time the player inputs the "Attack" command, the script checks `if (currentEnergy > attackCost)`. If true, it spawns the projectile and subtracts energy. If false, the UI flashes red, and the attack fails.
* **Balancing:** This forced players to choose between *fighting* (safe but expensive) or *dodging* (risky but free).

### 2. Parallax & Pixel Art Rendering
To bring the pixel art world to life, I implemented a generic Parallax System that works with any number of layers.
* **Camera Tracking:** The background layers track the camera's X position but move at a fraction of the speed (`cam.position.x * parallaxFactor`).
* **Depth Illusion:** Mountains move at `0.1x` speed, while foreground trees move at `0.5x` speed, creating a deep 3D effect in a 2D game.



### 3. "Sophie Against Time" (Game Modes)
I implemented a secondary Hard Mode called "Sophie Against Time."
* **Logic:** I built a `GameTimer` system that counts down from a set float value using `Time.deltaTime`.
* **State Management:** When the timer hits zero, a Global Event triggers the "Game Over" state, stopping player input and summoning the defeat UI screen.

### 4. UI Architecture
Since the game relies heavily on Energy and Time, the UI needed to be responsive.
* Instead of checking values every frame (Update loop), I used **C# Events**.
* When `currentEnergy` changes, the `PlayerStats` script fires an event: `OnEnergyChanged`. The UI bar listens for this event and updates the slider only when necessary. This is much more performant.

## Result
We delivered a polished, playable prototype with two distinct game modes. The project taught me how to balance gameplay mechanics—specifically, how to make resources feel scarce but fair.