type Point = readonly [number, number];

type Curve = {
  control1: Point;
  control2: Point;
  end: Point;
  radius: number;
};

export type TentacleDefinition = {
  id: string;
  label: string;
  depth: 'rear' | 'middle' | 'front';
  start: Point;
  radius: number;
  underside: 1 | -1;
  curves: Curve[];
};

// Panel 2 uses source pixels as the artwork coordinates: x=512..1018, y=0..504.
// Eight independently authored, tapered contours. Hidden roots are reconstructed.
export const introductionTentacles: TentacleDefinition[] = [
  {
    id: 'T1', label: 'Upper left rising curl', depth: 'rear',
    start: [238, 348], radius: 12, underside: -1,
    curves: [
      { control1: [204, 363], control2: [151, 344], end: [141, 323], radius: 8 },
      { control1: [130, 302], control2: [150, 292], end: [143, 279], radius: 6 },
      { control1: [136, 266], control2: [122, 269], end: [122, 277], radius: 3.2 },
      { control1: [122, 282], control2: [131, 284], end: [131, 279], radius: 0.6 },
    ],
  },
  {
    id: 'T2', label: 'Upper right rising curl', depth: 'rear',
    start: [276, 349], radius: 12, underside: 1,
    curves: [
      { control1: [310, 357], control2: [343, 340], end: [347, 319], radius: 7 },
      { control1: [350, 302], control2: [346, 291], end: [358, 288], radius: 5.4 },
      { control1: [371, 283], control2: [379, 292], end: [371, 299], radius: 2.3 },
      { control1: [367, 302], control2: [365, 297], end: [369, 295], radius: 0.5 },
    ],
  },
  {
    id: 'T3', label: 'Broad left lateral sweep', depth: 'middle',
    start: [245, 353], radius: 17, underside: -1,
    curves: [
      { control1: [207, 368], control2: [169, 371], end: [145, 349], radius: 14.3 },
      { control1: [118, 328], control2: [116, 308], end: [82, 312], radius: 11.3 },
      { control1: [61, 313], control2: [42, 329], end: [49, 347], radius: 7.2 },
      { control1: [54, 360], control2: [68, 353], end: [60, 347], radius: 1 },
    ],
  },
  {
    id: 'T4', label: 'Broad right lateral sweep', depth: 'middle',
    start: [271, 352], radius: 17, underside: 1,
    curves: [
      { control1: [305, 367], control2: [345, 368], end: [368, 342], radius: 14.2 },
      { control1: [387, 320], control2: [400, 302], end: [422, 306], radius: 10.5 },
      { control1: [441, 307], control2: [451, 323], end: [445, 335], radius: 6.3 },
      { control1: [439, 345], control2: [429, 337], end: [437, 333], radius: 0.8 },
    ],
  },
  {
    id: 'T5', label: 'Lower left outward curl', depth: 'middle',
    start: [242, 356], radius: 16.3, underside: -1,
    curves: [
      { control1: [216, 379], control2: [184, 402], end: [150, 392], radius: 14.1 },
      { control1: [129, 386], control2: [108, 386], end: [103, 399], radius: 10.1 },
      { control1: [97, 411], control2: [104, 424], end: [115, 421], radius: 6.2 },
      { control1: [125, 418], control2: [119, 407], end: [115, 413], radius: 0.8 },
    ],
  },
  {
    id: 'T6', label: 'Lower right outward curl', depth: 'middle',
    start: [272, 356], radius: 16.5, underside: 1,
    curves: [
      { control1: [306, 385], control2: [333, 398], end: [366, 385], radius: 14.1 },
      { control1: [390, 376], control2: [406, 364], end: [421, 373], radius: 10.5 },
      { control1: [438, 382], control2: [437, 400], end: [426, 404], radius: 6.1 },
      { control1: [415, 408], control2: [412, 396], end: [421, 399], radius: 0.7 },
    ],
  },
  {
    id: 'T7', label: 'Front left descending curl', depth: 'front',
    start: [246, 350], radius: 18.3, underside: -1,
    curves: [
      { control1: [234, 375], control2: [229, 405], end: [207, 426], radius: 15 },
      { control1: [193, 440], control2: [178, 449], end: [170, 442], radius: 10.1 },
      { control1: [157, 434], control2: [163, 420], end: [173, 424], radius: 5.1 },
      { control1: [180, 428], control2: [177, 436], end: [171, 431], radius: 0.7 },
    ],
  },
  {
    id: 'T8', label: 'Front right descending curl', depth: 'front',
    start: [268, 350], radius: 18.3, underside: 1,
    curves: [
      { control1: [279, 376], control2: [286, 407], end: [304, 429], radius: 14.5 },
      { control1: [317, 444], control2: [338, 451], end: [340, 439], radius: 9.4 },
      { control1: [343, 426], control2: [330, 420], end: [326, 429], radius: 4.7 },
      { control1: [325, 435], control2: [332, 436], end: [332, 431], radius: 0.6 },
    ],
  },
];

type Sample = { x: number; y: number; nx: number; ny: number; angle: number; radius: number; distance: number };

function sampleTentacle(arm: TentacleDefinition): Sample[] {
  const result: Sample[] = [];
  let start = arm.start;
  let radius = arm.radius;
  let distance = 0;
  for (const curve of arm.curves) {
    for (let i = result.length ? 1 : 0; i <= 36; i++) {
      const t = i / 36;
      const s = 1 - t;
      const x = s ** 3 * start[0] + 3 * s ** 2 * t * curve.control1[0] + 3 * s * t ** 2 * curve.control2[0] + t ** 3 * curve.end[0];
      const y = s ** 3 * start[1] + 3 * s ** 2 * t * curve.control1[1] + 3 * s * t ** 2 * curve.control2[1] + t ** 3 * curve.end[1];
      const dx = 3 * s ** 2 * (curve.control1[0] - start[0]) + 6 * s * t * (curve.control2[0] - curve.control1[0]) + 3 * t ** 2 * (curve.end[0] - curve.control2[0]);
      const dy = 3 * s ** 2 * (curve.control1[1] - start[1]) + 6 * s * t * (curve.control2[1] - curve.control1[1]) + 3 * t ** 2 * (curve.end[1] - curve.control2[1]);
      const length = Math.hypot(dx, dy) || 1;
      const previous = result.at(-1);
      if (previous) distance += Math.hypot(x - previous.x, y - previous.y);
      result.push({ x, y, nx: -dy / length, ny: dx / length, angle: Math.atan2(dy, dx) * 180 / Math.PI, radius: radius + (curve.radius - radius) * (t * t * (3 - 2 * t)), distance });
    }
    start = curve.end;
    radius = curve.radius;
  }
  return result;
}

function edge(samples: Sample[], offset: number) {
  return samples.map((p) => `${(p.x + p.nx * p.radius * offset).toFixed(2)},${(p.y + p.ny * p.radius * offset).toFixed(2)}`);
}

// Cross-section shading follows the authored curve rather than the screen's
// vertical axis, so bent limbs retain a rounded top plane and recessed underside.
const skinStops = [
  { at: -1, rgb: [111, 77, 140] },
  { at: -0.84, rgb: [72, 53, 102] },
  { at: -0.48, rgb: [40, 32, 65] },
  { at: 0.1, rgb: [20, 24, 45] },
  { at: 0.4, rgb: [40, 25, 55] },
  { at: 0.72, rgb: [97, 37, 70] },
  { at: 1, rgb: [209, 77, 104] },
];

function skinColor(offset: number) {
  const nextIndex = skinStops.findIndex((stop) => stop.at >= offset);
  const right = skinStops[nextIndex < 0 ? skinStops.length - 1 : nextIndex];
  const left = skinStops[Math.max(0, nextIndex - 1)];
  const mix = (offset - left.at) / (right.at - left.at || 1);
  return `rgb(${left.rgb.map((channel, i) => Math.round(channel + (right.rgb[i] - channel) * mix)).join(' ')})`;
}

export function buildTentacle(arm: TentacleDefinition) {
  const samples = sampleTentacle(arm);
  const contour = `M${edge(samples, -1).join(' L')} L${edge([...samples].reverse(), 1).join(' L')} Z`;
  const belly = `M${edge(samples, arm.underside * 0.53).join(' L')} L${edge([...samples].reverse(), arm.underside * 0.99).join(' L')} Z`;
  const rim = `M${edge(samples.filter((p) => p.distance > 28), -arm.underside * 0.85).join(' L')}`;
  const innerShade = `M${edge(samples, arm.underside * 0.2).join(' L')}`;
  const crest = `M${edge(samples.filter((p) => p.distance > 19), -arm.underside * 0.54).join(' L')}`;
  const dorsal = `M${edge(samples, -arm.underside * 0.96).join(' L')} L${edge([...samples].reverse(), -arm.underside * 0.06).join(' L')} Z`;
  const volume = Array.from({ length: 24 }, (_, i) => {
    const from = -1 + i / 12;
    const to = Math.min(1, from + 1 / 12 + 0.008);
    return {
      contour: `M${edge(samples, arm.underside * from).join(' L')} L${edge([...samples].reverse(), arm.underside * to).join(' L')} Z`,
      color: skinColor((from + to) / 2),
    };
  });
  const cups: { x: number; y: number; radius: number; angle: number }[] = [];
  let nextCup = arm.depth === 'front' ? 42 : 24;
  for (const point of samples) {
    if (point.distance < nextCup || point.radius < 1.8) continue;
    cups.push({
      x: point.x + point.nx * point.radius * arm.underside * 0.85,
      y: point.y + point.ny * point.radius * arm.underside * 0.85,
      radius: Math.min(4.2, point.radius * (0.38 + cups.length % 3 * 0.025)),
      angle: point.angle,
    });
    nextCup = point.distance + Math.max(4.2, point.radius * 1.02);
  }
  const freckles = samples.filter((_, i) => i % 7 === 2).map((p, i) => ({
    x: p.x - p.nx * p.radius * arm.underside * (0.3 + i % 3 * 0.17),
    y: p.y - p.ny * p.radius * arm.underside * (0.3 + i % 3 * 0.17),
    radius: 0.45 + i % 3 * 0.23,
  }));
  return { ...arm, contour, belly, rim, innerShade, crest, dorsal, volume, cups, freckles };
}

export const introductionArtwork = introductionTentacles.map(buildTentacle);

export const mantleContour = 'M181 315 C172 289 184 258 207 241 C222 230 239 227 255 228 C279 228 301 239 316 259 C331 279 333 302 326 322 C322 332 334 333 327 342 C319 351 294 349 278 354 C272 358 268 365 258 365 C247 365 244 358 234 355 C222 351 206 354 192 346 C178 342 174 335 183 330 C185 327 183 321 181 315 Z';
