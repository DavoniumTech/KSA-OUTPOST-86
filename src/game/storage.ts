import type { MissionState } from './simulation';

const MISSION_KEY = 'ksa-outpost-86-mission-v1';
const SETTINGS_KEY = 'ksa-outpost-86-settings-v1';

export interface GameSettings {
  quality: 'low' | 'medium' | 'high';
  reducedMotion: boolean;
}

export function saveMission(state: MissionState): boolean {
  try {
    localStorage.setItem(MISSION_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadMission(): MissionState | null {
  try {
    const raw = localStorage.getItem(MISSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<MissionState>;
    if (typeof value.day !== 'number' || value.day < 1 || value.day > 7) return null;
    if (value.status !== 'active' && value.status !== 'completed' && value.status !== 'terminated') return null;
    if (typeof value.battery !== 'number' || typeof value.water !== 'number' || !Array.isArray(value.log)) return null;
    return value as MissionState;
  } catch {
    return null;
  }
}

export function clearMission(): void {
  try { localStorage.removeItem(MISSION_KEY); } catch { /* Storage can be disabled. */ }
}

export function loadSettings(): GameSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<GameSettings>;
    const quality = raw.quality === 'low' || raw.quality === 'high' ? raw.quality : 'medium';
    return { quality, reducedMotion: Boolean(raw.reducedMotion) };
  } catch {
    return { quality: 'medium', reducedMotion: false };
  }
}

export function saveSettings(settings: GameSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Settings remain in memory for this session. */ }
}
