import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const ORIGIN = 'https://ksa-outpost-86.davoniumtech.com';
const VALID_TOKEN = 'firebase-id-token-'.padEnd(180, 'x');

function makeEnv() {
  const calls = [];
  const env = {
    AUTH_INDEX: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          calls.push({ path: new URL(request.url).pathname, body: await request.json() });
          return new Response(JSON.stringify({
            user: { id: 'commander-123', email: 'pilot@example.com', name: 'Pilot One', avatar: 'PO', theme: 'light', onboardingComplete: false },
            sessionToken: '2.commander-123.secure-session-token',
          }), { status: 200 });
        },
      }),
    },
  };
  return { env, calls };
}

async function withFirebaseLookup(user, action) {
  const originalFetch = globalThis.fetch;
  const lookups = [];
  globalThis.fetch = async (url, init) => {
    lookups.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ users: user ? [user] : [] }), { status: 200 });
  };
  try { return await action(lookups); }
  finally { globalThis.fetch = originalFetch; }
}

test('Worker verifies Firebase identity and issues an HttpOnly game session only for verified users', async () => {
  const { env, calls } = makeEnv();
  await withFirebaseLookup({ localId: 'firebase-uid', email: 'pilot@example.com', emailVerified: true, disabled: false, displayName: 'Pilot One' }, async (lookups) => {
    const request = new Request(`${ORIGIN}/api/auth/firebase/session`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: VALID_TOKEN }),
    });
    const response = await worker.fetch(request, env, {});
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.user.email, 'pilot@example.com');
    assert.equal(lookups.length, 1);
    assert.match(lookups[0].url, /identitytoolkit\.googleapis\.com\/v1\/accounts:lookup/);
    assert.equal(lookups[0].body.idToken, VALID_TOKEN);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, '/firebase-session');
    assert.equal(calls[0].body.uid, 'firebase-uid');
    const cookie = response.headers.get('set-cookie') || '';
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
  });
});

test('Worker refuses an unverified or disabled Firebase account before creating a game session', async () => {
  for (const user of [
    { localId: 'unverified', email: 'new@example.com', emailVerified: false, disabled: false },
    { localId: 'disabled', email: 'disabled@example.com', emailVerified: true, disabled: true },
  ]) {
    const { env, calls } = makeEnv();
    await withFirebaseLookup(user, async () => {
      const response = await worker.fetch(new Request(`${ORIGIN}/api/auth/firebase/session`, {
        method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: VALID_TOKEN }),
      }), env, {});
      assert.ok(response.status === 401 || response.status === 403);
      assert.equal(calls.length, 0);
      assert.equal(response.headers.get('set-cookie'), null);
    });
  }
});

test('Worker rejects cross-origin and malformed Firebase session requests', async () => {
  const { env, calls } = makeEnv();
  const crossOrigin = await worker.fetch(new Request(`${ORIGIN}/api/auth/firebase/session`, {
    method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: VALID_TOKEN }),
  }), env, {});
  assert.equal(crossOrigin.status, 403);
  const noOrigin = await worker.fetch(new Request(`${ORIGIN}/api/auth/firebase/session`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: VALID_TOKEN }),
  }), env, {});
  assert.equal(noOrigin.status, 403);
  const malformed = await worker.fetch(new Request(`${ORIGIN}/api/auth/firebase/session`, {
    method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: 'short' }),
  }), env, {});
  assert.equal(malformed.status, 401);
  assert.equal(calls.length, 0);
});

test('Worker rejects oversized Firebase session bodies even without Content-Length', async () => {
  const { env, calls } = makeEnv();
  const oversized = JSON.stringify({ idToken: 'x'.repeat(24_100) });
  const response = await worker.fetch(new Request(`${ORIGIN}/api/auth/firebase/session`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: oversized,
  }), env, {});
  assert.equal(response.status, 413);
  assert.equal(calls.length, 0);
});
