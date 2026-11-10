# Known Limitations — First Release

This is a focused first release, not a commercial game or a scientific engineering simulator.

## Visual and character assets

- The lunar outpost, terrain props, rover and astronaut are original procedural PlayCanvas geometry.
- The astronaut is a hierarchical low-poly character with manually animated limb pivots. It is not a rigged third-party GLB with a professional skeletal animation set.
- There is no official KSA school logo in the package. The `86` emblem is a temporary project mark.
- The habitat is presented from the exterior with interactive system stations. A fully navigable furnished interior is not included.

## Simulation

- Resource values, rates, event timing and scoring are illustrative training values on a bounded scale.
- The radiation alert teaches a simple shelter procedure and does not model dose, shielding, solar-particle-event forecasts or safe exposure limits.
- The greenhouse is a time-progress meter, not a validated crop-growth simulation.
- Thermal status and crew readiness are simplified game indicators, not medical or hardware measurements.
- There is no real-time NASA data feed or mission telemetry.

## Controls and rendering

- Movement collision uses simple circular obstruction checks, not a full physics simulation.
- The scene uses WebGL 2 as the compatibility baseline. A WebGPU path is not required or implemented.
- Low, medium and high settings control scene-detail visibility; they do not expose a complete per-device graphics profiler.
- Browser automation and physical Android device tests are separate from the unit tests and must be completed on the target devices.

## Audio and PWA

- Audio, music and voice communication are not implemented in this release.
- The service worker caches the application shell and successful same-origin runtime requests. Do not promise fully offline gameplay until a production deployment has been installed once and repeat-load behaviour has been tested on target browsers.
- Local save data can be removed when the user clears browser site data. There is no cloud synchronisation or account system.

## Repository and hosting

- The public target GitHub page was inspected on 10 November 2026 and displayed “This repository is empty”. This was a public-page check, not an authenticated Git operation.
- No GitHub push was made.
- No Cloudflare Pages project was connected or deployed.
- The project includes the configuration and student-friendly instructions needed for those steps.
