# Testing and Acceptance

## Automated tests

`tests/simulation.test.mjs` covers:

- Initial state and Day 1 objective.
- Prevention of premature day advancement.
- Separate life-support inspections.
- Low-sunlight event and power-plan demand.
- Water repair cost and recovery improvement.
- Day 4 shelter response.
- Greenhouse progress and survey sample recording.
- Completion of the seven-day mission and bounded score.
- Immutability of the input state when actions are applied.

`tests/storage.test.mjs` covers mission save/restore, rejection of corrupt snapshots, settings persistence/defaults and graceful handling when browser storage is blocked.

Run:

```powershell
npm run typecheck
npm test
npm run build
```

## Manual browser smoke test

1. Open the Vite development URL in a browser with WebGL 2.
2. Confirm the lunar scene appears behind the main menu.
3. Open the briefing and deploy to the outpost.
4. Move with W A S D and drag to look around.
5. Walk to the power console and press E; inspect the system.
6. Walk to the life-support console and inspect it.
7. Complete Day 1. Confirm the low-sunlight event appears on Day 2.
8. Select a power plan and complete Day 2.
9. Repair or conserve water on Day 3.
10. Secure the shelter on Day 4.
11. Select a greenhouse schedule on Day 5.
12. Collect the surface survey sample on Day 6.
13. Run the final assessment on Day 7 and inspect the debrief.
14. Save, refresh and use Continue Saved Mission.
15. Check the narrow-screen layout and touch controls on an Android device.

## Verification status

The release should be considered verified only after the commands above run successfully in the target environment. The source archive contains a unit-test suite and build scripts. Device-specific frame rate, touch behaviour, portrait layout and PWA offline behaviour still require real-device testing; see `LIMITATIONS.md`.


## Build-environment verification record — 10 November 2026

| Check | Result | Notes |
|---|---|---|
| Deterministic simulation and storage unit tests | PASS — 13/13 | Executed with Node.js 22.16 using `node --experimental-strip-types --test tests/*.test.mjs`. |
| TypeScript source sanity check | PASS with limitation | Checked against a temporary local PlayCanvas API declaration shim because the real NPM package types were not installed. This is not a substitute for checking against the installed PlayCanvas package. |
| Dependency installation | BLOCKED | `npm install` could not reach `registry.npmjs.org` (`EAI_AGAIN` DNS resolution failure). |
| Official `npm run typecheck` | NOT RUN | Requires the Vite and PlayCanvas dependencies. |
| Vite production build | NOT RUN | Requires downloaded dependencies; no `dist/` output is claimed. |
| Browser / Android smoke test | NOT RUN | No dependency-complete browser build was available in this environment. |
| PowerShell script execution | NOT RUN | Windows PowerShell / `pwsh` was not available here. The script requires review/run on the project owner's Windows machine. |
| GitHub / Cloudflare | NOT RUN | Repository access, push and live deployment were not performed. |

The archive intentionally does not contain a fabricated `package-lock.json`. Direct dependency versions are pinned in `package.json`. The first `npm install` on a computer with registry access will generate a real lockfile; keep it in the repository and use `npm ci` thereafter.
