/**
 * The least time between redraws of the face texture. Redrawing the 1024-pixel face and sending
 * it to the GPU is the costliest thing a frame can do; at 30 a second, changes of expression and
 * blinks still read smoothly, and the rest of the scene keeps its frame rate.
 */
export const FACE_REDRAW_MS = 30;

/** Whether the face should be redrawn now: something changed, and the last redraw is old enough. */
export function faceRedrawDue(key: string, lastKey: string, nowMs: number, lastDrawMs: number) {
  return key !== lastKey && nowMs - lastDrawMs >= FACE_REDRAW_MS;
}
