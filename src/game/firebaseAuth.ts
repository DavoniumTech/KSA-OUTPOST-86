/**
 * KSA OUTPOST 86 Firebase Authentication adapter.
 * Uses Firebase's documented Identity Toolkit REST API so the game does not
 * need to ship a second, heavyweight SDK bundle. Firebase remains the source
 * of truth for identities; Cloudflare issues the game's HttpOnly session only
 * after the Worker verifies the Firebase ID token with accounts:lookup.
 */

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAFmEWLoJWW14Y10NBqGBBQ128aeD_dh98',
  authDomain: 'ksa-outpost-86.firebaseapp.com',
  projectId: 'ksa-outpost-86',
  storageBucket: 'ksa-outpost-86.firebasestorage.app',
  messagingSenderId: '731586576287',
  appId: '1:731586576287:web:cf2454e24e65e23ea5c7aa',
} as const;

const API_ROOT = 'https://identitytoolkit.googleapis.com/v1';
const TOKEN_ROOT = 'https://securetoken.googleapis.com/v1';
const TOKEN_DB = 'ksa-outpost-86-auth-v1';
const TOKEN_STORE = 'credentials';
const TOKEN_KEY = 'firebase-refresh-token';
const GOOGLE_SCRIPT_ID = 'ksa-google-identity-services';
const GOOGLE_CLIENT_ID = ((import.meta.env?.VITE_FIREBASE_GOOGLE_CLIENT_ID as string | undefined) || '731586576287-01famnir02e3rq2o5765d74v4dj0q8k0.apps.googleusercontent.com').trim();

export interface FirebaseTokens {
  idToken: string;
  refreshToken: string;
  expiresIn?: string;
  localId?: string;
  email?: string;
  displayName?: string;
}

export interface FirebaseUserRecord {
  localId: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoUrl?: string;
  disabled?: boolean;
}

interface FirebaseErrorPayload {
  error?: { message?: string; code?: number };
}

interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GoogleIdentityApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(element: HTMLElement, options: {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: number;
  }): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityApi } };
  }
}

const FIREBASE_ERRORS: Record<string, string> = {
  EMAIL_EXISTS: 'This email cannot be used for a new account. Try signing in or use another address.',
  EMAIL_NOT_FOUND: 'Email or password is incorrect.',
  INVALID_PASSWORD: 'Email or password is incorrect.',
  INVALID_LOGIN_CREDENTIALS: 'Email or password is incorrect.',
  INVALID_EMAIL: 'Enter a valid email address.',
  WEAK_PASSWORD: 'Choose a stronger password with at least 10 characters.',
  OPERATION_NOT_ALLOWED: 'This sign-in method is not enabled in Firebase Authentication yet.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Firebase temporarily blocked attempts from this device. Please wait and try again.',
  USER_DISABLED: 'This account has been disabled. Contact the project administrator.',
  INVALID_ID_TOKEN: 'Your sign-in has expired. Please sign in again.',
  TOKEN_EXPIRED: 'Your sign-in has expired. Please sign in again.',
  USER_NOT_FOUND: 'This account could not be found.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'For security, sign in again before continuing.',
  INVALID_API_KEY: 'Firebase Authentication is not configured correctly. Check the web app API key.',
  API_KEY_SERVICE_BLOCKED: 'The Firebase API key is restricted from using Authentication. Check its allowed APIs.',
  PROJECT_NOT_FOUND: 'The Firebase project could not be found. Check the project configuration.',
  PROVIDER_ALREADY_LINKED: 'This sign-in provider is already linked to the account.',
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL: 'This email is already linked to another sign-in method. Sign in using the original method.',
};

export function firebaseErrorMessage(code: string): string {
  const normalized = code.split(':').pop()?.trim() || code;
  return FIREBASE_ERRORS[normalized] || 'Firebase could not complete the request. Check the settings and try again.';
}

export function commanderInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.map((part) => part[0]).join('').slice(0, 2) || '86').toUpperCase();
}

async function firebasePost<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}/${endpoint}?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Cannot reach Firebase Authentication. Check your internet connection and try again.');
  }
  const result = await response.json().catch(() => ({})) as T & FirebaseErrorPayload;
  if (!response.ok) {
    const code = result.error?.message || 'AUTHENTICATION_FAILED';
    throw new Error(firebaseErrorMessage(code));
  }
  return result;
}

export async function createFirebaseAccount(email: string, password: string, displayName: string): Promise<FirebaseTokens> {
  const created = await firebasePost<FirebaseTokens>('accounts:signUp', {
    email: email.trim(), password, returnSecureToken: true,
  });
  const updated = await firebasePost<FirebaseTokens>('accounts:update', {
    idToken: created.idToken,
    displayName: displayName.trim().slice(0, 40),
    returnSecureToken: true,
  });
  const tokens: FirebaseTokens = {
    ...created,
    ...updated,
    idToken: updated.idToken || created.idToken,
    refreshToken: updated.refreshToken || created.refreshToken,
    email: updated.email || created.email || email.trim(),
    displayName: displayName.trim().slice(0, 40),
  };
  await sendFirebaseVerification(tokens.idToken);
  await storeFirebaseRefreshToken(tokens.refreshToken);
  return tokens;
}

export async function signInFirebaseWithPassword(email: string, password: string): Promise<FirebaseTokens> {
  const tokens = await firebasePost<FirebaseTokens>('accounts:signInWithPassword', {
    email: email.trim(), password, returnSecureToken: true,
  });
  await storeFirebaseRefreshToken(tokens.refreshToken);
  return tokens;
}

export async function lookupFirebaseUser(idToken: string): Promise<FirebaseUserRecord> {
  const result = await firebasePost<{ users?: FirebaseUserRecord[] }>('accounts:lookup', { idToken });
  const user = result.users?.[0];
  if (!user?.localId || !user.email) throw new Error('Firebase did not return a valid account profile.');
  return user;
}

export async function sendFirebaseVerification(idToken: string): Promise<void> {
  await firebasePost('accounts:sendOobCode', {
    requestType: 'VERIFY_EMAIL', idToken,
    continueUrl: typeof window === 'undefined' ? undefined : `${window.location.origin}/?authAction=verified`,
  });
}

export async function resendFirebaseVerification(): Promise<void> {
  const restored = await refreshStoredFirebaseSession();
  if (!restored) throw new Error('Your pending sign-up session has expired. Sign in again to resend verification.');
  if (restored.user.emailVerified) throw new Error('This email address is already verified. Select Continue to sign in.');
  await sendFirebaseVerification(restored.tokens.idToken);
}

export async function sendFirebasePasswordReset(email: string): Promise<void> {
  try {
    await firebasePost('accounts:sendOobCode', {
      requestType: 'PASSWORD_RESET', email: email.trim(),
      continueUrl: typeof window === 'undefined' ? undefined : `${window.location.origin}/?authAction=password-reset`,
    });
  } catch (error) {
    // Do not expose whether an address has a Firebase account. Surface only
    // transport/configuration failures; otherwise keep the response generic.
    if (error instanceof Error && /Cannot reach Firebase|not configured correctly|restricted from using Authentication/i.test(error.message)) throw error;
  }
}

export async function refreshStoredFirebaseSession(): Promise<{ tokens: FirebaseTokens; user: FirebaseUserRecord } | null> {
  const refreshToken = await readFirebaseRefreshToken();
  if (!refreshToken) return null;
  let response: Response;
  try {
    response = await fetch(`${TOKEN_ROOT}/token?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
    });
  } catch {
    throw new Error('Cannot reach Firebase to refresh your sign-in. Check your internet connection.');
  }
  const refreshed = await response.json().catch(() => ({})) as {
    id_token?: string; refresh_token?: string; expires_in?: string; user_id?: string; error?: { message?: string };
  };
  if (!response.ok || !refreshed.id_token || !refreshed.refresh_token) {
    if (refreshed.error?.message === 'INVALID_REFRESH_TOKEN' || refreshed.error?.message === 'TOKEN_EXPIRED') {
      await clearFirebaseRefreshToken();
      return null;
    }
    throw new Error(firebaseErrorMessage(refreshed.error?.message || 'TOKEN_REFRESH_FAILED'));
  }
  const tokens: FirebaseTokens = {
    idToken: refreshed.id_token,
    refreshToken: refreshed.refresh_token,
    expiresIn: refreshed.expires_in,
    localId: refreshed.user_id,
  };
  await storeFirebaseRefreshToken(tokens.refreshToken);
  const user = await lookupFirebaseUser(tokens.idToken);
  return { tokens, user };
}

export async function exchangeGoogleCredential(googleIdToken: string): Promise<FirebaseTokens> {
  const postBody = new URLSearchParams({ id_token: googleIdToken, providerId: 'google.com' }).toString();
  const tokens = await firebasePost<FirebaseTokens>('accounts:signInWithIdp', {
    postBody,
    requestUri: window.location.origin,
    returnSecureToken: true,
    returnIdpCredential: true,
  });
  await storeFirebaseRefreshToken(tokens.refreshToken);
  return tokens;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID);
}

let googleScriptPromise: Promise<void> | null = null;
let googleCredentialHandler: ((credential: string) => void | Promise<void>) | null = null;
let googleInitialized = false;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  const pending = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing || document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) resolve();
      else reject(new Error('Google sign-in library did not initialise.'));
    };
    script.onerror = () => reject(new Error('Google sign-in could not load. Check your connection or content-blocker settings.'));
    if (!existing) document.head.appendChild(script);
  });
  googleScriptPromise = pending.catch((error: unknown) => {
    googleScriptPromise = null;
    throw error;
  });
  return googleScriptPromise;
}

export async function mountGoogleSignInButton(
  container: HTMLElement,
  onCredential: (credential: string) => void | Promise<void>,
): Promise<boolean> {
  if (!GOOGLE_CLIENT_ID) return false;
  googleCredentialHandler = onCredential;
  await loadGoogleIdentityScript();
  const googleId = window.google?.accounts?.id;
  if (!googleId) throw new Error('Google sign-in is not available in this browser.');
  if (!googleInitialized) {
    googleId.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (response.credential && googleCredentialHandler) void googleCredentialHandler(response.credential);
      },
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    googleInitialized = true;
  }
  container.replaceChildren();
  googleId.renderButton(container, {
    type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'left', width: Math.max(220, Math.min(360, Math.floor(container.clientWidth || 320))),
  });
  return true;
}

function openTokenDatabase(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(TOKEN_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TOKEN_STORE)) db.createObjectStore(TOKEN_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

export async function storeFirebaseRefreshToken(token: string): Promise<void> {
  const db = await openTokenDatabase();
  if (db) {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(TOKEN_STORE, 'readwrite');
      transaction.objectStore(TOKEN_STORE).put(token, TOKEN_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
    db.close();
    return;
  }
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* The HttpOnly game session remains usable until it expires. */ }
}

async function readFirebaseRefreshToken(): Promise<string | null> {
  const db = await openTokenDatabase();
  if (db) {
    const token = await new Promise<string | null>((resolve) => {
      const transaction = db.transaction(TOKEN_STORE, 'readonly');
      const request = transaction.objectStore(TOKEN_STORE).get(TOKEN_KEY);
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () => resolve(null);
    });
    db.close();
    return token;
  }
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export async function clearFirebaseRefreshToken(): Promise<void> {
  const db = await openTokenDatabase();
  if (db) {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(TOKEN_STORE, 'readwrite');
      transaction.objectStore(TOKEN_STORE).delete(TOKEN_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
    db.close();
  }
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* Optional fallback storage. */ }
}
