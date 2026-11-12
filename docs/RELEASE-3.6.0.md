# KSA OUTPOST 86 — Release 3.6.0

Final competition polish based on the supplied V3.5 production package.

## Player roster

- Al-Amin — Commander
- Imran — Pilot
- Shuaib — Systems Engineer
- Jafar — Science Specialist

Existing saved assignments migrate from the earlier `amara` and `muhammad` identifiers to `alamin` and `imran` without discarding the crew's other assignments.

## Changes

- Replaced the application emblem with an original KSA orbital mark.
- Corrected the crew roster and avatar initials.
- Added the release label to the fixed application header.
- Made **Play now · 5-minute demo** the primary home action; rocket customisation and solar-system exploration remain accessible.
- Fixed notification event delegation so the close button and mission-journal action are usable. Clicks on non-action panel content no longer trigger the backdrop.
- Added accessible labels to the notification controls.
- Bumped the service-worker cache to v10. Navigation HTML is network-first with cached fallback; `/api/` responses are not cached. Old shell caches are removed on activation.
- Added an animated Mars relay satellite and slow asteroid-belt drift; reduced asteroid counts in low graphics mode.
- Added original procedural Mars albedo, normal and packed metallic-roughness maps, loaded only when Mars is selected.
- Kept Babylon.js lazy-loading, the mobile Performance profile, Earth/Moon/Mars environments, rocket workshop, astronaut controller, rover, seven-day missions, guest saves, Mission Control and Lunar Lander Lab.

## Performance notes

The app shell renders before the Babylon.js engine chunk is loaded. Compact devices use the Performance graphics profile by default. The service worker precaches only a light app shell, obtains navigation HTML from the network first to prevent stale Android screens, and leaves API responses uncached. Mars surface maps are fetched only when that world is selected. The rendering loop pauses when the game view is inactive or the document is hidden.

These are implementation measures, not measured performance guarantees. Android load time and frame rate must be measured on the deployed site and target devices.

## Verification scope

See `docs/TESTING.md`. The isolated release workspace could run TypeScript, unit tests and JavaScript syntax checks, but could not install the npm dependencies required for a Vite production bundle or perform live browser/Android tests. No GitHub push or Cloudflare deployment is claimed by this package build.
