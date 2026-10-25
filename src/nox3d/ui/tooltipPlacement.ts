/** Gap between the orb and the tooltip, and from the window's edges, in CSS pixels. */
const GAP = 18;

type Box = { left: number; top: number };

/**
 * Where a tooltip of size `card` goes beside an orb (centre and diameter in CSS pixels): on the
 * side away from Nox's face, else above the orb, else below it, and only as a last resort toward
 * the face; always kept inside the window, and never over the face when another place fits.
 */
export function placeTooltip(
  orb: { x: number; y: number; size: number },
  card: { width: number; height: number },
  face: { x: number; y: number },
  viewport: { width: number; height: number },
): Box {
  const half = orb.size / 2;
  const outward = orb.x < face.x ? -1 : 1;
  const beside = (side: number): Box => ({
    left: side > 0 ? orb.x + half + GAP : orb.x - half - GAP - card.width,
    top: orb.y - card.height / 2,
  });
  // Above and below may slide sideways to stay inside the window.
  const centred = Math.min(Math.max(orb.x - card.width / 2, GAP), viewport.width - card.width - GAP);
  const candidates: Box[] = [
    beside(outward),
    { left: centred, top: orb.y - half - GAP - card.height },
    { left: centred, top: orb.y + half + GAP },
    beside(-outward),
  ];
  const clamp = (p: Box): Box => ({
    left: Math.min(Math.max(p.left, GAP), viewport.width - card.width - GAP),
    top: Math.min(Math.max(p.top, GAP), viewport.height - card.height - GAP),
  });
  const fits = (p: Box) => p.left >= GAP && p.top >= GAP && p.left + card.width <= viewport.width - GAP && p.top + card.height <= viewport.height - GAP;
  const coversFace = (p: Box) => face.x >= p.left && face.x <= p.left + card.width && face.y >= p.top && face.y <= p.top + card.height;
  const coversOrb = (p: Box) => orb.x + half > p.left && orb.x - half < p.left + card.width && orb.y + half > p.top && orb.y - half < p.top + card.height;
  // The first place that fits as it is; failing that, the first that, kept inside the window,
  // still clears both the orb and the face.
  return candidates.find(fits) ?? candidates.map(clamp).find(p => !coversFace(p) && !coversOrb(p)) ?? clamp(candidates[0]);
}
