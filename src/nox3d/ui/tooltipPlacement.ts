/** Gap between the orb and the tooltip, and from the window's edges, in CSS pixels. */
const GAP = 18;

type Box = { left: number; top: number };

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type FaceInput = { x: number; y: number; bounds?: Rect };

/**
 * Where a tooltip of size `card` goes beside an orb (centre and diameter in CSS pixels): on the
 * side away from Nox's face, else above the orb, else below it, and only as a last resort toward
 * the face; always kept inside the window, and strictly outside the protected facial region
 * (eyes, cheeks, mouth) whenever space exists.
 */
export function placeTooltip(
  orb: { x: number; y: number; size: number },
  card: { width: number; height: number },
  face: FaceInput,
  viewport: { width: number; height: number },
): Box {
  const half = orb.size / 2;
  const outward = orb.x < face.x ? -1 : 1;

  // Protected facial region: defaults to a generous radius around the face center if no explicit bounds are passed.
  const faceBox: Rect = face.bounds ?? {
    left: face.x - 140,
    right: face.x + 140,
    top: face.y - 110,
    bottom: face.y + 110,
  };

  const beside = (side: number): Box => ({
    left: side > 0 ? orb.x + half + GAP : orb.x - half - GAP - card.width,
    top: Math.min(Math.max(orb.y - card.height / 2, GAP), viewport.height - card.height - GAP),
  });

  // Calculate sliding horizontal positions for vertical placements to avoid the face
  const slideAwayFromFace = (preferredX: number): number => {
    if (outward > 0) {
      // Orb is to the right of face center; slide right to clear the right cheek if needed
      return Math.max(preferredX, faceBox.right + GAP);
    } else {
      // Orb is to the left of face center; slide left to clear the left cheek if needed
      return Math.min(preferredX, faceBox.left - card.width - GAP);
    }
  };

  const centred = Math.min(Math.max(orb.x - card.width / 2, GAP), viewport.width - card.width - GAP);
  const cleared = Math.min(Math.max(slideAwayFromFace(centred), GAP), viewport.width - card.width - GAP);

  const candidates: Box[] = [
    // 1. Preferred: Outward away from character
    beside(outward),
    // 2. Above the orb (sliding clear of face if needed)
    { left: cleared, top: orb.y - half - GAP - card.height },
    { left: centred, top: orb.y - half - GAP - card.height },
    // 3. Below the orb (sliding clear of face if needed)
    { left: cleared, top: orb.y + half + GAP },
    { left: centred, top: orb.y + half + GAP },
    // 4. Inward (only if it completely clears the face)
    beside(-outward),
  ];

  const clamp = (p: Box): Box => ({
    left: Math.min(Math.max(p.left, GAP), Math.max(GAP, viewport.width - card.width - GAP)),
    top: Math.min(Math.max(p.top, GAP), Math.max(GAP, viewport.height - card.height - GAP)),
  });

  const fits = (p: Box) =>
    p.left >= GAP &&
    p.top >= GAP &&
    p.left + card.width <= viewport.width - GAP &&
    p.top + card.height <= viewport.height - GAP;

  const coversFace = (p: Box) => {
    const pRight = p.left + card.width;
    const pBottom = p.top + card.height;
    return !(pRight <= faceBox.left || p.left >= faceBox.right || pBottom <= faceBox.top || p.top >= faceBox.bottom);
  };

  const coversOrb = (p: Box) =>
    orb.x + half > p.left &&
    orb.x - half < p.left + card.width &&
    orb.y + half > p.top &&
    orb.y - half < p.top + card.height;

  // 1. First candidate that fits cleanly in the viewport without covering the face or orb
  const cleanFit = candidates.find(p => fits(p) && !coversFace(p) && !coversOrb(p));
  if (cleanFit) return cleanFit;

  // 2. First candidate that fits in viewport and clears face (even if slight orb brush)
  const faceClearFit = candidates.find(p => fits(p) && !coversFace(p));
  if (faceClearFit) return faceClearFit;

  // 3. Clamped candidate that clears both face and orb
  const clampedClear = candidates.map(clamp).find(p => !coversFace(p) && !coversOrb(p));
  if (clampedClear) return clampedClear;

  // 4. Clamped candidate that clears face
  const clampedFaceClear = candidates.map(clamp).find(p => !coversFace(p));
  if (clampedFaceClear) return clampedFaceClear;

  // 5. Fallback: outward clamped
  return clamp(candidates[0]);
}
