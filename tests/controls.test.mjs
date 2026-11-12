import test from 'node:test';
import assert from 'node:assert/strict';
import { mapJoystickDisplacement } from '../src/game/controls.ts';

test('virtual joystick preserves right and forward directions', () => {
  assert.deepEqual(mapJoystickDisplacement(100, 0, 40), { x: 1, y: 0 });
  assert.deepEqual(mapJoystickDisplacement(0, -100, 40), { x: 0, y: -1 });
});

test('virtual joystick clamps diagonal input without increasing total speed', () => {
  const vector = mapJoystickDisplacement(100, 100, 40);
  assert.ok(vector.x > 0 && vector.y > 0);
  assert.ok(Math.abs(Math.hypot(vector.x, vector.y) - 1) < 1e-9);
});

test('virtual joystick has a small centre dead zone', () => {
  assert.deepEqual(mapJoystickDisplacement(1, 1, 40), { x: 0, y: 0 });
});

test('virtual joystick scales partial thumb movement and clamps the radius', () => {
  const partial = mapJoystickDisplacement(20, 0, 40);
  assert.ok(partial.x > 0 && partial.x < 1);
  assert.equal(partial.y, 0);
  const clamped = mapJoystickDisplacement(80, -30, 40);
  assert.ok(Math.hypot(clamped.x, clamped.y) <= 1 + 1e-9);
});

test('virtual joystick safely rejects invalid pointer coordinates', () => {
  assert.deepEqual(mapJoystickDisplacement(Number.NaN, 4, 40), { x: 0, y: 0 });
});
