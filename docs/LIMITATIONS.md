# Known Limitations — 2.1.0

This is a focused first release, not a commercial game or a scientific engineering simulator.

## Visual and character assets

- The lunar outpost, terrain props, rover and astronaut are original procedural PlayCanvas geometry. The walkable surface is a 64 × 64 deterministic height-field with subtle relief and crater basins; it is not derived from surveyed lunar elevation data.
- The astronaut is a hierarchical low-poly character with manually animated limb pivots. It is not a rigged third-party GLB with a professional skeletal animation set.
- There is no official KSA school logo in the package. The `86` emblem is a temporary project mark.
- The habitat is presented from the exterior with interactive system stations. A fully navigable furnished interior is not included. There is one playable astronaut, not a multi-person animated crew. The rover is a static prop, not a drivable vehicle.

## Simulation

- Resource values, rates, event timing and scoring are illustrative training values on a bounded scale.
- The radiation alert teaches a simple shelter procedure and does not model dose, shielding, solar-particle-event forecasts or safe exposure limits.
- The greenhouse is a time-progress meter, not a validated crop-growth simulation.
- Thermal status and crew readiness are simplified game indicators, not medical or hardware measurements.
- There is no real-time NASA data feed or mission telemetry. Earth launch, spacecraft flight/landing and a Mars environment are not implemented in this release.

## Controls and rendering

- Movement collision uses simple circular obstruction checks, not a full physics simulation.
- The scene uses WebGL 2 as the compatibility baseline. A WebGPU path is not required or implemented.
- Low, medium and high settings control scene-detail visibility; they do not expose a complete per-device graphics profiler. The Settings screen currently provides graphics quality and reduced-motion controls plus a link to audio settings; light/dark themes, UI scaling, camera sensitivity and a full accessibility panel are not implemented.
- Browser automation and physical Android device tests are separate from the unit tests and must be completed on the target devices.

## Assistant, audio and PWA

- The Mission Control assistant is a deterministic offline rules/knowledge helper. It is not a generative AI model, does not browse and has a deliberately limited topic set.
- The archive includes bundled training sound effects and optional ambience/breathing loops. No music track or recorded voice communication is included. Browser audio still requires a user gesture.
- The service worker caches a small application shell and successful same-origin runtime requests. The terrain scanner image set is lazy-loaded and is not pre-cached in the application shell. Do not promise a complete first-load offline experience; install once online and test repeat-load behaviour on target browsers.
- Local save data can be removed when the user clears browser site data. There is no cloud synchronisation or account system.

## Repository and hosting

- This archive does not contain `.git` metadata, so its ancestry and remote HEAD cannot be verified from the ZIP. No GitHub push was made and no Cloudflare deployment was performed during this update.
- The project includes the configuration and student-friendly instructions needed for those steps.
