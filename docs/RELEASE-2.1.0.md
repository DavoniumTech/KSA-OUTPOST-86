# Engineering Update — 2.1.0

**Project:** KSA OUTPOST 86  
**Organisation:** Kuntau Science Academy  
**Build identity:** BUILD. SURVIVE. EXPLORE.  
**Date:** 11 November 2026

## Baseline decision

The uploaded `KSA-OUTPOST-86-main.zip` is the source baseline for this update. It contains the PlayCanvas 2.24.0 / TypeScript / Vite application and a package lockfile. It does not contain `.git` metadata, so the original commit ancestry cannot be verified from this archive.

The public GitHub repository page was checked on 11 November 2026 and displayed “This repository is empty”. This is a public web-page check, not authenticated repository access. No GitHub push, commit or Cloudflare deployment was made.

## Audit summary

### Preserved

- PlayCanvas scene and camera/controller architecture.
- Seven-day deterministic lunar resource simulation.
- Existing station interactions, mission progression and debrief.
- Existing mission log and local save/continue workflow.
- Existing 13 simulation/storage tests.
- Existing audio, companion, terrain scanner and PWA files.

### Implemented in this update

1. Added a procedural 64 × 64 PlayCanvas lunar terrain mesh with gentle outer-site elevation and crater basins; the central outpost footprint remains mostly level.
2. Added **KSA MISSION CONTROL AI**, a deterministic offline assistant that reads the current day, objective, resource values and nearest station. It covers mission objectives, power, life support, water, radiation procedure, greenhouse, survey and known scope limitations.
3. Added a desktop/mobile assistant drawer with quick prompts and a text input. Messages use DOM text nodes; user-supplied text is not injected as HTML.
4. Connected the Settings screen to the existing Field Systems audio controls.
5. Added local persistence for audio effects, ambience, suit-breathing and volume preferences.
6. Strengthened mission-save validation to reject malformed fields, invalid resource ranges, invalid events and malformed mission-log entries. Restored log/toast/error text is inserted as text rather than HTML, reducing local-storage-based markup injection risk.
7. Added assistant and storage edge-case tests; total test count is now 23.
8. Updated the service-worker cache version to invalidate the previous shell cache.
9. Corrected the README, asset inventory, limitations, testing and deployment documentation; added architecture and judge-demonstration guides. Updated the guarded PowerShell helper to locate one enclosing project directory in ZIP extracts.
10. Updated the package metadata to version `2.1.0` while retaining the existing pinned dependency versions.

## Known limitations after this update

- Only the lunar outpost is a playable world.
- Earth launch and spacecraft flight/landing are not implemented.
- Mars is not implemented as a playable environment.
- The rover remains a static visual prop.
- There is one playable astronaut; the requested multi-person animated crew is not implemented.
- The habitat is exterior-only; there is no navigable furnished interior.
- The assistant is deterministic and deliberately limited; no cloud AI, voice interface or real NASA data integration is provided.
- The terrain height-field is procedural and illustrative, not a surveyed lunar elevation dataset.
- The source and licence provenance of the included scanner terrain textures are not documented in the supplied archive.
- A full visual browser pass and Android device test remain outstanding.

## Verification performed

| Check | Result |
|---|---|
| Node test runner — simulation, storage and assistant | PASS — 23/23 |
| `node --check public/ksa-experience.js` | PASS |
| `node --check public/sw.js` | PASS |
| Targeted TypeScript check for assistant/simulation | PASS |
| Full TypeScript check | BLOCKED — required `vite/client` definitions and PlayCanvas package are absent in this runtime |
| Vite production build | NOT RUN — Vite package installation did not complete |
| Browser visual/interaction test | NOT RUN |
| Android physical-device test | NOT RUN |
| PowerShell script test | NOT RUN |
| GitHub push / Cloudflare deployment | NOT PERFORMED |

## Deployment

On Windows PowerShell, extract the ZIP, open PowerShell in the project folder, run `npm ci`, then `npm run dev`. After confirming local gameplay, run `npm run typecheck`, `npm test` and `npm run build`. The supplied deployment guide explains GitHub Pages and Cloudflare Pages settings. Inspect the actual remote branch before any push; never force-push to reconcile an unknown history.


## Repository-status correction — 11 November 2026

The earlier statement in this release note that the public GitHub repository was empty is superseded. A fresh public repository page check on 11 November 2026 showed a `main` branch, file tree and four commits. The uploaded project ZIP does not contain `.git` history, and the remote source-file contents could not be retrieved for a comparison in that environment. No authenticated push or deployment was performed. See the 2.2.0 release note for the current audit and repository-status details.
