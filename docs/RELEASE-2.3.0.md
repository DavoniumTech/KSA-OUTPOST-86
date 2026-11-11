# Release 2.3.0 — Orbital Frontier

## Product reconstruction

This release rebuilds the supplied v2.2.0 application shell into a warm, responsive Earth–Moon–Mars planetary experience. The renderer has moved from PlayCanvas to a Babylon.js runtime with WebGPU preference and WebGL fallback, plus a Canvas 2D fallback if the CDN/runtime is unavailable.

## Retained foundation

The deterministic First Light lunar mission, browser-local save model, Mission Control offline knowledge helper, Lunar Lander Lab, audio controls, Vite/TypeScript architecture, PWA shell, test runner, Cloudflare Worker assets configuration and supplied GitHub Actions workflow remain in the project.

## New capability

The new Mars Frontier simulation adds seven mission days, resource-management decisions, dust-front power planning, water-recovery repair/conservation, shelter procedures, greenhouse scheduling, rover deployment, sample collection and an end-of-mission score.

## Validation record

- TypeScript check: passed in the release container.
- Automated unit tests: 39 passed, 0 failed.
- Vite production build: not run because Vite was not installed and the container could not reach the npm registry.
- Browser/device smoke test: not run.
- GitHub push: not performed because the container could not resolve GitHub and had no authenticated write channel.
- Cloudflare deployment: not performed; no authenticated Cloudflare deployment connection was available.

## Known qualification

The Babylon.js standalone runtime is fetched from the official CDN, and is not bundled locally. Procedural worlds and scene models are educational visuals, not measured NASA terrain or certified vehicle models. See `TECHNICAL-REPORT-2.3.0.md` and `LIMITATIONS.md`.
