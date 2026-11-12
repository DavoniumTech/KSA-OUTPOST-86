import test from 'node:test';
import assert from 'node:assert/strict';
import { commanderInitials, firebaseErrorMessage, isGoogleSignInConfigured } from '../src/game/firebaseAuth.ts';

test('commander initials are generated safely from names', () => {
  assert.equal(commanderInitials('Al-Amin'), 'A');
  assert.equal(commanderInitials('Imran Bello'), 'IB');
  assert.equal(commanderInitials(''), '86');
});

test('Firebase authentication errors are mapped to safe, readable messages', () => {
  assert.match(firebaseErrorMessage('EMAIL_EXISTS'), /cannot be used/i);
  assert.match(firebaseErrorMessage('INVALID_LOGIN_CREDENTIALS'), /incorrect/i);
  assert.match(firebaseErrorMessage('OPERATION_NOT_ALLOWED'), /not enabled/i);
  assert.match(firebaseErrorMessage('SOME_INTERNAL_SERVER_ERROR'), /could not complete/i);
});

test('Google sign-in is configured with the supplied Firebase OAuth web client ID', () => {
  assert.equal(isGoogleSignInConfigured(), true);
});


test('Firebase registration creates an identity, sets its display name and requests email verification', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const calls = [];
  globalThis.window = { location: { origin: 'https://ksa-outpost-86.davoniumtech.com' } };
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    if (calls.length === 1) return new Response(JSON.stringify({ idToken: 'signup-id-token', refreshToken: 'signup-refresh', localId: 'firebase-uid', email: 'pilot@example.com' }), { status: 200 });
    if (calls.length === 2) return new Response(JSON.stringify({ idToken: 'profile-id-token', refreshToken: 'profile-refresh', localId: 'firebase-uid', displayName: 'Pilot One' }), { status: 200 });
    return new Response(JSON.stringify({ email: 'pilot@example.com' }), { status: 200 });
  };
  try {
    const { createFirebaseAccount } = await import('../src/game/firebaseAuth.ts');
    const tokens = await createFirebaseAccount('pilot@example.com', 'long-strong-password', 'Pilot One');
    assert.equal(tokens.idToken, 'profile-id-token');
    assert.equal(tokens.refreshToken, 'profile-refresh');
    assert.match(calls[0].url, /accounts:signUp/);
    assert.match(calls[1].url, /accounts:update/);
    assert.match(calls[2].url, /accounts:sendOobCode/);
    assert.equal(calls[2].body.requestType, 'VERIFY_EMAIL');
    assert.equal(calls[1].body.displayName, 'Pilot One');
    assert.ok(!calls.some((call) => call.url.includes('/api/auth/')));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('password reset uses the Firebase password-reset action and never a game-backend password route', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const calls = [];
  globalThis.window = { location: { origin: 'https://ksa-outpost-86.davoniumtech.com' } };
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ email: 'pilot@example.com' }), { status: 200 });
  };
  try {
    const { sendFirebasePasswordReset } = await import('../src/game/firebaseAuth.ts');
    await sendFirebasePasswordReset('pilot@example.com');
    assert.match(calls[0].url, /accounts:sendOobCode/);
    assert.equal(calls[0].body.requestType, 'PASSWORD_RESET');
    assert.equal(calls[0].body.email, 'pilot@example.com');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
