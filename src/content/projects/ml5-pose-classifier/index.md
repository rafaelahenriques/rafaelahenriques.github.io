---
title: "ML5.js Pose Classifier"
section: other
order: 3
status: in-progress
category: "Machine Learning"
types: ["web", "interactive"]
year: "2025"
tech: ["ml5.js", "JavaScript", "Canvas"]
context: "Creative Code 3 (Devine)"
description: "A machine-learning experiment in the browser: webcam body tracking feeds three small classifiers that recognise a boxer's guard, stance and jab."
media:
  screenshot: "./cover.png"
tags: ["Machine Learning", "Experiment"]
---

## How it works
ml5.js tracks body keypoints from the webcam. You record labelled samples for
three separate classifiers — **guard** (up, half, down), **stance** (orthodox,
southpaw) and **jab** (correct, incorrect) — train them in the browser, and
the page then predicts all three live. Trained models can be saved and loaded
again.
