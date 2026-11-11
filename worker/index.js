const SESSION_COOKIE = 'ksa_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function shardFor(value) {
  let hash = 2166136261;
  for (const char of String(value).toLowerCase()) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % 16;
}

function authStub(env, shard = 0) {
  const id = env.AUTH_INDEX.idFromName(`ksa-outpost-86-auth-shard-${shard}`);
  return env.AUTH_INDEX.get(id);
}

function shardFromToken(token) {
  const shard = Number(String(token || '').split('.')[0]);
  return Number.isInteger(shard) && shard >= 0 && shard < 16 ? shard : 0;
}

async function authenticatedUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const response = await authStub(env, shardFromToken(token)).fetch(new Request('https://auth.internal/me', {
    headers: { 'x-session-token': token },
  }));
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.user || null;
}

function cookieFor(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

async function forwardAuth(request, env, pathname) {
  const headers = new Headers(request.headers);
  let shard = 0;
  if (pathname === '/logout' || pathname === '/profile') {
    const token = getCookie(request, SESSION_COOKIE);
    headers.set('x-session-token', token);
    shard = shardFromToken(token);
  } else {
    const input = await request.clone().json().catch(() => ({}));
    shard = shardFor(String(input.email || '').trim().toLowerCase());
  }
  headers.set('x-auth-shard', String(shard));
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
  const forwarded = new Request(`https://auth.internal${pathname}`, { method: request.method, headers, body });
  const response = await authStub(env, shard).fetch(forwarded);
  const payload = await response.json().catch(() => ({ error: 'Authentication service returned invalid data.' }));
  if (!response.ok) return json(payload, response.status);
  if (payload.sessionToken) {
    const token = payload.sessionToken;
    delete payload.sessionToken;
    return json(payload, response.status, { 'set-cookie': cookieFor(token) });
  }
  if (pathname === '/logout') {
    return json(payload, response.status, { 'set-cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
  }
  return json(payload, response.status);
}

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/api/health') {
      return json({ ok: true, service: 'ksa-outpost-86-api', version: 3, accounts: true, playerSaves: true, liveEvents: true });
    }
    if (path === '/api/auth/register' && request.method === 'POST') return forwardAuth(request, env, '/register');
    if (path === '/api/auth/login' && request.method === 'POST') return forwardAuth(request, env, '/login');
    if (path === '/api/auth/me' && request.method === 'GET') {
      const token = getCookie(request, SESSION_COOKIE);
      if (!token) return json({ user: null }, 401);
      return authStub(env, shardFromToken(token)).fetch(new Request('https://auth.internal/me', { headers: { 'x-session-token': token } }));
    }
    if (path === '/api/auth/logout' && request.method === 'POST') {
      return forwardAuth(request, env, '/logout');
    }
    if (path === '/api/auth/profile' && request.method === 'PATCH') {
      return forwardAuth(request, env, '/profile');
    }

    if (path.startsWith('/api/player/')) {
      const user = await authenticatedUser(request, env);
      if (!user) return json({ error: 'Please sign in to access your commander profile.' }, 401);
      const player = env.PLAYER_DATA.get(env.PLAYER_DATA.idFromName(user.id));
      if (path === '/api/player/save' && (request.method === 'GET' || request.method === 'PUT')) {
        const body = request.method === 'PUT' ? await request.text() : undefined;
        if (body && body.length > 450_000) return json({ error: 'Mission save exceeds the 450 KB limit.' }, 413);
        const headers = new Headers({ 'x-player-id': user.id });
        if (body) headers.set('content-type', 'application/json');
        return player.fetch(`https://player.internal/save`, { method: request.method, headers, body });
      }
      if (path === '/api/player/events' && request.method === 'POST') {
        const body = await request.text();
        if (body.length > 4_000) return json({ error: 'Mission event is too large.' }, 413);
        const stored = await player.fetch('https://player.internal/events', {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-player-id': user.id }, body,
        });
        if (!stored.ok) return stored;
        const event = await stored.json();
        const room = env.LIVE_ROOM.get(env.LIVE_ROOM.idFromName(user.id));
        await room.fetch('https://live.internal/broadcast', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'mission-event', ...event }),
        });
        return json({ ok: true });
      }
      if (path === '/api/player/events' && request.method === 'GET') {
        return player.fetch('https://player.internal/events', { headers: { 'x-player-id': user.id } });
      }
    }

    if (path === '/api/realtime' && request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const user = await authenticatedUser(request, env);
      if (!user) return json({ error: 'Sign in to open a live mission channel.' }, 401);
      const room = env.LIVE_ROOM.get(env.LIVE_ROOM.idFromName(user.id));
      return room.fetch(new Request('https://live.internal/connect', { method: 'GET', headers: request.headers }));
    }

    return env.ASSETS.fetch(request);
  },
};

export class AuthIndex {
  constructor(ctx, _env) {
    this.ctx = ctx;
    const sql = ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      theme TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`);
    sql.exec('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)');
    sql.exec('CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)');
    sql.exec('CREATE TABLE IF NOT EXISTS auth_attempts (email TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_started_at INTEGER NOT NULL)');
  }

  async fetch(request) {
    // Keep the shard request-scoped: Durable Object requests can interleave
    // across awaits, so an instance property could associate a session with
    // another concurrent request's shard.
    const shard = Number(request.headers.get('x-auth-shard') || 0);
    const path = new URL(request.url).pathname;
    if (path === '/register' && request.method === 'POST') return this.register(request, shard);
    if (path === '/login' && request.method === 'POST') return this.login(request, shard);
    if (path === '/me' && request.method === 'GET') return this.me(request);
    if (path === '/logout' && request.method === 'POST') return this.logout(request);
    if (path === '/profile' && request.method === 'PATCH') return this.updateProfile(request);
    return json({ error: 'Unknown authentication operation.' }, 404);
  }

  async register(request, shard) {
    const input = await request.json().catch(() => null);
    if (!input || typeof input !== 'object') return json({ error: 'A valid account form is required.' }, 400);
    const email = String(input.email || '').trim().toLowerCase();
    const name = String(input.name || '').trim().replace(/[<>]/g, '').slice(0, 40);
    const password = String(input.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) return json({ error: 'Enter a valid email address.' }, 400);
    if (name.length < 2) return json({ error: 'Commander name must contain at least two characters.' }, 400);
    if (password.length < 10 || password.length > 128) return json({ error: 'Password must contain between 10 and 128 characters.' }, 400);
    const existing = this.ctx.storage.sql.exec('SELECT id FROM users WHERE email = ?', email).toArray();
    if (existing.length) return json({ error: 'An account with this email already exists. Sign in instead.' }, 409);
    const salt = randomHex(16);
    const passwordHash = await derivePassword(password, salt);
    const id = crypto.randomUUID();
    const avatar = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
    this.ctx.storage.sql.exec(
      'INSERT INTO users (id,email,name,avatar,theme,password_hash,salt,onboarding_complete,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      id, email, name, avatar, 'light', passwordHash, salt, 0, Date.now(),
    );
    return this.createSession({ id, email, name, avatar, theme: 'light', onboardingComplete: false }, shard);
  }

  async login(request, shard) {
    const input = await request.json().catch(() => null);
    const email = String(input?.email || '').trim().toLowerCase();
    const password = String(input?.password || '');
    if (!email || email.length > 190 || password.length > 128) return json({ error: 'Email or password is incorrect.' }, 401);
    const now = Date.now();
    const attempts = this.ctx.storage.sql.exec('SELECT failures, window_started_at FROM auth_attempts WHERE email = ?', email).toArray()[0];
    if (attempts && now - attempts.window_started_at < 15 * 60 * 1000 && attempts.failures >= 8) {
      return json({ error: 'Too many sign-in attempts. Wait 15 minutes before trying again.' }, 429, { 'retry-after': '900' });
    }
    const rows = this.ctx.storage.sql.exec('SELECT * FROM users WHERE email = ?', email).toArray();
    const row = rows[0];
    const check = row ? await derivePassword(password, row.salt) : await derivePassword(password || 'invalid', randomHex(16));
    if (!row || !constantTimeEqual(check, row.password_hash)) {
      const currentWindow = attempts && now - attempts.window_started_at < 15 * 60 * 1000 ? attempts.window_started_at : now;
      const failures = currentWindow === (attempts?.window_started_at) ? (attempts?.failures || 0) + 1 : 1;
      this.ctx.storage.sql.exec(
        'INSERT INTO auth_attempts (email, failures, window_started_at) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET failures = excluded.failures, window_started_at = excluded.window_started_at',
        email, failures, currentWindow,
      );
      return json({ error: 'Email or password is incorrect.' }, 401);
    }
    this.ctx.storage.sql.exec('DELETE FROM auth_attempts WHERE email = ?', email);
    return this.createSession(publicUser(row), shard);
  }

  async updateProfile(request) {
    const token = request.headers.get('x-session-token') || '';
    if (!token) return json({ error: 'Sign in to update your commander profile.' }, 401);
    const tokenHash = await sha256(token);
    const row = this.ctx.storage.sql.exec(
      'SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?',
      tokenHash, Date.now(),
    ).toArray()[0];
    if (!row) return json({ error: 'Your session has expired. Sign in again.' }, 401);
    const input = await request.json().catch(() => null);
    if (!input || typeof input !== 'object') return json({ error: 'A valid profile update is required.' }, 400);
    const name = typeof input.name === 'string' ? input.name.trim().replace(/[<>]/g, '').slice(0, 40) : row.name;
    const avatar = typeof input.avatar === 'string' && /^[A-Z0-9]{1,3}$/.test(input.avatar) ? input.avatar : row.avatar;
    const theme = ['light', 'dark', 'glass'].includes(input.theme) ? input.theme : row.theme;
    const onboarding = typeof input.onboardingComplete === 'boolean' ? Number(input.onboardingComplete) : row.onboarding_complete;
    if (name.length < 2) return json({ error: 'Commander name must contain at least two characters.' }, 400);
    this.ctx.storage.sql.exec(
      'UPDATE users SET name = ?, avatar = ?, theme = ?, onboarding_complete = ? WHERE id = ?',
      name, avatar, theme, onboarding, row.id,
    );
    const updated = this.ctx.storage.sql.exec('SELECT * FROM users WHERE id = ?', row.id).toArray()[0];
    return json({ user: publicUser(updated) });
  }

  async createSession(user, shard) {
    this.ctx.storage.sql.exec('DELETE FROM sessions WHERE expires_at < ?', Date.now());
    const safeShard = Number.isInteger(shard) && shard >= 0 && shard < 16 ? shard : 0;
    const token = `${safeShard}.${user.id}.${randomHex(32)}`;
    const tokenHash = await sha256(token);
    const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
    this.ctx.storage.sql.exec('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', tokenHash, user.id, expiresAt);
    return json({ user, sessionToken: token });
  }

  async me(request) {
    const token = request.headers.get('x-session-token') || '';
    if (!token) return json({ user: null }, 401);
    const tokenHash = await sha256(token);
    const rows = this.ctx.storage.sql.exec(
      'SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?',
      tokenHash, Date.now(),
    ).toArray();
    if (!rows.length) return json({ user: null }, 401);
    return json({ user: publicUser(rows[0]) });
  }

  async logout(request) {
    const token = request.headers.get('cookie-token') || request.headers.get('x-session-token') || '';
    if (token) this.ctx.storage.sql.exec('DELETE FROM sessions WHERE token_hash = ?', await sha256(token));
    return json({ ok: true });
  }
}

export class PlayerStore {
  constructor(ctx, _env) { this.ctx = ctx; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const playerId = request.headers.get('x-player-id');
    if (!playerId) return json({ error: 'Player identity is required.' }, 400);
    if (path === '/save' && request.method === 'GET') {
      const save = await this.ctx.storage.get('save-v3');
      return json({ save: save || null });
    }
    if (path === '/save' && request.method === 'PUT') {
      const save = await request.json().catch(() => null);
      if (!save || save.version !== 3 || !['earth', 'moon', 'mars'].includes(save.planet)) return json({ error: 'The mission save is invalid.' }, 400);
      await this.ctx.storage.put('save-v3', save);
      return json({ ok: true, savedAt: Date.now() });
    }
    if (path === '/events' && request.method === 'GET') return json({ events: (await this.ctx.storage.get('events-v1')) || [] });
    if (path === '/events' && request.method === 'POST') {
      const event = await request.json().catch(() => null);
      if (!event || typeof event.title !== 'string' || typeof event.body !== 'string') return json({ error: 'Invalid mission event.' }, 400);
      const items = (await this.ctx.storage.get('events-v1')) || [];
      const safe = { title: event.title.slice(0, 100), body: event.body.slice(0, 500), tone: ['success', 'warning', 'info'].includes(event.tone) ? event.tone : 'info', time: Date.now() };
      items.unshift(safe);
      await this.ctx.storage.put('events-v1', items.slice(0, 100));
      return json(safe);
    }
    return json({ error: 'Unknown player data operation.' }, 404);
  }
}

export class LiveRoom {
  constructor(ctx, _env) { this.ctx = ctx; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/connect' && request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ connectedAt: Date.now() });
      return new Response(null, { status: 101, webSocket: client });
    }
    if (path === '/broadcast' && request.method === 'POST') {
      const message = await request.json().catch(() => null);
      if (!message || message.type !== 'mission-event') return json({ error: 'Invalid event payload.' }, 400);
      const encoded = JSON.stringify(message);
      let delivered = 0;
      for (const socket of this.ctx.getWebSockets()) {
        try { socket.send(encoded); delivered += 1; } catch { try { socket.close(1011, 'Delivery failed'); } catch { /* already closed */ } }
      }
      return json({ ok: true, delivered });
    }
    return json({ error: 'Unknown live-room operation.' }, 404);
  }
  webSocketMessage(socket, message) {
    if (message === 'ping') socket.send('pong');
  }
  webSocketClose(_socket, _code, _reason, _clean) { /* Hibernating socket is removed by the runtime. */ }
  webSocketError(_socket, _error) { /* Hibernating socket is removed by the runtime. */ }
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    theme: ['light', 'dark', 'glass'].includes(row.theme) ? row.theme : 'light',
    onboardingComplete: Boolean(row.onboarding_complete),
  };
}

function randomHex(bytes) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return [...values].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function derivePassword(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) || [], (value) => parseInt(value, 16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 180_000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}
