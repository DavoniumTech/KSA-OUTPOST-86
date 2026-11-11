# System Architecture — KSA OUTPOST 86

## Runtime overview

KSA OUTPOST 86 is a browser-first, local-first application. A server, account or API key is not required for the lunar training mission.

1. `index.html` provides the PlayCanvas canvas, UI root, PWA manifest and the companion experience layer.
2. `src/main.ts` starts the graphics device, creates the world and coordinates mission state, settings and screens.
3. `src/engine/createWorld.ts` builds the PlayCanvas scene, procedural terrain, station props, astronaut, camera and desktop/touch controls.
4. `src/game/simulation.ts` is the deterministic seven-day mission model. Actions return a new state rather than mutating the supplied snapshot.
5. `src/game/storage.ts` reads and writes local mission/settings data. Restored mission snapshots are validated before they are accepted.
6. `src/game/assistant.ts` produces deterministic offline answers from the current mission state and nearby interactable. It does not call a language model, web service or NASA API.
7. `src/ui/ui.ts` renders the screens, HUD, equipment interactions, mission log and assistant drawer. Assistant responses, mission-log values, toast text and boot errors are inserted with DOM text nodes rather than treating user-controlled or restored strings as HTML.
8. `public/ksa-experience.js` provides the optional crew/surface/audio companion panel and sound cues. Audio preferences use a separate local-storage key.
9. `public/sw.js` caches a small application shell and successful same-origin requests after the first online visit.

## 3D scene

The lunar ground is generated procedurally as a 64 × 64 segment PlayCanvas `PlaneGeometry` (4,225 vertices and 8,192 triangles before render conversion). Its deterministic height function adds gentle outer-site relief and three crater basins while keeping the central outpost area flatter for movement and equipment placement. It is not a surveyed digital elevation model.

Scene objects are procedural PlayCanvas primitives. The astronaut uses hierarchical entities and manually animated limb pivots. Low/medium/high graphics settings change the number of visible rocks and stars; they are not a complete GPU benchmark or device profiler.

## Mission data flow

- The simulation creates a fresh Day 1 snapshot.
- Player interactions call `applyMissionAction` or `advanceMissionDay`.
- The returned snapshot becomes the current mission state and is saved locally.
- The HUD and mission log are rendered from that state.
- The assistant receives the same current state plus the nearest station, so resource answers and objective answers reflect the active session.
- The assistant does not modify the mission state. It only returns text and a context label.

## Local storage

| Key | Purpose |
|---|---|
| `ksa-outpost-86-mission-v1` | Current mission snapshot |
| `ksa-outpost-86-settings-v1` | Graphics quality and reduced-motion preference |
| `ksa-outpost-86-audio-v1` | Effects, ambience, breathing and master-volume preference |

The browser profile owns this data. It is not synchronised across devices and can be removed by clearing site data. Invalid mission snapshots are rejected and the user can start a fresh mission.

## Security boundaries

- No backend or account system is configured.
- No private API credentials are required or embedded in browser source.
- The assistant is a small deterministic ruleset; unknown questions receive a bounded fallback rather than an invented answer.
- The assistant input is limited to 240 characters and both the question and answer are rendered as text nodes.
- Local-storage data is treated as untrusted and structurally validated when loaded.
- Same-origin requests are the only requests cached by the service worker.
- The terrain texture-set provenance is not documented in the archive; its scanner labels explicitly describe it as a project training visual, not NASA data.

## Offline behaviour

The main mission does not require a network API. After the application and required same-origin assets have been successfully loaded and cached, the service worker can serve the shell and cached resources on repeat visits. Some scanner textures are loaded lazily and are not included in the small pre-cache list. A complete offline first visit is not supported. Verify repeat-load behaviour on the actual hosted site and target Android browser.

## Deployment layout

- GitHub Pages uses the Vite base path `/KSA-OUTPOST-86/` for production builds.
- Cloudflare Workers static assets use `WORKERS_CI=1` to build with `/` as the base path.
- The Cloudflare Worker configuration serves `dist/` as static assets. The archive contains configuration only; no deployment is performed by this update.
