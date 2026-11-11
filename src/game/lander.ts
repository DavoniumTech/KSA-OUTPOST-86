/**
 * A deliberately simplified two-dimensional lunar landing exercise.
 * Values are game parameters, not a flight dynamics or engineering model.
 */

export type LanderPhase = 'ready' | 'flight' | 'landed' | 'crashed';

export interface LanderState {
  altitude: number;
  horizontalPosition: number;
  horizontalVelocity: number;
  verticalVelocity: number;
  fuel: number;
  elapsed: number;
  phase: LanderPhase;
}

export interface LanderControls {
  /** Engine throttle from 0 to 1. */
  throttle: number;
  /** Lateral control from -1 (left) to 1 (right). */
  lateral: number;
}

const GRAVITY = 1.62;
const MAX_VERTICAL_ACCELERATION = 4.5;
const MAX_LATERAL_ACCELERATION = 1.2;
const MAX_FUEL_FLOW_PER_SECOND = 1.35;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function createLanderState(overrides: Partial<LanderState> = {}): LanderState {
  return {
    altitude: 180,
    horizontalPosition: -6,
    horizontalVelocity: 2.2,
    verticalVelocity: -11.5,
    fuel: 100,
    elapsed: 0,
    phase: 'ready',
    ...overrides,
  };
}

export function startLander(state: LanderState): LanderState {
  return state.phase === 'ready' ? { ...state, phase: 'flight' } : state;
}

/** Advance the training model by at most 50 ms and return a new state. */
export function stepLander(
  state: LanderState,
  controls: LanderControls,
  deltaSeconds: number,
): LanderState {
  if (state.phase !== 'flight' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return state;

  const dt = clamp(deltaSeconds, 0, 0.05);
  const throttle = clamp(Number.isFinite(controls.throttle) ? controls.throttle : 0, 0, 1);
  const lateral = clamp(Number.isFinite(controls.lateral) ? controls.lateral : 0, -1, 1);
  const fuelUsed = throttle * MAX_FUEL_FLOW_PER_SECOND * dt;
  const fuel = Math.max(0, state.fuel - fuelUsed);
  const engineThrottle = fuel > 0 ? throttle : 0;
  const verticalAcceleration = engineThrottle * MAX_VERTICAL_ACCELERATION - GRAVITY;
  const horizontalAcceleration = lateral * MAX_LATERAL_ACCELERATION;
  const verticalVelocity = state.verticalVelocity + verticalAcceleration * dt;
  const horizontalVelocity = state.horizontalVelocity + horizontalAcceleration * dt;
  const altitude = state.altitude + verticalVelocity * dt;
  const horizontalPosition = state.horizontalPosition + horizontalVelocity * dt;

  if (altitude <= 0) {
    const safeTouchdown = Math.abs(verticalVelocity) <= 3
      && Math.abs(horizontalVelocity) <= 2
      && Math.abs(horizontalPosition) <= 12;
    return {
      ...state,
      altitude: 0,
      horizontalPosition,
      horizontalVelocity,
      verticalVelocity,
      fuel,
      elapsed: state.elapsed + dt,
      phase: safeTouchdown ? 'landed' : 'crashed',
    };
  }

  if (Math.abs(horizontalPosition) > 80) {
    return {
      ...state,
      altitude,
      horizontalPosition,
      horizontalVelocity,
      verticalVelocity,
      fuel,
      elapsed: state.elapsed + dt,
      phase: 'crashed',
    };
  }

  return {
    ...state,
    altitude,
    horizontalPosition,
    horizontalVelocity,
    verticalVelocity,
    fuel,
    elapsed: state.elapsed + dt,
    phase: 'flight',
  };
}
