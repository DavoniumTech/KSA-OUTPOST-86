# System architecture — KSA OUTPOST 86 v3.6.0

## Runtime overview

KSA OUTPOST 86 is a Vite + TypeScript browser game with a guest-first mission experience and an optional Cloudflare Worker account API.

1. `index.html` provides the app root, metadata, PWA manifest and shell entry.
2. `src/main.ts` imports the styles and `src/v3/app.ts`.
3. `src/v3/app.ts` owns the current application shell, onboarding, solar-system/rocket/game navigation, commander profile, player progression, settings, notification UI and input wiring.
4. `src/engine/babylonWorld.ts` dynamically imports the pinned `@babylonjs/core` package. This keeps the 3D engine out of the first app-shell chunk. It creates the procedural Earth, Moon and Mars scenes, rocket and spacecraft sequences, astronaut movement, habitat interactions and rover controls.
5. `src/engine/canvasFallback.ts` provides a reduced Canvas 2D scene when Babylon cannot initialise. It preserves basic UI access but is not an equivalent 3D experience.
6. `src/game/simulation.ts` retains the deterministic seven-day First Light lunar campaign.
7. `src/game/frontierSimulation.ts` implements the seven-day Mars Frontier state machine, resource transitions, events, trade-offs, rover sample and final assessment.
8. `src/game/storage.ts` validates and stores existing lunar mission and settings. Mars state uses its own versioned key in `frontierSimulation.ts`.
9. `src/game/assistant.ts` retains the deterministic Mission Control learning helper. It does not call an LLM or represent a live NASA connection.
10. `src/game/lander.ts` preserves the independent Lunar Lander Lab.
11. `src/game/audio.ts` coordinates local audio following user interaction.
12. `src/styles.css` defines the responsive visual system, fixed application header, bottom navigation, themes and controls.
13. `public/sw.js` precaches the light shell, uses network-first navigation HTML, caches suitable static assets and bypasses `/api/` responses.
14. `worker/index.js` contains account/profile/save/event API handling and the per-player Durable Object implementation. Cloudflare account functionality requires this Worker and its bindings to be deployed and configured.

## 3D renderer and performance

- Babylon.js is a pinned npm dependency and is dynamically imported. It is not fetched from an unversioned standalone CDN.
- WebGPU is attempted where supported; WebGL 2 is the fallback.
- Compact screens begin with the Performance profile; quality can be changed in Settings.
- The first app shell appears before the 3D engine chunk is loaded. Selected-world material assets are loaded on demand.
- The render loop pauses when the game view is inactive or the document is hidden.
- `canvasFallback.ts` is a resilience layer, not a substitute for the 3D renderer.

## Simulation and persistence

- Lunar state is handled by `simulation.ts` and `storage.ts`.
- Mars state is handled by `frontierSimulation.ts` and its versioned browser-storage record.
- Commander XP, badges, rocket configuration, world selection, theme and other guest preferences use browser-local storage.
- Guest progress is browser/device-local. Cross-device sync is available only when the Cloudflare Worker API is actually deployed and configured.
- The default crew keys are `alamin`, `imran`, `shuaib` and `jafar`; older `amara` and `muhammad` assignment keys are migrated when encountered.

## Deployment

- Vite outputs static files to `dist/`.
- The existing GitHub Pages workflow retains `/KSA-OUTPOST-86/` as its base path.
- `WORKERS_CI=1` selects `/` for a Cloudflare Worker static-asset build.
- `wrangler.jsonc` points static assets at `dist/` and declares the Worker/DO configuration.
- A GitHub Pages workflow is not itself proof of Cloudflare deployment. Confirm the Cloudflare workflow, account secrets, route/custom domain and Worker deployment independently.
