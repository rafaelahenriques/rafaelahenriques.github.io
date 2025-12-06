---
title: "Howl's Game"
year: "2021"
tech: ["Python", "AI"]
role: "Gameplay Programmer"
context: "Team of 3 (University Project)"
scope:
  - Artificial Intelligence (Single Player)
  - Game Loop Logic
  - Win/Loss Condition State Machine
description: "A digital adaptation of the classic strategy board game 'Wolf and Sheep'. "
media:
  repo: "https://github.com/bryanb619/HowlsGame"
  screenshot: "/src/assets/howls/start.png"
  gallery:
    - "/src/assets/howls/start.png" 
tags: ["Unity", "AI", "Board Game"]
---

## Overview
Howl's Game is a digital implementation of the asymmetric abstract strategy game *Wolf and Sheep* (often known as Fox and Hounds). 

The game is played on an 8x8 checkerboard. The player controls the **Sheep** (aiming to reach the top row), while the opponent controls **4 Wolves** (aiming to surround and block the sheep).

## Key Technical Contributions

### 1. The Artificial Intelligence (AI)
My primary contribution was the single-player mode. I programmed the "brain" for the computer opponent when playing as the Wolves.
* **Decision Making:** The AI analyzes the board state to calculate the best move to block the sheep.
* **Coordination:** Since the AI controls 4 units, I had to write logic ensuring they work as a pack rather than moving randomly, prioritizing "walls" to trap the player.

### 2. Core Game Loop & Rules
I implemented the strict rules engine that governs the gameplay:
* **Turn Management:** Enforced the "Sheep moves first" rule and alternating turns.
* **Movement Validation:** Restricted movement to diagonal steps only (like checkers).
* **Win Condition Checks:** Written algorithms to check the board state after every move:
    * *Did the Sheep reach row 8?* (Sheep Win)
    * *Is the Sheep unable to move?* (Wolf Win)

### 3. Game Modes
I implemented the architecture to support two distinct modes using a shared codebase:
* **PvP (Hotseat):** Two human players taking turns on the same device.
* **PvAI:** One human player vs. my Computer script.

## Challenges & Learnings
* **Asymmetric Balance:** Unlike chess where pieces are equal, this game is asymmetric. Debugging the AI was difficult because I had to ensure the computer didn't just make *legal* moves, but *smart* blocking moves.
* **State Management:** Tracking the positions of 5 different distinct pieces on a grid and refreshing the UI without desyncing the internal data board.

## Result
A fully functional strategy game where the computer poses a genuine challenge to the player.