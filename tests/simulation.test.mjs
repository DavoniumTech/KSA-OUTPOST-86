import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceMissionDay,
  applyMissionAction,
  calculateMissionScore,
  canAdvanceDay,
  createInitialMission,
  currentObjective,
} from '../src/game/simulation.ts';

function apply(state, action) {
  const result = applyMissionAction(state, action);
  assert.equal(result.ok, true, result.message);
  return result.state;
}

function advance(state) {
  const result = advanceMissionDay(state);
  assert.equal(result.ok, true, result.message);
  return result.state;
}

test('starts with a Day 1 objective and training resources', () => {
  const state = createInitialMission();
  assert.equal(state.day, 1);
  assert.equal(state.status, 'active');
  assert.equal(currentObjective(state).complete, false);
  assert.equal(canAdvanceDay(state), false);
});

test('does not allow a day to advance before its objective is complete', () => {
  const result = advanceMissionDay(createInitialMission());
  assert.equal(result.ok, false);
  assert.equal(result.state.day, 1);
});

test('keeps oxygen supply and cabin-air inspection separate', () => {
  let state = createInitialMission();
  state = apply(state, 'inspect-power');
  assert.equal(currentObjective(state).complete, false);
  state = apply(state, 'inspect-life-support');
  assert.equal(currentObjective(state).complete, true);
});

test('creates a low-sunlight event and applies the selected power plan', () => {
  let state = createInitialMission();
  state = apply(state, 'inspect-power');
  state = apply(state, 'inspect-life-support');
  state = advance(state);
  assert.equal(state.day, 2);
  assert.equal(state.solarGeneration, 12);
  assert.equal(state.events[0]?.id, 'low-sunlight');
  state = apply(state, 'choose-power-conserve');
  assert.equal(state.powerDemand, 13);
  assert.equal(state.powerPlanConfirmed, true);
  assert.equal(state.events.find((event) => event.id === 'low-sunlight')?.resolved, true);
});

test('offers equipment repair and conservation as distinct water responses', () => {
  let state = createInitialMission();
  state = apply(state, 'inspect-power');
  state = apply(state, 'inspect-life-support');
  state = advance(state);
  state = apply(state, 'choose-power-balanced');
  state = advance(state);
  assert.ok(state.waterRecovery < 82);
  const batteryBefore = state.battery;
  state = apply(state, 'repair-water');
  assert.ok(state.waterRecovery > 80);
  assert.equal(state.battery, batteryBefore - 8);
  assert.equal(state.waterActionComplete, true);
});

test('issues a Day 4 radiation warning and records the shelter procedure', () => {
  let state = createInitialMission();
  state = apply(state, 'inspect-power');
  state = apply(state, 'inspect-life-support');
  state = advance(state);
  state = apply(state, 'choose-power-conserve');
  state = advance(state);
  state = apply(state, 'repair-water');
  state = advance(state);
  assert.equal(state.day, 4);
  assert.equal(state.events[0]?.id, 'radiation-warning');
  state = apply(state, 'secure-shelter');
  assert.equal(state.shelterSecured, true);
  assert.equal(state.events.find((event) => event.id === 'radiation-warning')?.resolved, true);
});

test('progresses greenhouse growth gradually and records a survey sample', () => {
  let state = createInitialMission();
  state = apply(state, 'inspect-power');
  state = apply(state, 'inspect-life-support');
  state = advance(state);
  state = apply(state, 'choose-power-conserve');
  state = advance(state);
  state = apply(state, 'conserve-water');
  state = advance(state);
  state = apply(state, 'secure-shelter');
  state = advance(state);
  state = apply(state, 'greenhouse-grow');
  const initialProgress = state.greenhouseProgress;
  state = advance(state);
  assert.ok(state.greenhouseProgress > initialProgress);
  state = apply(state, 'complete-survey');
  assert.equal(state.scienceSamples, 1);
  assert.equal(state.surveyComplete, true);
});

test('completes the seven-day mission and returns a bounded training score', () => {
  let state = createInitialMission();
  state = apply(state, 'inspect-power');
  state = apply(state, 'inspect-life-support');
  state = advance(state);
  state = apply(state, 'choose-power-conserve');
  state = advance(state);
  state = apply(state, 'repair-water');
  state = advance(state);
  state = apply(state, 'secure-shelter');
  state = advance(state);
  state = apply(state, 'greenhouse-grow');
  state = advance(state);
  state = apply(state, 'complete-survey');
  state = advance(state);
  assert.equal(state.day, 7);
  state = apply(state, 'final-check');
  assert.equal(state.status, 'completed');
  assert.ok(state.finalScore >= 0 && state.finalScore <= 100);
  assert.equal(calculateMissionScore(state), state.finalScore);
});

test('does not mutate the input state when an action is applied', () => {
  const original = createInitialMission();
  const result = applyMissionAction(original, 'inspect-power');
  assert.equal(original.powerInspected, false);
  assert.equal(result.state.powerInspected, true);
});
