---
title: "Shattered Soul: A Zodiac Mystery"
year: "2022"
tech: ["Unity", "C#", "Maya", "3D Modeling"]
role: "Project Lead & Gameplay Programmer"
context: "Team of 3 (University Project)"
scope:
  - First-Person Controller (Physics)
  - Interaction System (Raycasting)
  - Asset Pipeline (Maya to Unity)
  - Project Management (GitHub)
outcome: "Playable Vertical Slice"
description: "A first-person puzzle RPG set in a mysterious Greek temple."
media:
  video: ""
  repo: "https://github.com/bryanb619/Shattered-Soul-Stable"
  screenshot: "/src/assets/ss/main.png"
  gallery:
    - "/src/assets/ss/main.png"
    - "/src/assets/ss/ss.png"
    - "/src/assets/ss/ss2.png"
tags: ["Unity", "C#", "3D", "Game Design"]
---

## Overview
**Shattered Soul** is a first-person exploration and puzzle game built in Unity. 

The narrative follows a protagonist who wakes up in a ruined Greek temple with no memory of who they are. The gameplay loop is centered on exploration: the player must locate zodiac-themed artifacts and solve environmental puzzles. Each success unlocks a fragment of the character's lost memory.

## My Role: Project Lead & Tech
As the lead for a team of three, I wore two hats: **Systems Programmer** and **Pipeline Manager**.

### 1. The Interaction System
Since this is a puzzle game, the player needs to pick up, rotate, and inspect objects. I implemented a **Raycast-based interaction system**.
* **Raycasting:** A ray is fired from the center of the camera every frame.
* **Layer Masks:** The ray only interacts with objects on the "Interactable" layer, ensuring the player doesn't accidentally click on walls or the floor.
* **UI Feedback:** When the ray hits a puzzle object, a dynamic UI reticle appears, signaling the player can interact.



### 2. Physics & Movement
I built a custom First-Person Controller using Unity's physics engine (`Rigidbody`).
* Instead of using the default `CharacterController`, I used physics forces to move the player.
* This allowed for more realistic interactions with the environment (e.g., pushing debris out of the way) and gave the movement a "weighty" feel appropriate for an atmospheric game.

### 3. The Asset Pipeline (Maya to Unity)
We modeled our own 3D assets (pillars, statues, puzzle pieces) using **Autodesk Maya**. I was responsible for the integration pipeline:
* Ensuring pivot points were centered correctly in Maya before export.
* Setting up colliders (Mesh Colliders vs. Box Colliders) in Unity.
* Creating Prefabs for reusable assets so level designers could drag-and-drop them without breaking logic.

## The Design: Zodiac Puzzles
We implemented two core puzzles based on Zodiac signs.
* **The Concept:** The environment itself was the puzzle. The player had to find objects representing specific constellations and place them on pedestals to trigger door mechanisms.
* **The Tech:** I wrote the C# logic that checked the "Victory Condition"—detecting if specific objects (by Tag) were inside specific Trigger Volumes.

## Result
We delivered a "Vertical Slice"—a polished, playable segment of the game that demonstrates the core mechanics, visuals, and narrative tone. This project taught me the importance of a clean GitHub repository and how to manage merge conflicts when artists and programmers work on the same scene.


