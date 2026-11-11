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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissionSnapshot(value: unknown): value is MissionState {
  if (!isRecord(value)) return false;
  const numericFields = [
    'day', 'battery', 'solarGeneration', 'powerDemand', 'oxygen', 'cabinAir', 'co2Control',
    'water', 'waterRecovery', 'food', 'greenhouseProgress', 'thermal', 'crewReadiness', 'scienceSamples',
  ] as const;
  const booleanFields = [
    'powerInspected', 'lifeSupportInspected', 'powerPlanConfirmed', 'waterActionComplete',
    'waterConservation', 'shelterSecured', 'greenhouseActionComplete', 'surveyComplete', 'finalCheckComplete',
  ] as const;

  if (!Number.isInteger(value.day) || Number(value.day) < 1 || Number(value.day) > 7) return false;
  if (value.status !== 'active' && value.status !== 'completed' && value.status !== 'terminated') return false;
  if (value.powerPlan !== 'balanced' && value.powerPlan !== 'conserve' && value.powerPlan !== 'research') return false;
  if (value.greenhousePlan !== 'grow' && value.greenhousePlan !== 'conserve' && value.greenhousePlan !== 'idle') return false;
  if (numericFields.some((field) => typeof value[field] !== 'number' || !Number.isFinite(value[field]))) return false;
  if (booleanFields.some((field) => typeof value[field] !== 'boolean')) return false;
  if (numericFields.some((field) => ['battery', 'oxygen', 'cabinAir', 'co2Control', 'water', 'waterRecovery', 'food', 'greenhouseProgress', 'thermal', 'crewReadiness'].includes(field) && (Number(value[field]) < 0 || Number(value[field]) > 100))) return false;
  if (typeof value.solarGeneration !== 'number' || value.solarGeneration < 0 || value.solarGeneration > 100) return false;
  if (typeof value.powerDemand !== 'number' || value.powerDemand < 0 || value.powerDemand > 100) return false;
  if (typeof value.scienceSamples !== 'number' || value.scienceSamples < 0 || value.scienceSamples > 100) return false;
  if (value.currentAlert !== null && typeof value.currentAlert !== 'string') return false;
  if (value.finalScore !== null && (typeof value.finalScore !== 'number' || !Number.isFinite(value.finalScore) || value.finalScore < 0 || value.finalScore > 100)) return false;
  if (value.finalRating !== null && typeof value.finalRating !== 'string') return false;
  if (!Array.isArray(value.events) || !Array.isArray(value.log) || !Array.isArray(value.objectiveHistory)) return false;
  if (value.events.some((event) => !isRecord(event)
    || typeof event.id !== 'string'
    || !Number.isInteger(event.day) || Number(event.day) < 1 || Number(event.day) > 7
    || typeof event.title !== 'string'
    || typeof event.description !== 'string'
    || (event.severity !== 'info' && event.severity !== 'warning' && event.severity !== 'critical')
    || typeof event.resolved !== 'boolean')) return false;
  if (value.log.some((entry) => !isRecord(entry)
    || !Number.isInteger(entry.day) || Number(entry.day) < 1 || Number(entry.day) > 7
    || typeof entry.title !== 'string'
    || typeof entry.detail !== 'string')) return false;
  if (value.objectiveHistory.some((entry) => typeof entry !== 'string')) return false;
  return true;
}

export function loadMission(): MissionState | null {
  try {
    const raw = localStorage.getItem(MISSION_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isMissionSnapshot(value) ? value : null;
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
    return { quality, reducedMotion: raw.reducedMotion === true };
  } catch {
    return { quality: 'medium', reducedMotion: false };
  }
}

export function saveSettings(settings: GameSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Settings remain in memory for this session. */ }
}
