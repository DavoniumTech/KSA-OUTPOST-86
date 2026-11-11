# KSA OUTPOST 86

**BUILD. SURVIVE. EXPLORE.**

A browser-based, three-dimensional lunar outpost training mission created as a KSA student educational project for the NASA Space Apps Challenge 2026 challenge **“Build a Junior Astronaut Mission Trainer.”**

> KSA OUTPOST 86 is a fictional educational simulation. NASA has not endorsed, certified or approved this application. Its numerical meters and events are training values, not NASA engineering specifications or operational guidance.

## What is included

- A live 3D lunar training site rendered by the standalone PlayCanvas Engine.
- A procedural, articulated astronaut character with manually animated walking and idle motion.
- A 64 × 64 procedural lunar height-field with low-relief crater basins, outer-site undulation, terrain rocks, long-shadow lighting, habitat modules, solar arrays, greenhouse, water-recovery equipment, shelter, rover, communications mast and science marker.
- Third-person camera follow, keyboard movement, mouse-look and Android touch joystick/look controls.
- Seven-day deterministic mission progression with fixed, testable events.
- Interactive power, life-support, water-recovery, radiation-shelter, greenhouse and science stations.
- Cause-and-effect training values for power, oxygen supply, cabin-air condition, CO₂-control condition, water, food, thermal condition and crew operational readiness.
- Mission log, objective tracking, pause screen, mission debrief and validated local save/continue.
- KSA Mission Control offline assistant: answers common training questions using the live mission day, objective, resource indicators and nearby station.
- Bundled interface, radio, warning, success, suit-breathing and ambience sounds, with user-gesture audio unlock and saved audio preferences.
- Companion field-systems panel with crew illustration, visual terrain-layer scanner and audio controls.
- Responsive menu, briefing, how-to-play, settings, science sources and limitations screens.
- A basic service worker for same-origin application-shell/runtime asset caching after the first successful visit.

## Challenge connection

The challenge asks students to operate a lunar or Martian outpost and experience decisions involving life support, radiation shielding, power and food production. KSA OUTPOST 86 turns those trade-offs into a short interactive training mission: the player explores the site, operates equipment, responds to events and reviews the consequences.

## Current destination scope

This release is a playable lunar outpost training mission. It does **not** yet include playable Earth launch operations, a spacecraft flight/landing sequence, a Mars world, a controllable rover, or a multi-person animated 3D crew. The distant Earth sphere and rover are scene elements, not playable systems. These limits are stated in the offline assistant and `docs/LIMITATIONS.md` so the demonstration does not overclaim.

The Mission Control assistant is a deterministic offline knowledge helper, not a generative language model. It cannot browse, call NASA APIs or issue real spacecraft commands.

## Technology

- PlayCanvas Engine `2.24.0` (standalone NPM runtime)
- TypeScript `5.9.x`
- Vite `7.x`
- Node.js built-in test runner (no test framework dependency)
- HTML and CSS
- WebGL 2 baseline
- Local browser storage for settings and mission progress

The supplied `package-lock.json` pins the dependency tree. Use `npm ci` for a reproducible install. The game does not need an external API key, account, paid service or cloud AI service.

## Requirements

- Node.js 22.16+ recommended (the built-in test command uses Node's TypeScript type-stripping support).
- npm.
- A modern browser with WebGL 2 support. Desktop Chrome/Edge and Android Chrome are the initial targets.

## Install and run

Open PowerShell in the extracted project folder:

```powershell
npm ci
npm run dev
```

Vite prints a local address, normally `http://localhost:5173`. Open that address in the browser. The development server can also print a LAN address for testing on a phone connected to the same Wi-Fi network.

## Controls

| Action | Desktop | Touchscreen |
|---|---|---|
| Move | W A S D or arrow keys | Virtual joystick |
| Look around | Drag on the 3D scene | Drag on the 3D scene |
| Interact | E | Tap INTERACT when a station is in range |
| Pause / close panel | Escape | Pause button / close button |
| Complete day | Complete Day button after objective | Complete Day button after objective |

On mobile, landscape gives the most space for the 3D view, but the interface also rearranges for narrow portrait screens.

## Mission outline

| Day | Training event or task |
|---|---|
| 1 | Inspect power and life-support systems |
| 2 | Respond to reduced sunlight and choose a power plan |
| 3 | Repair the water-recovery unit or conserve water |
| 4 | Respond to a solar-radiation warning and secure the shelter |
| 5 | Choose a greenhouse growth or conservation schedule |
| 6 | Complete a marked regolith survey |
| 7 | Run the final systems assessment |

The fixed progression is deliberate: identical choices produce repeatable simulation results, which helps classroom discussion and automated tests.

## Quality checks

```powershell
npm run typecheck
npm test
npm run build
```

`npm run build` runs type checking, unit tests and then the Vite production build. The current archive includes 23 automated tests across the mission simulation, local storage and offline assistant. The PlayCanvas/Vite production build and browser smoke tests have not been run because dependency installation did not complete in this environment; see `docs/TESTING.md` for the exact verification record. A successful build is not the same as testing on every phone or browser.

## Save data

The mission and preferences are stored locally in the browser using `localStorage`. There is no account, cloud save or personal-information collection. Clearing browser site data can remove saved progress. Use the in-game save control before closing the browser.

## Project structure

```text
KSA-OUTPOST-86/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   ├── favicon.svg
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── assets/branding/       # Replaceable KSA logo location
├── src/
│   ├── main.ts                # App startup and UI/game orchestration
│   ├── engine/createWorld.ts  # PlayCanvas scene, astronaut, camera, controls
│   ├── game/simulation.ts     # Deterministic resource and mission model
│   ├── game/assistant.ts      # Local context-aware mission knowledge assistant
│   ├── game/storage.ts        # Local save and settings
│   ├── ui/ui.ts               # Screens, HUD and equipment panels
│   └── styles.css             # Responsive visual system
├── tests/simulation.test.mjs
├── tests/storage.test.mjs
├── tests/assistant.test.mjs
├── docs/
└── scripts/push-ksa-outpost-86.ps1
```

## Production build

```powershell
npm run build
npm run preview
```

The deployable site is generated in `dist/`. Do not edit the generated `dist/` files; edit the source in `src/` and build again.

## GitHub and Cloudflare Pages

The intended repository is `https://github.com/DavoniumTech/KSA-OUTPOST-86.git`, with production branch `main`. Its public GitHub page was checked on 11 November 2026 and displayed “This repository is empty”. No authenticated repository write, push or deployment has been performed. The included script handles an empty remote by creating the initial `main` branch.

A safety-first PowerShell helper is included at `scripts/push-ksa-outpost-86.ps1`. It asks for the ZIP and workspace paths, verifies the remote, checks the working tree and runs install/typecheck/tests/build before pushing. It intentionally stops if it finds a non-empty or divergent remote that needs human reconciliation rather than overwriting it.

For Cloudflare Pages, connect the GitHub repository and set:

| Setting | Value |
|---|---|
| Project name | `ksa-outpost-86` |
| Production branch | `main` |
| Root directory | `/` |
| Framework preset | `Vite` if listed; otherwise `Other` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | None required |

See `docs/DEPLOYMENT.md` for the step-by-step setup. No Cloudflare deployment has been performed or verified from this environment.

## Science and attribution

See:

- `docs/SCIENCE.md` for the source-based explanations and training-model boundaries.
- `docs/ASSETS.md` for the bundled asset inventory and attribution.
- `docs/GAMEPLAY.md` for the objective sequence and interactions.
- `docs/LIMITATIONS.md` for incomplete features and known simplifications.
- `docs/TESTING.md` for checks and acceptance status.
- `docs/ARCHITECTURE.md` for the runtime structure and data flow.
- `docs/DEMONSTRATION.md` for a short judge-facing demonstration route.
- `docs/RELEASE-2.1.0.md` for changes and remaining scope.

## Official challenge reference

https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/
