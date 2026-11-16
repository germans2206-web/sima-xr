# SIMA XR — Morning Maintenance Planner

A hands-first mixed reality app for Meta Quest that turns a food plant's
morning maintenance planning into a 10-minute, seated, controller-free session.

Today's inspection findings appear as cards on your real desk. Pinch a card,
look at a slot on the week board (technicians × next five working days) and
release. **SIMI**, an on-device planning assistant, suggests who and when for
each finding and explains why. It puts food-safety risks first, then sorts by
due date and age, within each technician's capacity. Say or tap **Plan all**
to let SIMI fill the board, then adjust anything you disagree with.

Built for the Meta VR Start Developer Competition 2026 (Productivity track).

## Features

- **Hands-first:** pinch-to-grab cards and pinch buttons. Nothing needs a controller.
- **Mixed reality:** passthrough, plus plane detection to rest the workspace on your desk.
- **Seated and FoV-aware:** everything sits within roughly 60 cm, with key UI kept centred.
- **Agentic assistant:** SIMI scores skill match, due date, food-safety risk and workload, and explains each suggestion.
- **Voice:** "plan all", "suggest", "accept", "what's urgent?" (where the browser supports the Web Speech API).
- **Daily loop:** a new set of findings each day, a planning streak and a "Plan ready" summary.

The demo runs at **Arandu Foods, Plant 1**, a fictional company. All plants,
areas and technicians in this repository are fictional demo data. Any
resemblance to real companies or people is coincidental.

## Try it

Open the GitHub Pages URL of this repository in the **Meta Quest Browser**,
tap **Enter XR**, sit at a table and use your hands. On desktop, the page runs
in the bundled WebXR emulator (IWER).

## Develop

Requirements: Node.js 20.19+ (or 22.12+ / 24+).

```bash
npm install
npm run dev:runtime   # https://localhost:8081, works on a Quest on the same Wi-Fi
npm run typecheck
npm run build         # outputs dist/
```

Built with [Meta Immersive Web SDK](https://iwsdk.dev) (IWSDK 1.1), Three.js and TypeScript.

Code layout:

- `src/planner-system.ts`: workspace, cards, board, SIMI agent, voice and persistence.
- `src/art.ts`: canvas-rendered cards, board and panels.
- `src/data.ts`: demo findings and technicians.
