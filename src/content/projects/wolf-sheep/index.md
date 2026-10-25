---
title: "Wolf & Sheep"
section: featured
order: 1
category: "Full-stack"
types: ["web", "fullstack", "interactive"]
year: "2026"
tech: ["Python", "FastAPI", "PostgreSQL", "SQLAlchemy", "Alembic", "React", "TypeScript", "Vite", "pytest"]
role: "Full-stack developer"
context: "Independent rebuild of a university group project"
description: "From university project to full-stack app: a Pygame group project rebuilt on my own around a pure Python game engine shared by the desktop game, a FastAPI backend and the tests — with a minimax AI, a React web client and game history in PostgreSQL."
scope:
  - Pure Python game engine, shared by every client
  - Server-authoritative game state
  - Minimax AI with alpha-beta pruning
  - PostgreSQL game history with Alembic migrations
  - 31 pytest tests across engine, AI, database and API
  - Deployed on Render (API) and Netlify (frontend)
media:
  repo: "https://github.com/rafaelahenriques/Wolf-and-Sheep-Game-main"
  live: "https://wolfandsheepgame.netlify.app"
  video: "https://vimeo.com/1233170503"
  screenshot: "./cover.jpg"
  gallery:
    - "./cover.jpg"
    - "./startscreen.png"
    - "./statistics.png"
tags: ["Full-stack", "Python", "API", "Game Logic"]
customPage: true
---

## Origin
Wolf & Sheep started as a university group project built in Python with Pygame. I was responsible for the board, the main game file, the menu and the overall code structure.

After the course, I continued the project independently. I restructured the original prototype, separated the game logic from the interface, built an AI opponent, exposed the game through an API, created a web version and added persistent data and deployment.

This case study focuses on that independent rebuild.

## The game
Wolf & Sheep is a turn-based strategy game where one sheep tries to reach the opposite side of the board while four wolves try to block it.

The project now includes desktop and browser versions, an AI opponent with multiple difficulty levels, saved games and persistent game statistics.

## Stack
Python · FastAPI · PostgreSQL · SQLAlchemy · Alembic · React · TypeScript · Vite · pytest

Deployed with Render for the API and Netlify for the frontend.

### Why this stack
The game logic was already written in Python, so I kept Python at the centre of the project instead of rewriting working logic in another language.

FastAPI provides the API layer between the game engine and the web application. It also gives me a clear path towards WebSockets for online multiplayer.

The frontend uses React and TypeScript with Vite. TypeScript was particularly useful for keeping API responses, game states and component data consistent while the project grew.

The first database version used SQLite. I later moved to PostgreSQL and now use it in both development and production, with SQLAlchemy for database access and Alembic for schema migrations.

## One source of truth for the game rules
The biggest architectural change was separating the rules from Pygame.

The original project mixed game state, rules and interface code. I moved the rules into a pure Python engine that has no dependency on Pygame, React or FastAPI.

The desktop game, API and tests now use the same engine. The web frontend does not implement its own version of the rules.

```python
@dataclass(frozen=True)
class GameState:
    sheep: Pos
    wolves: Tuple[Pos, ...]
    turn: str

def apply_move(state: GameState, move: Move) -> GameState:
    if move not in legal_moves(state):
        raise ValueError(f"Illegal move: {move}")

    # Return a new state instead of changing the existing one
```

Game states are immutable. Instead of modifying the current state, a move produces a new one.

This makes the engine easier to test and allows the AI to simulate possible moves without changing the actual game.

## Server-authoritative game state
The frontend sends the player's intended move, not a modified board.

```json
{
  "from": [2, 4],
  "to": [3, 3]
}
```

The server checks the move against the game engine before updating the state. Illegal moves are rejected instead of being trusted because they came from the client.

This also provides the foundation for multiplayer: both players can send actions while the server remains responsible for the actual game state.

## AI opponent
The AI uses minimax with alpha-beta pruning.

A pathfinding algorithm such as A* would find an efficient route through a fixed environment, but Wolf & Sheep is adversarial: every move changes what the other player can do next. Minimax allows the AI to evaluate moves while accounting for the opponent's possible responses.

Difficulty changes how far the AI searches. Easy mode uses simpler decisions, while higher difficulties search further ahead.

The evaluation function scores possible states based on factors such as the sheep's progress across the board and the wolves' ability to restrict its movement.

## Database design
Game history is stored using a relational structure built around games, players and moves rather than storing the entire match in a single database row.

Statistics are calculated from that game history instead of being duplicated in a separate statistics table.

This keeps the recorded games as the source of truth. Caching or precomputed statistics can be added later if performance makes them necessary.

## Testing and development
The project currently has 31 pytest tests covering the game engine, AI, database and API.

Database changes are managed through Alembic migrations, keeping schema changes versioned alongside the application code.

Development is organised using a feature branch for each major change, with tagged milestones for completed versions.

The frontend and backend are deployed separately and communicate over HTTPS. CORS is restricted to the frontend's allowed origin.

## In progress
The next stage is adding user accounts and online multiplayer.

Authentication will use Argon2 password hashing and HTTP-only session cookies.

Multiplayer will use WebSockets while keeping the existing server-authoritative architecture. Players send their moves to the server, the server validates them using the same Python engine, and the resulting game state is broadcast to both players.
