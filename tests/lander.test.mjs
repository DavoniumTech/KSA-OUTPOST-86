import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanderState, startLander, stepLander } from '../src/game/lander.ts';

test('creates a ready lunar landing exercise with bounded fuel', () => {
  const state = createLanderState();
  assert.equal(state.phase, 'ready');
  assert.equal(state.fuel, 100);
  assert.ok(state.altitude > 0);
});

test('starts only a ready lander', () => {
  const ready = createLanderState();
  assert.equal(startLander(ready).phase, 'flight');
  const landed = createLanderState({ phase: 'landed' });
  assert.equal(startLander(landed), landed);
});

test('does not mutate the input state and clamps controls', () => {
  const initial = startLander(createLanderState());
  const next = stepLander(initial, { throttle: 3, lateral: -4 }, 0.05);
  assert.equal(initial.elapsed, 0);
  assert.equal(initial.fuel, 100);
  assert.ok(next.fuel < initial.fuel);
  assert.ok(next.horizontalVelocity < initial.horizontalVelocity);
});

test('caps a long frame to keep simulation steps stable', () => {
  const initial = startLander(createLanderState());
  const next = stepLander(initial, { throttle: 0, lateral: 0 }, 5);
  assert.ok(next.elapsed <= 0.05);
});

test('classifies a low-speed touchdown as a safe training landing', () => {
  const initial = startLander(createLanderState({
    altitude: 0.02,
    horizontalPosition: 0,
    horizontalVelocity: 0.3,
    verticalVelocity: -0.5,
  }));
  const next = stepLander(initial, { throttle: 0.4, lateral: 0 }, 0.05);
  assert.equal(next.phase, 'landed');
  assert.equal(next.altitude, 0);
});

test('classifies a high-speed touchdown as a crash in the game rubric', () => {
  const initial = startLander(createLanderState({
    altitude: 0.02,
    horizontalPosition: 0,
    horizontalVelocity: 3.5,
    verticalVelocity: -8,
  }));
  const next = stepLander(initial, { throttle: 0, lateral: 0 }, 0.05);
  assert.equal(next.phase, 'crashed');
});

test('keeps fuel non-negative and disables engine thrust after depletion', () => {
  const initial = startLander(createLanderState({ altitude: 100, fuel: 0.001 }));
  const next = stepLander(initial, { throttle: 1, lateral: 0 }, 0.05);
  assert.equal(next.fuel, 0);
  assert.ok(next.verticalVelocity < initial.verticalVelocity);
});

test('settled landers do not continue changing', () => {
  const landed = createLanderState({ phase: 'landed', altitude: 0, fuel: 50 });
  assert.equal(stepLander(landed, { throttle: 1, lateral: 1 }, 0.05), landed);
});

test('a coached control profile can reach the landing pad safely', () => {
  let state = startLander(createLanderState());
  const advance = (seconds, controls) => {
    const frames = Math.ceil(seconds * 60);
    for (let frame = 0; frame < frames && state.phase === 'flight'; frame += 1) {
      state = stepLander(state, controls, 1 / 60);
    }
  };
  advance(2, { throttle: 0.55, lateral: -0.9 });
  advance(8, { throttle: 0.55, lateral: 0 });
  advance(40, { throttle: 0.36, lateral: 0 });
  assert.equal(state.phase, 'landed');
  assert.ok(Math.abs(state.horizontalPosition) <= 12);
  assert.ok(Math.abs(state.verticalVelocity) <= 3);
  assert.ok(state.fuel > 0);
});
