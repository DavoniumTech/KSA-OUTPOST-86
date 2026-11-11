# Testing and Acceptance — 2.1.0

## Automated coverage

The Node.js built-in test runner executes **23 tests** across the simulation, local storage and offline Mission Control assistant.

- `tests/simulation.test.mjs` (9 tests): initial state, objective progression, separate life-support checks, low-sunlight response, water repair/conservation trade-offs, shelter procedure, greenhouse/survey activity, final scoring and immutable state transitions.
- `tests/storage.test.mjs` (5 tests): save/restore, corrupt snapshot rejection, invalid resource/event rejection, safe settings persistence and graceful handling when browser storage is unavailable.
- `tests/assistant.test.mjs` (9 tests): live objective, nearby-station guidance, distinct life-support indicators, current resource values, bounded radiation advice, accurate missing-feature disclosures, rover limitations, blank/unknown prompts and changed mission state.

Run on Node.js 22.16 or later:

```powershell
npm ci
npm test
npm run typecheck
npm run build
```

`npm run build` runs type checking, the tests and then the Vite production build.

## Manual browser smoke test

These checks are still required on a dependency-complete machine:

1. Open the Vite development URL in a browser with WebGL 2.
2. Confirm the lunar scene appears behind the main menu.
3. Open the briefing and deploy to the outpost.
4. Move with W A S D and drag to look around.
5. Walk to the power console and press E; inspect the system.
6. Walk to the life-support console and inspect it.
7. Open **MISSION AI** and ask for the current objective.
8. Walk near a station and ask **HELP HERE**; confirm the nearest station is identified.
9. Open Settings → Audio and confirm the Field Systems panel opens on its AUDIO tab.
10. Enable a sound after clicking; test the radio cue, change volume, reload and confirm preferences persist.
11. Complete Day 1. Confirm the low-sunlight event appears on Day 2.
12. Select a power plan and complete Day 2; then complete the water, shelter, greenhouse, survey and final-assessment objectives.
13. Save, refresh and use Continue Saved Mission.
14. Check narrow-screen layout and touch controls on an actual Android device.
15. After an online visit has cached the app, disconnect and check repeat-load behaviour. The first visit is not fully offline.

## Verification performed in this environment — 11 November 2026

| Check | Result | Notes |
|---|---|---|
| Node unit tests | PASS — 23/23 | `node --experimental-strip-types --test tests/*.test.mjs`; simulation 9, storage 5, assistant 9. |
| Targeted assistant/simulation TypeScript check | PASS | Global TypeScript 5.8.3 with strict settings and an empty ambient type-root directory; this checks those two modules only. |
| Full project TypeScript check | BLOCKED | `npm run typecheck` cannot find `vite/client`; the interrupted dependency installation left empty package directories. |
| JavaScript syntax checks | PASS | `node --check public/ksa-experience.js` and `node --check public/sw.js`. |
| Dependency installation | BLOCKED | `npm ci --ignore-scripts --no-audit --no-fund` did not complete in this environment. The package registry could not be reached reliably. |
| Vite production build | NOT RUN | Vite package files are absent/incomplete; no `dist/` build is claimed. |
| Browser visual / interaction test | NOT RUN | No dependency-complete local build was available for browser inspection. |
| Physical Android test | NOT RUN | Requires the target handset and browser. |
| Windows PowerShell helper test | NOT RUN | The script was reviewed and hardened for the archive's enclosing folder, but not executed in Windows PowerShell here. |
| GitHub push / Cloudflare deployment | NOT PERFORMED | No authenticated repository changes or live deployment were made. |

The original 13 tests remain and 10 test cases were added in this update. The project archive includes `package-lock.json`; use `npm ci` on a machine with registry access. A green unit-test result is not a substitute for the blocked full-project typecheck, production build or device testing.

## Acceptance status

The deterministic lunar mission, offline assistant logic, save-data validation and audio JavaScript syntax have automated checks. The app is **not yet release-verified for production** until the full dependency install, typecheck, Vite build, browser smoke test and Android touch test pass on the owner's machine.
