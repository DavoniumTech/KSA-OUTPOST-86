/** Convert a pointer's displacement from a virtual-stick centre into a bounded
 * movement vector. The vector preserves direction and clamps its magnitude to 1. */
export interface JoystickVector {
  x: number;
  y: number;
}

export function mapJoystickDisplacement(dx: number, dy: number, maxTravel: number): JoystickVector {
  const radius = Number.isFinite(maxTravel) ? Math.max(1, maxTravel) : 1;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { x: 0, y: 0 };
  const length = Math.hypot(dx, dy);
  if (length < radius * 0.06) return { x: 0, y: 0 };
  const magnitude = Math.min(1, length / radius);
  const easedMagnitude = (magnitude - 0.06) / 0.94;
  const scale = easedMagnitude / length;
  return {
    x: Math.max(-1, Math.min(1, dx * scale)),
    y: Math.max(-1, Math.min(1, dy * scale)),
  };
}
