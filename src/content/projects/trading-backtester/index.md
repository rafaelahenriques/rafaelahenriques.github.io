---
title: "Trading Backtesting Engine"
section: featured
order: 3
status: in-progress
category: "Backend & Data"
types: ["data"]
year: "2026"
tech: ["Python", "PostgreSQL", "APIs", "Docker", "Testing"]
description: "An engine that replays historical market data through a trading strategy, simulates the orders it would place and measures how that strategy would have performed."
architecture:
  - label: "Historical data"
    detail: "Price history from market-data APIs"
  - label: "Data processing"
    detail: "Cleaned and aligned into one consistent series"
  - label: "Strategy engine"
    detail: "Turns each new bar of data into buy and sell signals"
  - label: "Order simulation"
    detail: "Fills those signals as simulated orders"
  - label: "Portfolio engine"
    detail: "Tracks cash, open positions and total value"
  - label: "Performance analysis"
    detail: "Scores the run with the metrics below"
metrics:
  - label: "Return"
    detail: "Total change in portfolio value over the test period"
  - label: "Win rate"
    detail: "Share of closed trades that made a profit"
  - label: "Max drawdown"
    detail: "Largest fall from a peak before a new high"
  - label: "Sharpe ratio"
    detail: "Return earned per unit of risk taken"
  - label: "Volatility"
    detail: "How much returns swing from period to period"
  - label: "Trades"
    detail: "How many trades the strategy executed"
media:
  screenshot: "./cover.png"
tags: ["Backend", "Data", "Algorithms"]
---

## Status
The engine is in development. Results from real backtests, the test strategy
and design notes will be added here as the project reaches its first release.
