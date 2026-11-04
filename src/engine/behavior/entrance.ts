// The glow card's fade as the head turns: shared by the entrance and any swim. The entrance's path
// is in sequences/entrance.ts; the swim's mantle beat is the stroke's (motion/stroke.ts). Entrance
// v1 and its jet pulse are gone.

/**
 * How much of the glow card before the chin shows with the head turned `yaw` radians from the
 * visitor. The card faces the visitor from in front of the face; turned side-on it would swing out
 * past the face and be seen edge-on as a bright streak, so it fades as the head turns.
 */
export function coreGlowFacing(yaw: number) {
  return Math.cos(Math.min(Math.abs(yaw), Math.PI / 2)) ** 2;
}
