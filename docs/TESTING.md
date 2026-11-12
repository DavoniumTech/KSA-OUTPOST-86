# Testing and release validation — KSA OUTPOST 86 v3.6.0

## Automated checks executed in the release workspace

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | PASS |
| Existing Node test suite | PASS — 42 tests |
| `node --check worker/index.js` | PASS |
| `node --check public/sw.js` | PASS |
| ZIP integrity and required-file checks | PASS — verified, 79 files; no `.git`, `node_modules` or build cache |
| Vite production bundling | NOT RUN — dependencies could not be installed because the npm registry was unreachable from this environment |
| Real Android/browser performance measurement | NOT RUN — no deployed build/browser-device session available in this workspace |
| GitHub push | NOT PERFORMED BY THIS WORKSPACE |
| Cloudflare deployment | NOT VERIFIED |

## Manual gameplay acceptance checklist

Use the deployed build to verify on desktop and Android:

- First-time onboarding, skip and replay.
- Solar-system camera movement and planet selection.
- Rocket configuration and launch flow.
- Astronaut movement, camera and nearby interactions.
- Habitat entry and station actions.
- Rover boarding, movement and proximity-based sample scan.
- Mission progression, XP, save/resume and notification actions.
- Light Explorer, Dark Cosmos and Glass Blue themes.
- Mobile header, bottom navigation, touch controls, safe-area layout and orientation changes.

Do not treat a passing TypeScript/test run as proof that real GPU rendering or physical-device load times passed.
