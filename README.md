# KSA OUTPOST 86 — Version 3.7.0

## ORBITAL FRONTIER · A playable planetary adventure

KSA OUTPOST 86 is an independent educational space-exploration game. Version 3.6 applies the final competition polish: a direct Play Now demo entry, an original orbital emblem, a corrected named crew, a fixed notification drawer, network-first app-shell updates for Android, additional animated solar-system objects and higher-detail Mars regolith materials. The experience includes: players complete a three-step interactive 3D onboarding, select Earth/Moon/Mars, control an astronaut, explore a habitat, operate mission stations, board and drive a rover, scan a sample site, and progress through the existing lunar and Martian outpost campaigns.

> **Educational notice:** This is an independent fictional training game. NASA has not endorsed, certified or approved it. Game resources, events and spacecraft journeys are simplified learning models, not operational specifications or live spacecraft telemetry.

## Play the game

1. Open the application. The V3.7 onboarding appears once, even if an older tutorial was already completed. The first solar-system scene is lazy-loaded after the app shell.
2. Complete the three onboarding steps: **Meet Your Crew**, **Choose Your Planet**, and **Learn to Command**. The final step teaches oxygen, power and water station interactions. Onboarding can be replayed from Settings.
3. After onboarding, choose **Play now · 5-minute demo** on Home; it preselects Mars and assembles the standard rocket. Review the flight check and press **Launch Expedition**. Choose **Customise my rocket** if you want to change components first. You can also customise every rocket component.
4. In the game, use the controls below. Follow the Primary Objective shown on the left, travel to the highlighted station and complete its activity.
5. Complete each day's objective before selecting **Complete Day**. Finish Day 7 and run the mission assessment.

### Desktop controls

| Control | Action |
|---|---|
| `W` `A` `S` `D` or arrow keys | Walk / drive |
| Mouse drag | Orbit the camera |
| Mouse wheel | Zoom |
| `Shift` | Run |
| `Space` | Jump |
| `E` | Interact with the nearest highlighted station / board rover |
| `F` | Scan when seated in the rover and at the sample beacon |
| `Esc` | Pause / return to mission controls |

### Mobile controls

Compact/mobile devices start in the Performance graphics profile to reduce first-world construction time and rendering cost. The user can switch to Balanced or High in Settings. The 3D renderer is a separate lazy-loaded bundle so the application shell and controls appear first.

Use the on-screen virtual joystick to move or steer. Drag the scene to adjust the camera. Use the **INTERACT**, **JUMP**, **SCAN** and **EXIT ROVER** buttons when they are visible. Allow the scene to finish loading before moving.

### Rover sample mission

On Mars Day 6, deploy the rover from the rover station. Board it, drive to the turquoise beacon in the marked ridge area, then use **SCAN** (or `F`). Sampling is proximity-based; the scanner will not award a sample from across the map. Return to the outpost and complete the objective.

### Habitat and station activities

Walk to a glowing station marker and press `E` or tap **INTERACT**. Enter the habitat through the airlock. Inside, use the highlighted stations:

- **Oxygen:** align valves in order `A → C → B`, then verify.
- **Solar service:** complete `ALIGN → CLEAR → LOCK` when the field challenge is available.
- **Greenhouse:** complete `WATER → LIGHT → NUTRIENTS`, then start the growing cycle.
- **Water recovery:** repair the filter or choose conservation.
- **Science:** review the mission sample and discoveries.

The current third-person character is procedurally modelled with articulated limb animation; it is not a captured motion/photogrammetry asset. The worlds and spacecraft are procedural educational environments, not NASA photogrammetry or measured surface datasets.

## Commander progression and rewards

The player earns Commander XP for completing mission days, finishing onboarding and collecting planetary samples. One-time achievements include First Commander, Lunar Field Scientist, Mars Field Scientist, First Light Graduate and Mars Expedition Complete. Guest rewards persist in this browser; signed-in rewards are included in the account's server-backed mission save when the Cloudflare Worker is deployed.

Open the **Crew** section to meet the fixed mission roster: **Al-Amin** (Commander), **Imran** (Pilot), **Shuaib** (Systems Engineer) and **Jafar** (Science Specialist), plus Commander XP and unlocked badges.

## Player themes and accounts

Open **More → Settings** to choose one of three live themes:

- **Light Explorer:** ivory, sand and copper.
- **Dark Cosmos:** deep navy and indigo.
- **Glass Blue:** translucent blue surfaces and cyan accents.

Guest play is available and stores progress in the current browser. Create an account from the profile/account screen to enable server-backed profile, save and mission-event synchronisation **after the Cloudflare Worker/API has been deployed and configured**. Guest data does not synchronise across devices.

The account API uses a secure HttpOnly session cookie, PBKDF2 password hashing, per-email failed-login throttling, and user-keyed Durable Objects for saves and events. The current build does **not** include email verification, email-based password reset, or Web Push delivery after the browser is completely closed. Browser notifications can be enabled for important events while the tab is in the background; live events can reach another active signed-in session over WebSocket.

## V3.7 release and mobile notes

- The three-step tutorial remains skippable and can be replayed from Settings. Existing completion is preserved.
- Babylon.js is dynamically imported after the UI shell renders. Mars albedo, normal and roughness textures are loaded only when the Mars world is selected.
- Compact screens automatically start in Performance mode; users can opt into Balanced or High manually. The service worker precaches only the light app shell, uses network-first navigation so Android receives new HTML releases, and never caches API responses. Large planetary textures are loaded on demand.
- The render loop pauses when the app is on non-game screens or the browser tab is hidden, saving battery and GPU time.
- Home leads with **Play now · 5-minute demo**, which assembles the standard Mars rocket and opens the launch flow. Custom rocket assembly and solar-system exploration remain available as secondary actions.

## V3.7 visual and interaction updates

- Notification drawer close and mission-journal actions work; non-action clicks inside the panel no longer trigger the backdrop.
- The KSA brand mark is an original orbital emblem.
- Solar-system preview includes animated Earth and Mars relay satellites plus a slowly drifting asteroid belt.
- The new Mars regolith albedo, normal and roughness maps are original procedural textures, not NASA-provided measurements.


### V3.7 responsive 3D frontier update

- Desktop navigation now uses a persistent left mission sidebar; tablet widths use a compact icon rail; phones retain a fixed bottom navigation dock with safe-area spacing.
- The mobile joystick now derives its movement radius from the rendered control size, follows the active thumb displacement, and only resets for its own pointer. Pointer cancellation, lost capture, tab hiding and window blur all release movement safely.
- The Moon's existing procedural terrain now includes additional small impact features. Its regolith uses local compressed albedo, normal and roughness maps, loaded only when the Moon scene is selected.
- The oxygen console now has a recognizable 3D pair of pressure vessels, manifold, valve and status bands.
- The three-screen onboarding keeps Skip visible on phones, avoids an internal scroll area, and labels the final action **Start Exploring**.
- Lunar textures are converted to WebP for smaller on-demand transfers. The initial app-shell cache is versioned as v11.

## Technology

- Vite 7 + TypeScript 5.
- Babylon.js `@babylonjs/core` 9.35.0, bundled by Vite from the pinned npm dependency.
- WebGPU is preferred when available; WebGL 2 is the fallback.
- Canvas 2D fallback if Babylon/WebGL cannot initialise.
- Cloudflare Worker API with Durable Objects for accounts, per-player records and live sessions.
- Existing First Light lunar campaign, seven-day Mars campaign, save logic, Mission Control helper, audio system and Lunar Lander Lab retained.

## Build and run

Requires Node.js 22.16+ and npm.

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

`npm run build` runs TypeScript checks, the Node test suite and Vite's production bundler. For Cloudflare's root-path static build, set `WORKERS_CI=1` before running the build; the existing GitHub Pages build retains `/KSA-OUTPOST-86/` as its base path.

## Cloudflare online services

The repository includes `worker/index.js` and `wrangler.jsonc`. The Worker defines `/api/health`, account registration/sign-in/profile/logout, private player saves, mission event history and per-player WebSocket live updates. Durable Object bindings and a V3 migration are declared in `wrangler.jsonc`.

The existing GitHub Actions workflow continues to deploy GitHub Pages. Its optional Cloudflare Worker job runs only when both repository Actions secrets are configured:

- `CLOUDFLARE_API_TOKEN` — an API token authorised to deploy the Worker and manage its Durable Objects.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID.

After adding both secrets in GitHub repository Settings → Secrets and variables → Actions, the next push to `main` will attempt the Worker deployment. Confirm the custom domain/route `ksa-outpost-86.davoniumtech.com` is assigned to the intended Cloudflare zone and inspect the GitHub Actions run. A Git push alone does not prove a Cloudflare deployment succeeded. Existing account IDs, routes, variables and local secrets must be preserved when merging `wrangler.jsonc`.

## Science and credits

- [NASA Science](https://science.nasa.gov/)
- [NASA Eyes](https://science.nasa.gov/eyes/)
- [NASA 3D Resources](https://science.nasa.gov/3d-resources/)
- [NASA Solar System Treks](https://trek.nasa.gov/)
- [NASA APIs](https://api.nasa.gov/)
- [Babylon.js](https://www.babylonjs.com/) · [Documentation](https://doc.babylonjs.com/)

These are scientific and technical references, not a claim that every procedural terrain or model in this build is NASA-sourced. Review `docs/ASSETS.md` and `docs/SCIENCE.md` for the assets and educational assumptions.
