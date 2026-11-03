import { layoutFor } from '../stage/framing';

/** Gap between the orb and the tooltip, and from the window's edges, in CSS pixels. */
const GAP = 18;
/** The least clear space kept between the tooltip and the orb it describes. */
const ORB_CLEARANCE = 8;

type Box = { left: number; top: number };

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type FaceInput = { x: number; y: number; bounds?: Rect };

/** A round thing on the page (an orb): centre and diameter in CSS pixels. */
export type Disc = { x: number; y: number; size: number };

/**
 * Space kept under the sheet, as tooltip.css sets it, in CSS pixels: on a phone the sheet rides
 * above the tray of technologies (three rows of 48 px buttons and the gaps, 12 px from the bottom).
 */
const SHEET_MARGIN = 182;

/**
 * Whether the tooltip is a sheet along the bottom of the window instead of a card beside its orb:
 * on a phone held upright, where the orbs are too small to set a card beside, and only while a
 * sheet `sheetHeight` tall stays clear of Nox's face. Anywhere else the card goes beside the orb.
 */
export function sheetFits(viewport: { width: number; height: number }, face: FaceInput, sheetHeight: number) {
  if (layoutFor(viewport) !== 'phone' || viewport.height <= viewport.width) return false;
  const faceBottom = face.bounds?.bottom ?? face.y + 110;
  return viewport.height - SHEET_MARGIN - sheetHeight >= faceBottom + GAP;
}

/**
 * Where a tooltip of size `card` goes beside an orb (centre and diameter in CSS pixels). It never
 * covers Nox's face (the protected region round the eyes, cheeks and mouth) or the orb itself, and
 * always stays inside the window. Among the places round the orb that pass, it takes the one that
 * covers the fewest other orbs (`others`), then the one closest to the orb, preferring the side
 * away from the face, as in panel 4.
 */
export function placeTooltip(orb: Disc, card: { width: number; height: number }, face: FaceInput, viewport: { width: number; height: number }, others: readonly Disc[] = []): Box {
  const { width: W, height: H } = card;
  const half = orb.size / 2;
  const outward = orb.x < face.x ? -1 : 1;
  const faceBox: Rect = face.bounds ?? { left: face.x - 140, right: face.x + 140, top: face.y - 110, bottom: face.y + 110 };

  const clampBox = (p: Box): Box => ({
    left: Math.min(Math.max(p.left, GAP), Math.max(GAP, viewport.width - W - GAP)),
    top: Math.min(Math.max(p.top, GAP), Math.max(GAP, viewport.height - H - GAP)),
  });
  /** Distance from a point to the box (0 inside it). */
  const distanceTo = (p: Box, x: number, y: number) => {
    const nx = Math.max(p.left, Math.min(x, p.left + W));
    const ny = Math.max(p.top, Math.min(y, p.top + H));
    return Math.hypot(nx - x, ny - y);
  };
  const coversFace = (p: Box) => !(p.left + W <= faceBox.left || p.left >= faceBox.right || p.top + H <= faceBox.top || p.top >= faceBox.bottom);
  /** How much of the other orbs the box covers: a whole orb for each centre inside it, half for each it cuts. */
  const crowding = (p: Box) =>
    others.reduce((sum, o) => {
      const d = distanceTo(p, o.x, o.y);
      return sum + (d === 0 ? 1 : d < o.size / 2 ? 0.5 : 0);
    }, 0);

  // Places round the orb: beside it on either side, above and below it, and at its corners, each
  // also slid along the orb so a window edge does not rule it out.
  const xs = [
    outward > 0 ? orb.x + half + GAP : orb.x - half - GAP - W,
    outward > 0 ? orb.x - half - GAP - W : orb.x + half + GAP,
    orb.x - W / 2,
    orb.x - W / 4,
    orb.x - (3 * W) / 4,
    orb.x + half * 0.7 + GAP,
    orb.x - half * 0.7 - GAP - W,
  ];
  const ys = [orb.y - H / 2, orb.y - half - GAP - H, orb.y + half + GAP, orb.y - half, orb.y + half - H, orb.y - half * 0.7 - GAP - H, orb.y + half * 0.7 + GAP];
  let best: Box | null = null;
  let bestCost = Infinity;
  for (const x of xs) {
    for (const y of ys) {
      const p = clampBox({ left: x, top: y });
      if (coversFace(p)) continue;
      const gap = distanceTo(p, orb.x, orb.y) - half;
      if (gap < ORB_CLEARANCE) continue;
      // Wholly on the face's side of the orb: allowed, but only when the other side has no room.
      const inward = outward > 0 ? p.left + W <= orb.x - half : p.left >= orb.x + half;
      const cost = 1000 * crowding(p) + gap + (inward ? 40 : 0);
      if (cost < bestCost - 1e-6) {
        best = p;
        bestCost = cost;
      }
    }
  }
  if (best) return best;
  // A window too small for any clear place: the outward place, kept inside the window.
  return clampBox({ left: xs[0], top: ys[0] });
}
