# System architecture — KSA OUTPOST 86 v2.3.0

## Runtime overview

KSA OUTPOST 86 is a browser-first, local-first application. Its core mission simulations do not require a server, account or NASA API key.

1. `index.html` provides the application root, world canvas, PWA manifest and metadata.
2. `src/main.ts` coordinates application navigation, mission state, settings, user actions, saves, audio, renderer lifecycle and screen rendering.
3. `src/engine/babylonWorld.ts` loads Babylon.js, prefers WebGPU where supported, falls back to WebGL and creates the procedural Earth, Moon and Mars scenes, spacecraft transit and interactive rover actions.
4. `src/engine/canvasFallback.ts` provides a Canvas 2D world when the Babylon runtime cannot be loaded or initialize. It is a resilience fallback, not an equivalent 3D renderer.
5. `src/game/simulation.ts` retains the deterministic seven-day First Light lunar campaign. Actions return new state snapshots.
6. `src/game/frontierSimulation.ts` implements the seven-day Mars Frontier state machine, resource transitions, event sequence, action trade-offs, rover sample and final assessment.
7. `src/game/storage.ts` validates and stores the existing lunar mission and settings. Mars state uses its own versioned key in `frontierSimulation.ts`.
8. `src/game/assistant.ts` retains the offline deterministic Mission Control helper. It does not call an LLM, NASA API or cloud service.
9. `src/game/lander.ts` preserves the independent two-dimensional Lunar Lander Lab model.
10. `src/game/audio.ts` coordinates local bundled audio after user interaction and observes the audio setting.
11. `src/styles.css` defines the responsive warm visual system, fixed header, fixed mobile navigation and page layouts.
12. `public/sw.js` updates the application-shell cache version and caches selected same-origin assets after a successful online visit.

## 3D renderer

Babylon.js is loaded at runtime from the official standalone CDN (`https://cdn.babylonjs.com/babylon.js`). The engine attempts WebGPU when available and otherwise uses WebGL. Procedural terrain geometry uses deterministic multi-scale noise, height variation and crater functions; surface textures are generated with `DynamicTexture`. Habitat, rover, spacecraft and astronaut elements are composed procedurally from Babylon meshes and materials.

The Earth map and surface are generated artwork, not measured Earth imagery. The Moon and Mars elevation surfaces are procedural training landscapes, not verified digital elevation models. Procedural scene objects are not certified engineering models or NASA photogrammetry.

If the CDN cannot be reached or Babylon initialization fails, `canvasFallback.ts` draws a separate 2D illustration of the selected world and keeps the mission UI available. The fallback does not provide 3D camera navigation or equivalent geometry.

## Mission data flow

- The lunar campaign is initialized or restored through the existing `simulation.ts` and `storage.ts` functions.
- The Mars campaign is initialized/restored through `frontierSimulation.ts` using `ksa-outpost-86-mars-mission-v1`.
- User actions produce validated state transitions; state is saved to browser storage.
- UI screens derive their mission values from the current state.
- The Mission Control helper answers from the selected mission's state and its deterministic ruleset.

## Local storage

| Key | Purpose |
|---|---|
| `ksa-outpost-86-mission-v1` | Existing lunar mission snapshot |
| `ksa-outpost-86-mars-mission-v1` | Mars Frontier snapshot, version 1 |
| `ksa-outpost-86-settings-v1` | Graphics quality and reduced motion |
| `ksa-outpost-86-audio-v1` | Audio preference |
| `ksa-outpost-86-world-v1` | Last selected planet |
| `ksa-outpost-86-crew-v1` | Crew assignment choices |

These values belong to the current browser profile and are not cross-device synchronized.

## Deployment layout

- Vite outputs static assets into `dist/`.
- Normal GitHub Pages builds retain `/KSA-OUTPOST-86/` as the base path.
- A Cloudflare Workers build can set `WORKERS_CI=1` to use `/` as its base path.
- `wrangler.jsonc` targets `dist/` with SPA fallback.
- The supplied `.github/workflows/deploy.yml` deploys GitHub Pages. Do not confuse it with an authenticated Cloudflare deployment workflow.
