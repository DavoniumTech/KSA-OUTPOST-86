# Firebase Authentication setup — KSA OUTPOST 86 v3.9.0

## What is integrated

- Firebase email/password account creation and sign-in.
- Firebase email verification before the game creates an authenticated commander session.
- Verification resend and password-reset emails.
- Google Sign-In using Google Identity Services and Firebase Identity Toolkit.
- An existing Cloudflare Worker session (`Secure; HttpOnly; SameSite=Lax`) for game saves and live mission events.
- Verified-email linking to an existing commander profile by email, preserving the internal player ID used by existing saves.

The browser never sends a password to the Cloudflare Worker. Passwords are sent only to Firebase over HTTPS. The Worker validates Firebase ID tokens with Firebase's `accounts:lookup` endpoint before linking a player profile. The Worker does not trust a UID or email supplied independently by the browser.

## Firebase Console steps

1. Open the `KSA OUTPOST 86` Firebase project.
2. Open **Authentication → Get started → Sign-in method**.
3. Enable **Email/Password** (the email/password option, not email-link-only).
4. Under **Authentication → Settings → Authorized domains**, add `ksa-outpost-86.davoniumtech.com`.
5. Open **Authentication → Sign-in method → Google**, enable Google, and choose the project support email. Save. Keep Firebase's email-enumeration protections enabled where the project offers that setting; the app also uses generic sign-in and password-reset errors where possible.
6. The supplied OAuth **Web client ID** is already configured in `src/game/firebaseAuth.ts` and `.env.example`. It is public application configuration, not a client secret.
7. Confirm that Google is enabled as an Authentication provider, that `ksa-outpost-86.davoniumtech.com` is in Firebase Authorized domains, and that `https://ksa-outpost-86.davoniumtech.com` is an authorized JavaScript origin on the OAuth Web client.
8. For local development, add `localhost` to Firebase Authorized domains and the exact local origin and port to the OAuth client's Authorized JavaScript origins.

The production host must be HTTPS. Google Sign-In also requires the domain to be authorized by Firebase and listed as an authorized JavaScript origin on the OAuth web client. Use exactly `https://ksa-outpost-86.davoniumtech.com` as the production JavaScript origin; do not add a path or trailing slash.

## API key handling

The Firebase Web API key in the frontend and Worker source is a public project identifier, not a service-account secret. Do not replace it with a service-account key. In Google Cloud Console, restrict the key to the Firebase Identity Toolkit API used by this integration. Avoid an HTTP-referrer restriction on the same key while it is also used by the Cloudflare Worker, because Worker-to-Firebase requests do not carry a browser referrer. If separate keys are created, test the Worker lookup before rollout.

Never put a service-account JSON file, private key, OAuth client secret, user password, Firebase refresh token or Firebase ID token in source control, chat, screenshots or client configuration. The Google Web Client ID is public; its OAuth client secret must remain server-side and is not needed by this client integration.

## First sign-in flow

1. Create an account with name, email and password. Firebase sends the verification email.
2. The account is not connected to game saves until Firebase confirms `emailVerified === true`.
3. Return to the app and press **I've verified my email**.
4. The browser exchanges the stored refresh token for a fresh ID token and checks the user record.
5. The Cloudflare Worker independently calls Firebase `accounts:lookup`, checks that the account is enabled and email-verified, then asks the AuthIndex Durable Object to link or create the commander profile.
6. Cloudflare returns an HttpOnly session cookie. Existing game saves remain attached to the same internal player ID when an existing commander email is linked.

Google sign-in follows the same Worker verification and game-session flow after Firebase exchanges the Google credential.

## Deploy requirements

- Build the frontend with the supplied OAuth Web Client ID already configured; the environment variable can override it if the ID is rotated. The Google provider and authorized origins must be enabled in the Firebase and Google consoles.
- Deploy the updated `worker/index.js` along with the built assets. Deploying assets without the Worker changes will leave account creation unable to establish a secure game session.
- The Worker uses the existing Durable Object bindings. It adds a nullable `firebase_uid` column and a unique partial index to link identities. Existing player-save IDs are preserved.
- Check `/api/health`, then test registration, verification, sign-in, reset, Google sign-in, logout and cross-device save restoration on the production domain.

## Known rollout behavior

The old public `/api/auth/register` and `/api/auth/login` routes now return HTTP 410 so new accounts cannot bypass Firebase verification. Existing active Cloudflare sessions continue to work until they expire. An existing commander can create a Firebase account using the same verified email address to link to the existing profile and preserve saves.

This source package includes the supplied OAuth Web Client ID, but cannot prove that Firebase providers are enabled, authorized domains are correct, or the updated Cloudflare Worker has been deployed. Those production-console settings must be completed and tested.
