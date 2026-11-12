# Release 3.9.0 — Mission Control, live demo and Google sign-in

## Included

- Configured the supplied Firebase Google OAuth Web Client ID.
- Improved the launch engine contract so rocket launch and journey startup return an explicit success/failure result.
- Added automatic scene rebuild/retry and a bounded in-app recovery path if the launch or transfer callback fails.
- Added mission journal entries for launch start, touchdown, recovered transfers, demo start and demo debrief. Existing simulation operations continue logging their own successful actions.
- Implemented a real five-minute Mars demonstration beginning after touchdown, with a live timer, four gameplay objectives, persistence and an ending summary. Completing or timing out the demo does not close the seven-day mission campaign.
- Updated the launch status overlay, page/account visual polish and larger “Preparing your universe” indicator.
- Bumped the service-worker shell cache to v13.

## Validation

- Node test suite: 61/61 passed.
- Global TypeScript compiler 5.8.3 `tsc --noEmit`: passed. The project lockfile pins TypeScript 5.9.3; the pinned dependency installation and Vite build must be run in a network-enabled environment.
- Full `npm ci` in the packaging environment timed out because the package registry could not be reached. Vite production build and browser/device testing were not completed here.
- No GitHub push, GitHub Pages deployment or Cloudflare Worker deployment was performed by this release packaging step.

## Production activation checklist

1. Enable Email/Password and Google in Firebase Authentication.
2. Add `ksa-outpost-86.davoniumtech.com` to Firebase Authorized domains.
3. Add `https://ksa-outpost-86.davoniumtech.com` to the Google OAuth Web Client's Authorized JavaScript origins.
4. Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions repository secrets so the workflow can deploy the Worker and assets.
5. Run the supplied deployment helper. It runs `npm ci` and `npm run build` before changing the existing checkout, refuses dirty branches, avoids force-pushes and verifies the pushed `main` commit.
6. Inspect the GitHub Actions run and Cloudflare deployment; a successful Git push does not itself prove that Worker deployment succeeded.
