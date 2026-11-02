// The jet pulse's squeeze of the mantle and the glow card's fade as the head turns: shared by the
// entrance and any swim. Entrance v1's path (entrancePath, entranceStartX, armFlare,
// ENTRANCE_PANEL_MS) is replaced by sequences/entrance.ts; until Task 19 rewires the stage it
// lives on in behavior/entranceV1.ts.

/** A pulse squeezes the mantle by 6% at its height. */
export const MANTLE_SQUEEZE = 0.06;

/** The mantle's size during a pulse. */
export function mantleSqueeze(pulse: number) {
  return 1 - MANTLE_SQUEEZE * pulse;
}

/**
 * How much of the glow card before the chin shows with the head turned `yaw` radians from the
 * visitor. The card faces the visitor from in front of the face; turned side-on it would swing out
 * past the face and be seen edge-on as a bright streak, so it fades as the head turns.
 */
export function coreGlowFacing(yaw: number) {
  return Math.cos(Math.min(Math.abs(yaw), Math.PI / 2)) ** 2;
}
