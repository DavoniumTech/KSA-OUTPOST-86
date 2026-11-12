# Release 3.8.0 — Firebase Authentication

## Changes

- Replaced new account registration and password sign-in with Firebase Authentication REST endpoints.
- Added email verification, verification resend, password-reset email and Firebase refresh-token persistence in IndexedDB (sessionStorage fallback).
- Added Google Sign-In using Google Identity Services credential JWT exchange through Firebase Identity Toolkit. The button stays disabled until the OAuth Web Client ID is set.
- Added a Cloudflare Worker endpoint that verifies Firebase ID tokens with Firebase `accounts:lookup` and requires a verified, non-disabled account.
- Added Firebase UID linking in AuthIndex while preserving existing internal commander IDs and cloud saves.
- Disabled the old public registration/login routes to prevent bypassing Firebase email verification.

## Security decisions

- Passwords are sent over HTTPS directly to Firebase, never to the Cloudflare Worker.
- Firebase ID tokens are independently checked by the Worker before a session is issued.
- The game retains its Secure, HttpOnly, SameSite=Lax session cookie.
- No Firebase service-account credentials or OAuth client secret are included.
- Google sign-in is not represented as active unless an OAuth Web Client ID is configured.

## Configuration still required

Enable Email/Password and Google under Firebase Authentication providers, add the deployed host to Firebase authorized domains, configure the Google OAuth Web Client ID as `VITE_FIREBASE_GOOGLE_CLIENT_ID`, and deploy both the Worker and frontend assets. See `FIREBASE-AUTH-SETUP.md`.

## Validation

This release must pass the included Node tests and TypeScript check. A production Vite build and live Firebase/Cloudflare auth test must be run in the deployment environment with npm dependencies available. Do not claim live auth or production deployment from source inspection alone.

## Validation performed in the available workspace

- TypeScript check (`npm run typecheck`): PASS.
- Node test suite: PASS — 56/56, including Firebase client-flow tests and Worker token-verification, origin and request-size checks.
- Worker syntax check (`node --check worker/index.js`): PASS.
- Production bundle (`npm run build`): NOT COMPLETED because the Vite executable is absent in this workspace; the package install could not retrieve registry dependencies. The Windows deployment helper runs `npm ci` and `npm run build` before changing or pushing the repository and stops on failure.
- Live Firebase provider settings, real email delivery, real Google OAuth, deployed Cloudflare Worker and browser/Android tests: NOT VERIFIED.
