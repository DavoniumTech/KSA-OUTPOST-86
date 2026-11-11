# KSA OUTPOST 86 — ORBITAL FRONTIER

**EXPLORE. BUILD. SURVIVE. DISCOVER.**

KSA OUTPOST 86 is an independent educational planetary exploration and outpost-management simulator. This v2.3.1 update expands the supplied lunar training project into an Earth–Moon–Mars experience with a seven-day Martian campaign, a Babylon.js 3D world layer, a responsive Android-style interface and a 2D fallback.

> **Educational notice:** This is a fictional training simulation. NASA has not endorsed, certified or approved the application. Resource meters, mission events and vehicle behaviour are simplified educational models, not operational spacecraft specifications, medical guidance or live NASA telemetry.

## What changed in v2.3.1

- Replaced the previous dark, box-heavy application shell with a warm ivory, sand, copper and terracotta visual system.
- Added full-viewport fixed top and bottom application bars with larger, clearer navigation targets.
- Added an in-app How to Play handbook and a pre-flight mission briefing before expedition launch.
- Added a visible START HERE cue and first-step instructions to Outpost Command.
- Made Mars Day 6 rover sampling sequential: deploy the rover before the sample action is shown.
- Added Earth, Moon and Mars destination selection and distinct procedural environments.
- Added a Babylon.js rendering layer with WebGPU preference and WebGL fallback.
- Added a 2D Canvas fallback so the core interface remains accessible if Babylon.js cannot load or WebGL is unavailable.
- Added animated spacecraft transit, a habitat complex, astronauts, solar equipment and rover scene elements.
- Added a seven-day Mars expedition with resource management, events, crew readiness, rover sampling and a final assessment.
- Preserved the deterministic First Light lunar mission, existing save system, offline Mission Control helper, Lunar Lander Lab, audio controls, PWA and existing Cloudflare/GitHub deployment configuration.

## Existing systems retained

The lunar First Light campaign, its power/life-support/water/radiation/greenhouse/science decisions, the local mission save, the deterministic Mission Control knowledge helper and the independent Lunar Lander Lab remain part of the application. Existing storage keys are retained where practical. Mars state uses a separate versioned key.

## Technology and rendering

- Vite 7.2.x and TypeScript 5.9.x.
- Babylon.js runtime, loaded from the official Babylon.js CDN at runtime.
- WebGPU is attempted where supported; WebGL is the fallback.
- A Canvas 2D planetary fallback is included.
- Node's built-in test runner.
- Browser-local mission persistence.

**Network limitation:** Babylon.js is loaded from `https://cdn.babylonjs.com/babylon.js`; it is not bundled in this source archive. The container used to prepare this release could not resolve the npm registry or GitHub, so a local Babylon package could not be installed. The application falls back to the included Canvas 2D world if the CDN is unreachable. That fallback is not equivalent to the Babylon 3D renderer. The first successful Babylon launch therefore requires access to the official CDN.

The planetary terrain, Earth surface and scene props in this release are procedurally generated for the simulation. They are not a claim of photogrammetric or measured NASA terrain. Existing archive imagery was not re-labelled as NASA data because its original provenance could not be independently confirmed.

## Requirements

- Node.js 22.16 or newer.
- npm.
- A modern browser. WebGL 2 is recommended; WebGPU is used where available.

## Install and build

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

`npm run build` invokes type checking, unit tests and the Vite production build. The build and tests should be run in a network-enabled environment where the locked Vite dependencies are installed. The release-preparation container ran TypeScript and the Node test suite, but could not run Vite's production bundler because dependencies were not installed and outbound package-network access was unavailable. See `docs/TECHNICAL-REPORT-2.3.0.md`.

For the Cloudflare Workers asset build, retain the repository's existing build convention:

```powershell
$env:WORKERS_CI = '1'
npm run build
```

The normal GitHub Pages build retains the `/KSA-OUTPOST-86/` base path. Do not change the existing hosting configuration without checking the real production integration.

## How to play

Start with **Start guided mission** or open **How to Play** in the top bar. Read the pre-flight briefing, launch the Moon or Mars expedition, then open **Outpost**. Follow the Primary Objective, select its action button and press **Complete day** when the objective is complete. Repeat through Day 7 and run the final assessment.

The application is currently a command-and-management simulator, not a free-roaming third-person game. It does not have WASD astronaut walking or E-to-interact station controls. Drag the 3D scene to orbit the camera and use the mouse wheel to zoom. On touchscreens, swipe to orbit and pinch to zoom where supported. Mars Day 6 includes rover deployment, simple left/right rover controls in Explore, and sample collection after deployment.

The application provides Home, Missions, Worlds, Outpost, Crew and Explore sections, with Science, Journal, Settings and Lunar Lander Lab available through More. Mission operations update the simulation state. See `docs/GAMEPLAY.md` for the complete seven-day guide.

## Data and privacy

Mission progress and settings are stored locally in the current browser. The supplied project does not configure accounts or a cross-device backend, so local saves do not synchronize across devices. The core game does not require a NASA API key or cloud AI service. The Mission Control helper is deterministic and offline; it is not a generative AI connection.

## Deployment

The target repository is `https://github.com/DavoniumTech/KSA-OUTPOST-86.git`, branch `main`. The included `scripts/Deploy-To-GitHubMain.ps1` supports a safe package overlay and direct push. The bootstrap command should be copied from the release delivery instructions. It requires Git authentication and permission to push to `main`, and it refuses a dirty working tree, incorrect remote, non-main branch or non-fast-forward update.

The existing `wrangler.jsonc`, `.github` workflows, `wrangler.toml`, `.env*` and `.dev.vars*` are deliberately protected by the deployment script. The supplied GitHub Actions workflow deploys GitHub Pages; it is not evidence that Cloudflare is connected. Cloudflare deployment depends on the project's existing authenticated integration/configuration and must be verified separately. A successful Git push alone is not proof of a Cloudflare deployment.

## Science and asset references

- [NASA Science](https://science.nasa.gov/)
- [NASA Eyes](https://science.nasa.gov/eyes/)
- [NASA 3D Resources](https://science.nasa.gov/3d-resources/)
- [NASA Solar System Treks](https://trek.nasa.gov/)
- [NASA API portal](https://api.nasa.gov/)
- [Babylon.js](https://www.babylonjs.com/)
- [Babylon.js documentation](https://doc.babylonjs.com/)

These are references for learning and future data/asset integration. This release does not claim that all visual assets or planetary elevations are NASA-sourced. Review `docs/ASSETS.md`, `docs/SCIENCE.md` and `docs/LIMITATIONS.md`.
