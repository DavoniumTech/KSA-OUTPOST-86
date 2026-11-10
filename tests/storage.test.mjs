import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialMission } from '../src/game/simulation.ts';
import { clearMission, loadMission, loadSettings, saveMission, saveSettings } from '../src/game/storage.ts';

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  corrupt(key, value) { this.#values.set(key, value); }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;

test('saves and restores a mission snapshot', () => {
  clearMission();
  const initial = createInitialMission();
  assert.equal(saveMission(initial), true);
  assert.deepEqual(loadMission(), initial);
});

test('rejects corrupt or incomplete saved mission data', () => {
  storage.corrupt('ksa-outpost-86-mission-v1', '{not-json');
  assert.equal(loadMission(), null);
  storage.corrupt('ksa-outpost-86-mission-v1', JSON.stringify({ day: 99, status: 'active', battery: 50, water: 50, log: [] }));
  assert.equal(loadMission(), null);
});

test('loads safe default settings and persists supported preferences', () => {
  storage.removeItem('ksa-outpost-86-settings-v1');
  assert.deepEqual(loadSettings(), { quality: 'medium', reducedMotion: false });
  saveSettings({ quality: 'high', reducedMotion: true });
  assert.deepEqual(loadSettings(), { quality: 'high', reducedMotion: true });
});

test('handles disabled browser storage without crashing', () => {
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } } });
  try {
    assert.equal(saveMission(createInitialMission()), false);
    assert.equal(loadMission(), null);
    assert.deepEqual(loadSettings(), { quality: 'medium', reducedMotion: false });
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: original });
  }
});
