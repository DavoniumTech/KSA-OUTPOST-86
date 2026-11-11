import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarsMission, marsObjective, applyMarsAction, advanceMarsDay } from '../src/game/frontierSimulation.ts';

test('Mars mission starts with a day-one commissioning objective', () => {
  const state = createMarsMission();
  assert.equal(state.destination, 'mars');
  assert.equal(state.day, 1);
  assert.match(marsObjective(state).title, /Commission the habitat/);
  assert.equal(marsObjective(state).complete, false);
});

test('Mars mission requires commissioning before advancing', () => {
  const state = createMarsMission();
  const result = advanceMarsDay(state);
  assert.equal(result.ok, false);
  assert.equal(result.state.day, 1);
});

test('Mars commissioning records an immutable system-inspection action', () => {
  const state = createMarsMission();
  const result = applyMarsAction(state, 'inspect-systems');
  assert.equal(result.ok, true);
  assert.equal(state.systemsInspected, false);
  assert.equal(result.state.systemsInspected, true);
  assert.equal(marsObjective(result.state).complete, true);
});

test('Mars day two applies the dust-front power event and allows a conserve plan', () => {
  let state = applyMarsAction(createMarsMission(), 'inspect-systems').state;
  state = advanceMarsDay(state).state;
  assert.equal(state.day, 2);
  assert.equal(state.solarGeneration, 11);
  const result = applyMarsAction(state, 'power-conserve');
  assert.equal(result.ok, true);
  assert.equal(result.state.powerDemand, 13);
  assert.equal(result.state.events[0].resolved, true);
});

test('Mars water recovery requires a repair or conservation response', () => {
  let state = applyMarsAction(createMarsMission(), 'inspect-systems').state;
  state = advanceMarsDay(state).state;
  state = applyMarsAction(state, 'power-conserve').state;
  state = advanceMarsDay(state).state;
  assert.equal(state.day, 3);
  const repair = applyMarsAction(state, 'repair-water');
  assert.equal(repair.ok, true);
  assert.equal(repair.state.waterRecovery, 92);
  assert.equal(repair.state.battery, state.battery - 10);
});

test('Mars rover cannot collect a sample before deployment', () => {
  let state = createMarsMission();
  for (const action of ['inspect-systems']) state = applyMarsAction(state, action).state;
  state = advanceMarsDay(state).state;
  state = applyMarsAction(state, 'power-conserve').state;
  state = advanceMarsDay(state).state;
  state = applyMarsAction(state, 'repair-water').state;
  state = advanceMarsDay(state).state;
  state = applyMarsAction(state, 'secure-shelter').state;
  state = advanceMarsDay(state).state;
  state = applyMarsAction(state, 'greenhouse-grow').state;
  state = advanceMarsDay(state).state;
  const rejected = applyMarsAction(state, 'collect-sample');
  assert.equal(rejected.ok, false);
  const deployed = applyMarsAction(state, 'deploy-rover');
  assert.equal(deployed.ok, true);
  assert.equal(applyMarsAction(deployed.state, 'collect-sample').state.sampleCollected, true);
});

test('Mars campaign can be assessed on day seven', () => {
  let state = createMarsMission();
  state = applyMarsAction(state, 'inspect-systems').state;
  state = advanceMarsDay(state).state;
  state = applyMarsAction(state, 'power-conserve').state;
  state = advanceMarsDay(state).state;
  state = applyMarsAction(state, 'repair-water').state;
  state = advanceMarsDay(state).state;
  state = applyMarsAction(state, 'secure-shelter').state;
  state = advanceMarsDay(state).state;
  state = applyMarsAction(state, 'greenhouse-grow').state;
  state = advanceMarsDay(state).state;
  state = applyMarsAction(state, 'deploy-rover').state;
  state = applyMarsAction(state, 'collect-sample').state;
  state = advanceMarsDay(state).state;
  const result = applyMarsAction(state, 'final-assessment');
  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'completed');
  assert.ok(result.state.score >= 0 && result.state.score <= 100);
});
