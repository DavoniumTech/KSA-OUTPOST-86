# Testing and acceptance — v2.3.1

## Automated coverage

The Node.js built-in test runner executes 39 tests across the lunar mission simulation, Mars frontier simulation, local storage, offline Mission Control assistant and Lunar Lander training physics.

Run on Node.js 22.16 or later:

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

`npm run build` runs type checking, tests and then the Vite production build.

## Verification performed for v2.3.1

| Check | Result | Qualification |
|---|---|---|
| TypeScript static check | PASS | `tsc --noEmit` passed using the globally available TypeScript 5.8.3 compiler. The repository pins TypeScript 5.9.3 for normal installation. |
| Node unit tests | PASS — 39/39 | `node --experimental-strip-types --test tests/*.test.mjs`; zero failures. |
| Vite production build | NOT RUN | `node_modules` is not present in the release workspace and package registry access was unavailable. No `dist/` build is claimed. |
| Browser visual / interaction smoke test | NOT RUN | No dependency-complete browser server was available in this workspace. |
| Physical Android test | NOT RUN | Requires a target Android device and browser. |
| Babylon WebGPU/WebGL runtime test | NOT RUN | Babylon.js runtime is loaded from the official CDN. This release workspace did not verify a live browser download or GPU selection. |
| Windows PowerShell deployment | NOT EXECUTED HERE | Updated helper is included. The user previously confirmed a direct push of v2.3.0 to `origin/main`; this v2.3.1 update has not yet been pushed. |
| GitHub push for v2.3.1 | NOT PERFORMED HERE | A new package is prepared for the user's authenticated Windows environment. |
| Cloudflare deployment | NOT PERFORMED HERE | Verify the existing production integration separately. |

## Browser acceptance checklist

After the package is pushed and deployed:

1. Confirm the top app bar touches both viewport edges and stays fixed while scrolling.
2. Confirm the bottom navigation spans the viewport, has readable labels, and stays fixed without covering content.
3. Open **How to Play** from the top bar and home screen.
4. Start a mission and confirm the pre-flight briefing appears before the journey.
5. Launch Mars and confirm the application enters Outpost Command.
6. Verify the START HERE instructions explain the objective action and Complete day control.
7. Complete each seven-day Mars objective, including rover deployment before sample collection.
8. Start First Light and confirm the original lunar progression still works.
9. Confirm saves, offline Mission Control, the Lander Lab, PWA update and settings remain available.
10. Check widths 320px, 360px, 390px, 768px, 1024px and 1366px, plus Android portrait and landscape.
