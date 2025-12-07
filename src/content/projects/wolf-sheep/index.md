---
title: "Wolf & Sheep"
year: "2021"
tech: ["Python", "Game Development", "Algorithmic Logic"]
role: "Core Logic & Rules Engine"
context: "Team of 3 - Academic Project"
scope:
  - Movement validation algorithms
  - Game state management
  - PvE (Player vs Environment) Loop
description: "A digital adaptation of the asymmetrical strategy board game. I architected the core rule enforcement, movement validation system, and the integration of the single-player AI loop."
media:
  repo: "https://github.com/rafaelahenriques/Wolf-and-Sheep-Game"
  screenshot: "./wolfsheepmenu.png"
  gallery:
    - "./wolfsheepmenu.png" 

tags: ["Python", "Game Logic", "AI Integration", "Strategy", "Game Dev"]
---

## Overview
**Wolf & Sheep** is an asymmetrical strategy game played on an 8x8 checkerboard. Unlike traditional games like Chess or Checkers where forces are equal, this game relies on disparate goals and capabilities:
* **The Sheep (1 Unit):** Starts at the bottom. **Goal:** Reach one of the four top-row squares.
* **The Wolves (4 Units):** Start at the top. **Goal:** Surround the sheep so it has no legal moves remaining.

The project supports both **2-Player Local** (Hotseat) and **Single Player** (User vs. AI) modes.

## My Contribution
My role focused on the "Brain" of the game—ensuring that the rules were enforced strictly and that the game state updated correctly after every interaction.

### 1. Movement Validation Engine
I replaced basic coordinate checking with a robust validation system using an $(x, y)$ grid system:
* **Directional Logic:** Hard-coded the movement deltas.
    * *Sheep:* Can move `(x+1, y+1)`, `(x-1, y+1)`, `(x+1, y-1)`, or `(x-1, y-1)`.
    * *Wolf:* Can only move "forward" relative to their start `(x+1, y+1)` or `(x-1, y+1)`.
* **Boundary & Collision:** Implemented checks to ensure `0 <= x <= 7` and that no unit could land on a tile occupied by another wolf or the sheep.

### 2. Game State & Victory Conditions
I developed the logic to detect end-game states instantly:
* **Sheep Victory:** Triggered immediately when the Sheep's Y-coordinate equals `0` (the top row).
* **Wolf Victory (The Trapping Algorithm):** This was the most complex logic. The game calculates all 4 potential moves for the sheep; if all 4 result in either a collision or an out-of-bounds error, the Wolves are declared winners.

### 3. The AI Integration (PvE)
I implemented the game loop that handles the Single Player experience.
* **Turn Management:** The system enforces the "Sheep Starts First" rule.
* **The AI Handoff:** When the user (Sheep) finishes a move, my logic locks user input, passes the board state to the AI function to calculate the optimal Wolf move, updates the board, and then unlocks user input again.

## Logic Snippet
Here is a simplified representation of the movement validation logic I implemented:

```python
def is_move_legal(piece, current_pos, target_pos, board_state):
    # 1. Check if target is inside the 8x8 board
    if not (0 <= target_pos.x < 8 and 0 <= target_pos.y < 8):
        return False

    # 2. Check if the move is a valid diagonal step
    dx = target_pos.x - current_pos.x
    dy = target_pos.y - current_pos.y

    if abs(dx) != 1 or abs(dy) != 1:
        return False # Must move exactly one square diagonally

    # 3. Check for specific unit constraints
    if piece.type == "WOLF" and dy < 0:
        return False # Wolves cannot move backwards

    # 4. Check collision
    if board_state[target_pos] is not None:
        return False # Tile is occupied

    return True
```
## Challenges & Solutions
**Challenge:** Handling the four wolves as a single "Player." 

**Solution:** In the standard turn logic, a player usually moves "their piece." Since the Wolf player has 4 pieces, I had to create a two-step selection state:

1. Select a specific Wolf unit.

2. Validate if that specific wolf has legal moves available before locking in the selection.

## Learnings
This project deepened my understanding of ` Object-Oriented Programming`  in Python, specifically how to separate Game Logic (The Rules) from Game Rendering (The UI), ensuring that the code is clean, testable, and modular.