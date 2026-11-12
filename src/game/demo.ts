export const DEMO_DURATION_MS = 5 * 60 * 1000;

export const DEMO_TASKS = [
  { id: 'systems', title: 'Inspect habitat systems', detail: 'Inspect oxygen and environmental control.' },
  { id: 'power', title: 'Set a power profile', detail: 'Choose balanced or conserve at the power console.' },
  { id: 'rover', title: 'Deploy the rover', detail: 'Deploy and board the surface rover.' },
  { id: 'sample', title: 'Record a science sample', detail: 'Reach the science beacon and run the surface scan.' },
] as const;

export type DemoTaskId = typeof DEMO_TASKS[number]['id'];
export type DemoStatus = 'active' | 'completed' | 'expired' | 'ended';
export interface DemoSession {
  version: 1;
  status: DemoStatus;
  startedAt: number;
  endsAt: number;
  completedTasks: DemoTaskId[];
  finishedAt: number | null;
}

export function createDemoSession(now = Date.now()): DemoSession {
  const start = Number.isFinite(now) ? Math.max(0, Math.floor(now)) : Date.now();
  return { version: 1, status: 'active', startedAt: start, endsAt: start + DEMO_DURATION_MS, completedTasks: [], finishedAt: null };
}

export function loadDemoSession(raw: unknown): DemoSession | null {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw) as unknown; } catch { return null; }
  }
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<DemoSession>;
  const validIds = new Set<string>(DEMO_TASKS.map((task) => task.id));
  if (item.version !== 1 || !['active','completed','expired','ended'].includes(item.status ?? '') || !Number.isFinite(item.startedAt) || !Number.isFinite(item.endsAt) || !Array.isArray(item.completedTasks)) return null;
  const completedTasks = [...new Set(item.completedTasks.filter((id): id is DemoTaskId => typeof id === 'string' && validIds.has(id)))];
  const startedAt = Math.max(0, Math.floor(item.startedAt as number));
  const endsAt = Math.max(startedAt, Math.floor(item.endsAt as number));
  const finishedAt = Number.isFinite(item.finishedAt) ? Math.max(startedAt, Math.floor(item.finishedAt as number)) : null;
  return { version: 1, status: item.status as DemoStatus, startedAt, endsAt, completedTasks, finishedAt };
}

export function recordDemoTask(session: DemoSession, task: DemoTaskId): DemoSession {
  if (session.status !== 'active' || session.completedTasks.includes(task)) return session;
  const completedTasks = [...session.completedTasks, task];
  const complete = DEMO_TASKS.every((item) => completedTasks.includes(item.id));
  return { ...session, completedTasks, status: complete ? 'completed' : 'active', finishedAt: complete ? Date.now() : null };
}

export function finishDemoSession(session: DemoSession, now = Date.now(), reason: 'timeout' | 'manual' = 'manual'): DemoSession {
  if (session.status !== 'active') return session;
  const finish = Number.isFinite(now) ? Math.max(session.startedAt, Math.floor(now)) : Date.now();
  return { ...session, status: reason === 'timeout' ? 'expired' : 'ended', finishedAt: finish };
}

export function demoRemainingSeconds(session: DemoSession, now = Date.now()): number {
  if (session.status !== 'active') return 0;
  return Math.max(0, Math.ceil((session.endsAt - now) / 1000));
}

export function formatDemoTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
