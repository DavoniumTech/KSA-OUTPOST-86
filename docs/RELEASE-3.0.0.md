# Release 3.0.0 — Orbital Frontier

Version 3 changes KSA OUTPOST 86 from a primarily command-driven planetary simulator into a third-person planetary adventure prototype.

## Player-facing additions

- Three interactive onboarding steps set in the 3D world.
- Player-selectable Earth, Moon and Mars destination.
- Third-person astronaut controller with keyboard and mobile joystick.
- Habitat entry/exit and contextual station interactions.
- Oxygen valve sequence, solar-array repair sequence and greenhouse preparation task.
- Rover boarding, steering and sample scanning at a marked beacon.
- Commander XP and persistent achievement badges for onboarding, daily progress and science milestones.
- Fixed application header and bottom navigation, larger mobile text and six primary navigation destinations.
- Light Explorer, Dark Cosmos and Glass Blue themes.
- Account registration/sign-in interface, profile preferences, server-backed saves and live mission-event API.

## Existing features retained

The First Light lunar campaign, seven-day Mars campaign, mission state logic, local save format, offline Mission Control knowledge helper, audio controls, PWA shell and Lunar Lander Lab are retained.

## Online service status

The Worker implementation uses AuthIndex, PlayerStore and LiveRoom Durable Objects. Account saves can persist Commander XP and achievement badges alongside mission state. Deploy the Worker and its Durable Object migrations before enabling account sync. The GitHub Actions workflow deploys the Pages build as before and optionally deploys the Worker when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are present as repository Actions secrets.

The Worker does not currently implement email verification, email-based password recovery or Web Push after the browser has closed. In-page and active-session event delivery is supported; browser notifications are best-effort for a background tab with permission.

## Visual and asset notes

Babylon.js is the primary 3D engine. Terrain, Earth surface, spacecraft, rover, habitat and astronaut visuals in this version are procedural educational assets. Astronaut motion is articulated procedural limb animation, not a licensed motion-capture rig. Do not label procedural surfaces as measured NASA terrain.
