# Engineering Update — 2.2.0

**Project:** KSA OUTPOST 86  
**Organisation:** Kuntau Science Academy  
**Build identity:** BUILD. SURVIVE. EXPLORE.  
**Date:** 11 November 2026

## Baseline and audit

The supplied `KSA-OUTPOST-86-2.1.0(1).zip` contains a complete browser application (51 files; about 6.2 MB uncompressed) built with PlayCanvas Engine 2.24.0, TypeScript 5.9.3 and Vite 7.2.2. The archive has no `.git` directory, so its ancestry and exact relationship to remote commits cannot be proven from the archive itself.

The existing product is a single playable lunar outpost mission with seven deterministic training days, a procedurally modelled astronaut, power/life-support/water/shelter/greenhouse/science station interactions, a local offline rules-based assistant, audio controls, surface visualiser, PWA caching and 23 automated tests in the supplied baseline. Its documentation correctly discloses that Earth launch, a playable Mars world, drivable rover, multiplayer crew and real NASA telemetry are not implemented. These features were not misrepresented as complete in this update.

The earlier 2.1.0 README/release notes said the public repository was empty. A fresh public GitHub page inspection on 11 November 2026 shows the `main` branch, file tree and four commits. The source-file view could not be fetched for a content comparison, and command-line Git access could not resolve `github.com` from this environment. No GitHub commit, push or Cloudflare deployment was performed. The previous empty-repository statement is superseded by this correction.

## Implemented in 2.2.0

1. Added **Lunar Lander Lab**, a new playable 2D training activity accessible from the main menu.
2. Added adjustable vertical thrust and lateral trim controls, altitude / vertical speed / horizontal speed / fuel telemetry, reset/retry behaviour and touchdown feedback.
3. Added deterministic immutable descent physics in `src/game/lander.ts`; all controls are clamped and time steps are capped at 50 ms.
4. Added a visible coaching hint based on the exercise's own game parameters and clearly disclosed the landing thresholds as game scoring, not real spacecraft requirements.
5. Added 9 unit tests covering state validation, safe and hard touchdown, fuel depletion, stable state transitions and a coached successful landing.
6. Added responsive styles for desktop, tablet and mobile layouts; added cleanup for the animation loop and event listeners.
7. Bumped package metadata and the Field Systems companion UI to `2.2.0`; bumped the service-worker shell cache to `v5` so clients invalidate the earlier cached shell.
8. Updated README, architecture, gameplay, limitations, testing, deployment and judge demonstration documentation.
9. Corrected the stale statement that the public GitHub repository was empty. The archive's missing `.git` history remains an explicit limitation.
10. Added a review-first Windows publish helper that previews file updates, retains remote-only files, runs the production build and requires explicit copy/push approvals without force-pushing.

## Preserved

- PlayCanvas 2.24.0 scene and controller architecture.
- Existing seven-day deterministic lunar outpost mission.
- Existing assistant, mission save data, audio and field-systems panel.
- Existing npm dependencies and lockfile dependency versions; no new package was added.
- Existing PowerShell Git helper, which stops rather than force-pushing or overwriting a remote history it cannot reconcile safely.

## Known scope limits

- Only the lunar outpost is a playable 3D world.
- There is no playable Earth launch / spacecraft flight or Mars environment.
- The rover remains a static visual prop.
- The main 3D world has one playable astronaut, not a multi-person animated crew.
- The assistant remains a deterministic offline knowledge helper, not a cloud generative model.
- The Lander Lab is a simplified 2D classroom mini-game, not a validated flight dynamics model or lunar guidance system.
- The terrain is procedural and illustrative, not a surveyed lunar elevation model; the scanner imagery's provenance is not documented in the supplied archive.

## Verification performed

| Check | Result |
|---|---|
| Node test runner | PASS — 32/32 |
| Targeted TypeScript check of game modules | PASS — `lander.ts`, `assistant.ts`, `simulation.ts`, `storage.ts` |
| TypeScript syntax diagnostics | PASS — eight `.ts` source/config files |
| JavaScript syntax checks | PASS — `public/ksa-experience.js`, `public/sw.js` |
| Full project typecheck | BLOCKED — `vite/client` unavailable after incomplete dependency install |
| npm dependency installation | BLOCKED — did not complete in this runtime |
| Vite production build | NOT RUN — Vite package unavailable |
| Browser and Android test | NOT RUN |
| GitHub / Cloudflare write or deploy | NOT PERFORMED |

See `docs/TESTING.md` for exact commands and the outstanding manual acceptance steps.

## Local run

On Windows PowerShell, install Node.js 22.16+ and Git for Windows, extract the complete archive, then run from the project folder:

```powershell
npm ci
npm run dev
```

Open the Vite URL printed by the terminal. Before deployment, run `npm run typecheck`, `npm test` and `npm run build` on a machine with npm registry access. Do not push over the existing remote history; clone and inspect the latest `main` first, then merge the 2.2.0 changes in a reviewed commit.
