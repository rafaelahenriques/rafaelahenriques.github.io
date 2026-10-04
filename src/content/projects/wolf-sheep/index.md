---
title: "Wolf & Sheep"
section: featured
order: 1
category: "Full-stack"
year: "2026"
tech: ["Python", "SQL", "WebSockets", "REST API", "Docker", "Vite"]
role: "Full-stack developer"
context: "Independent rebuild of a 2021 university team project"
description: "A 2021 university board game rebuilt as a full-stack application: a Python game engine with an AI opponent, a REST API, match history and saves in SQL, and a web client built with Vite."
scope:
  - Game engine (rules, legal moves, win detection)
  - AI opponent with difficulty levels
  - REST API for games, moves, saves and stats
  - Match history and saves in SQLite
  - Test suite for engine, AI, API and storage
  - Web client with menu, stats and saved games
media:
  screenshot: "./wolfsheepmenu.png"
  gallery:
    - "./wolfsheepmenu.png"
tags: ["Full-stack", "Python", "API", "Game Logic"]
---

## Overview
Wolf & Sheep is an asymmetric board game on an 8×8 board: one player moves the
sheep and tries to reach the top row, the other moves the wolves and tries to
trap it. It started as a university team project in 2021. I rebuilt it on my
own as a full-stack application to practise engineering the parts a game
usually hides: state, rules, persistence and an API around them.

## What I built
- **Engine** — game state, legal moves per piece and win detection, kept free
  of any UI so it can be tested and reused.
- **AI opponent** — a search-based player with difficulty levels, scoring
  positions with a breadth-first estimate of the sheep's shortest path home.
- **REST API** — endpoints to create games, play moves, save and load games
  and read match statistics.
- **Storage** — finished matches and saves are persisted in SQLite.
- **Tests** — separate suites for the engine, the AI, the API, the database
  and saves.
- **Web client** — a Vite front end with a menu, difficulty selection, a stats
  screen and saved games.
