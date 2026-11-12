import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROCKET, buildStandardRocket, calculateRocketMetrics } from '../src/game/rocket.ts';

test('standard rocket is ready for an educational expedition', () => {
  const metrics = calculateRocketMetrics(buildStandardRocket());
  assert.equal(metrics.readiness, true);
  assert.ok(metrics.fuel >= 72);
  assert.ok(metrics.thrust >= 78);
  assert.ok(metrics.stability > 70);
});

test('rocket cannot launch without essential propulsion, fuel, capsule and communications', () => {
  for (const missing of ['crewCapsule', 'mainEngine', 'fuelTank', 'communications']) {
    const config = { ...DEFAULT_ROCKET, [missing]: false };
    assert.equal(calculateRocketMetrics(config).readiness, false, `${missing} must be required`);
  }
});

test('rocket metrics change when boosters and science payload are removed', () => {
  const full = calculateRocketMetrics({ ...DEFAULT_ROCKET });
  const light = calculateRocketMetrics({ ...DEFAULT_ROCKET, booster: false, sciencePayload: false });
  assert.ok(light.mass < full.mass);
  assert.ok(light.thrust < full.thrust);
});
