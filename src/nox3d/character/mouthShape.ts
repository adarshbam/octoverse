import type { FaceLayout } from '../config/types';

type Point = [number, number];

export interface MouthShape {
  /** Smile line as a cubic curve, head-local units (+y up). */
  start: Point;
  c1: Point;
  c2: Point;
  end: Point;
  /** Lowest point of the smile line. */
  smileBottom: number;
  /** Lower lip of an open smile, a cubic curve from `end` back to `start`; null when closed. */
  lower: { c1: Point; c2: Point; bottom: number; tongueTop: number } | null;
}

/** How much a fuller smile widens and deepens the mouth, world units per unit of `curve`. */
const WIDEN = 0.0094;
const DEEPEN = 0.0156;

const cubicMid = (a: number, b: number, c: number, d: number) => 0.125 * a + 0.375 * b + 0.375 * c + 0.125 * d;

/**
 * The mouth for a smile amount `curve` and an opening `open` (0 = closed). The ends sit
 * above the centre and the line dips below it; an open smile adds a lower lip that drops
 * further as it opens, with the tongue filling the bottom third of the opening.
 */
export function mouthShape(mouth: FaceLayout['mouth'], curve: number, open: number): MouthShape {
  const [cx, cy] = mouth.center;
  const w = mouth.halfWidth + curve * WIDEN;
  const d = mouth.depth + curve * DEEPEN;
  const start: Point = [cx - w, cy + 0.35 * d];
  const end: Point = [cx + w, cy + 0.35 * d];
  const c1: Point = [cx - 0.5 * w, cy - 0.75 * d];
  const c2: Point = [cx + 0.5 * w, cy - 0.75 * d];
  const smileBottom = cubicMid(start[1], c1[1], c2[1], end[1]);
  if (open <= 0.01) return { start, c1, c2, end, smileBottom, lower: null };
  const drop = d * (0.75 + 4 * open);
  const l1: Point = [cx + 0.45 * w, cy - drop];
  const l2: Point = [cx - 0.45 * w, cy - drop];
  const bottom = cubicMid(end[1], l1[1], l2[1], start[1]);
  return { start, c1, c2, end, smileBottom, lower: { c1: l1, c2: l2, bottom, tongueTop: bottom + (smileBottom - bottom) / 3 } };
}
