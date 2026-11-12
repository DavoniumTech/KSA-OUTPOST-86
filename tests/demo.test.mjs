import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_DURATION_MS, DEMO_TASKS, createDemoSession, demoRemainingSeconds, finishDemoSession, formatDemoTime, loadDemoSession, recordDemoTask } from '../src/game/demo.ts';

test('five-minute demo starts with a real five-minute window', () => {
  const session = createDemoSession(1000);
  assert.equal(session.endsAt - session.startedAt, DEMO_DURATION_MS);
  assert.equal(demoRemainingSeconds(session, 1000), 300);
});

test('demo records each objective once and completes when all objectives are done', () => {
  let session = createDemoSession(1000);
  for (const task of DEMO_TASKS) session = recordDemoTask(session, task.id);
  assert.equal(session.status, 'completed');
  assert.equal(session.completedTasks.length, 4);
  assert.equal(recordDemoTask(session, 'sample'), session);
});

test('manual and timed endings are terminal and idempotent', () => {
  const initial = createDemoSession(1000);
  const expired = finishDemoSession(initial, 301000, 'timeout');
  assert.equal(expired.status, 'expired');
  assert.equal(finishDemoSession(expired, 302000, 'manual'), expired);
});

test('malformed demo persistence is rejected', () => {
  assert.equal(loadDemoSession('{bad json'), null);
  assert.equal(loadDemoSession({ version: 9 }), null);
});

test('demo clock formats mm:ss and clamps invalid values', () => {
  assert.equal(formatDemoTime(300), '05:00');
  assert.equal(formatDemoTime(9), '00:09');
  assert.equal(formatDemoTime(-2), '00:00');
});
