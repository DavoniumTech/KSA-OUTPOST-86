# Testing and acceptance — v2.3.0

## Automated coverage

The Node.js built-in test runner executes **39 tests** across the lunar mission simulation, Mars frontier simulation, local storage, offline Mission Control assistant and Lunar Lander training physics.

- `tests/simulation.test.mjs`: deterministic lunar mission state, objectives, events, resource trade-offs, final assessment and immutable state transitions.
- `tests/frontier.test.mjs`: Mars initial state, daily objectives, system inspection, power profile, water recovery trade-offs, solar shelter, greenhouse, rover/sample sequence, final assessment, resource changes and immutable transitions.
- `tests/storage.test.mjs`: mission save/restore, corrupt snapshot rejection, invalid resource/event rejection, settings persistence and disabled browser-storage behaviour.
- `tests/assistant.test.mjs`: contextual offline answers from mission objectives, nearby systems and current resources, including explicit disclosures of unsupported/live capabilities.
- `tests/lander.test.mjs`: descent state, thrust controls, time-step limits, fuel, landing classification and repeatable training outcomes.

Run on Node.js 22.16 or later:

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

`npm run build` runs type checking, tests and then the Vite production build.

## Verification performed in the release container — 11 November 2026

| Check | Result | Evidence / qualification |
|---|---|---|
| Full TypeScript check | PASS | `tsc --noEmit` exited successfully using the globally available TypeScript compiler. |
| Node unit tests | PASS — 39/39 | `node --experimental-strip-types --test tests/*.test.mjs`; zero failures. |
| Vite production build | NOT RUN | Vite package was not installed in the container; outbound npm registry DNS was unavailable. No `dist/` build is claimed. |
| Browser visual / interaction smoke test | NOT RUN | The application could not be served from a dependency-complete Vite installation in this environment. |
| Physical Android test | NOT RUN | Requires a target Android device and browser. |
| Babylon WebGPU/WebGL runtime test | NOT RUN | Babylon.js is loaded from the official CDN; outbound browser/network validation was unavailable here. |
| PowerShell deployment helper | NOT EXECUTED | It is included for Windows PowerShell; no PowerShell runtime was available in the release container. |
| GitHub push | NOT PERFORMED | Container DNS could not resolve GitHub; no authenticated write operation was possible. |
| Cloudflare deployment | NOT PERFORMED | No Cloudflare credentials or verified production connection were available. |

The application source type-checks and all 39 automated domain/storage/assistant/lander tests pass. This is not a claim of a completed Vite production build, browser compatibility validation or live deployment. The Babylon renderer's CDN dependency and Canvas fallback are described in `LIMITATIONS.md`.

## Manual browser acceptance still outstanding

On a network-enabled environment after `npm ci` and `npm run build`:

1. Confirm Babylon.js loads and selects WebGPU or WebGL 2.
2. Block the Babylon CDN and confirm the Canvas fallback and all mission screens remain usable.
3. Switch Earth, Moon and Mars; confirm each world is visibly distinct.
4. Start a Moon journey and complete the preserved First Light campaign.
5. Start a Mars journey and complete all seven Mars mission days.
6. Check resource changes, event resolution, rover deployment and sample collection.
7. Confirm saves survive reload and the Lunar Lander Lab remains available.
8. Test fixed header and mobile navigation at 320px, 360px, 390px and tablet/desktop widths.
9. Check reduced-motion, audio settings and touch interaction on an Android device.
10. Verify real GitHub and Cloudflare deployment behaviour independently.
