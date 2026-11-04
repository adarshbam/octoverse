import * as THREE from 'three';
import { expect, test } from 'vitest';
import { NOX_ARTIFACTS } from '../../worlds/nox/artifacts';
import { NOX } from '../../worlds/nox/character';
import type { ArtifactConfig, OrbitPlacement } from '../config/types';
import { blowMouth } from '../sequences/bubbleBlow';
import type { AppearSheet, SequenceId } from '../sequences/keys';
import { layoutOrbits, orbitPoint, orbitSpeed } from './bubbleOrbits';
import { APPEARS, PLACEMENTS, SELECTS, choiceRemoved, choosableNow } from './strategies';
import { HOLD_BEATS } from './suctionHold';

test("each table holds Nox's entry (and the placements Aether's satellite), and the id unions follow the tables", () => {
  expect(Object.keys(PLACEMENTS)).toEqual(['orbit', 'satellite']);
  expect(Object.keys(APPEARS)).toEqual(['blow']);
  expect(Object.keys(SELECTS)).toEqual(['suctionHold']);
  expect(NOX_ARTIFACTS.placement.kind in PLACEMENTS).toBe(true);
  expect(NOX_ARTIFACTS.appear.kind in APPEARS).toBe(true);
  expect(NOX_ARTIFACTS.select.kind in SELECTS).toBe(true);
});

test('a kind that is not in a table is a type error (they arrive in F01)', () => {
  const nox = NOX_ARTIFACTS;
  const pendant: ArtifactConfig = {
    ...nox,
    // Every field the orbit placement needs, so the kind alone is the error.
    // @ts-expect-error placement.kind 'pendant' is built in F01 with Veyra
    placement: { ...nox.placement, kind: 'pendant' },
  };
  const bloom: ArtifactConfig = {
    ...nox,
    // @ts-expect-error appear.kind 'bloom' is built in F01 with Veyra
    appear: { kind: 'bloom' },
  };
  const armLift: ArtifactConfig = {
    ...nox,
    // @ts-expect-error select.kind 'armLift' is built in F01 with Veyra
    select: { kind: 'armLift' },
  };
  expect([pendant.placement.kind, bloom.appear.kind, armLift.select.kind]).toEqual(['pendant', 'bloom', 'armLift']);
});

test('the appear table says which sheet each kind plays, and the sequence ids follow it', () => {
  expect(APPEARS.blow.sheet).toBe('bubbleBlow');
  // AppearSheet is derived from the table: 'bubbleBlow' is one, 'entrance' is not (the engine's own sheet).
  const sheet: AppearSheet = APPEARS.blow.sheet;
  const ids: SequenceId[] = [sheet, 'entrance', 'headSwell', 'arrival'];
  expect(ids).toHaveLength(4);
  // @ts-expect-error 'bloom' joins the sheets in F01 with its table entry
  const unknown: AppearSheet = 'bloom';
  expect(unknown).toBe('bloom');
});

test("Nox's artifacts hold the values the placement, the blow and the hold had", () => {
  expect(NOX_ARTIFACTS).toEqual({
    placement: {
      kind: 'orbit',
      shells: [
        { radius: 1.8, tilt: -0.3, speed: 0.21 },
        { radius: 1.95, tilt: 0, speed: 0.21 },
        { radius: 2.1, tilt: 0.3, speed: 0.21 },
      ],
      sizes: { intro: 0.16, overview: 0.2 },
      centreY: 0.25,
      halfHeight: 1.55,
      squareness: 3,
      swellPush: 0.3,
    },
    appear: { kind: 'blow' },
    select: { kind: 'suctionHold' },
    choosableIn: ['intro', 'overview'],
  });
});

// Recorded from the pre-change layoutOrbits(5, NOX_SHELLS, stage), orbitPoint and orbitSpeed (1cb0d99).
const FIVE_INTRO = [
  { shell: 0, radius: 1.8, tilt: -0.3, phase: 0, speed: 0.21, size: 0.16 },
  { shell: 1, radius: 1.95, tilt: 0, phase: 1.2566370614359172, speed: 0.21, size: 0.16 },
  { shell: 2, radius: 2.1, tilt: 0.3, phase: 2.5132741228718345, speed: 0.21, size: 0.16 },
  { shell: 0, radius: 1.8, tilt: -0.3, phase: 3.7699111843077517, speed: 0.21, size: 0.16 },
  { shell: 1, radius: 1.95, tilt: 0, phase: 5.026548245743669, speed: 0.21, size: 0.16 },
];
const AT_REST = [[1.8, 0.25, 0], [0.8912978400928262, 1.749003275612806, 0], [-1.823298289136653, 1.3376207594014866, 0.3364405267108262], [-1.5628271049742741, -0.8376207594014864, 0.33644052671082614], [0.8912978400928259, -1.2490032756128062, 0]];
const LATER = [[0.20269201036727807, 1.7992619094572588, -0.4792428687345521], [-1.8694732883018574, 1.012057828413452, 0], [-1.523520547817049, -1.0703756385007466, -0.40844004808973255], [1.2182487861478841, -1.1196525873048786, 0.4236831946250082], [1.9003531070056752, 0.9020635564561028, 0]];
const SWOLLEN = [[0.21120507480270376, 1.8643309096544638, -0.4993710692214033], [-1.9479911664105356, 1.0440642572068168, 0], [-1.5875084108253652, -1.125831415317778, -0.4255945301095013], [1.2694152351660952, -1.1771779959716837, 0.44147788879925853], [1.9801679374999135, 0.9294502258272591, 0]];

/** Nox's placement, the orbit (the config union also holds the satellite). */
const NOX_ORBIT = NOX_ARTIFACTS.placement as OrbitPlacement;

test('the orbit placement lays out and moves five bubbles exactly as before', () => {
  const placement = NOX_ORBIT;
  const orbits = PLACEMENTS.orbit.layout(5, placement, 'intro');
  expect(orbits).toEqual(FIVE_INTRO);
  // The layout function itself, given Nox's placement (it takes the shells and sizes from it).
  expect(layoutOrbits(5, placement, 'intro')).toEqual(FIVE_INTRO);
  expect(PLACEMENTS.orbit.layout(5, placement, 'overview').map(o => o.size)).toEqual([0.2, 0.2, 0.2, 0.2, 0.2]);
  const out = new THREE.Vector3();
  // (+ 0 turns a -0 into 0: the recorded JSON does not keep the sign of a zero.)
  const at = (t: number, swell: number) => orbits.map(o => PLACEMENTS.orbit.point(o, t, swell, out, placement).toArray().map(v => v + 0));
  expect(at(0, 0)).toEqual(AT_REST);
  expect(at(7.3, 0)).toEqual(LATER);
  expect(at(7.3, 0.14)).toEqual(SWOLLEN);
  expect(orbits.map(o => orbitPoint(o, 7.3, 0, new THREE.Vector3(), placement).toArray().map(v => v + 0))).toEqual(LATER);
  // The clock's pace is the orbit spring's.
  const spring = { x: 1, v: 0 };
  const pace = [true, true, false].map(hot => PLACEMENTS.orbit.pace(hot, 0.016, spring));
  expect(pace).toEqual([0.9690786201062734, 0.8961714369773063, 0.8339509671460227]);
  expect(orbitSpeed).toBe(PLACEMENTS.orbit.pace);
});

test('a placement with other shells and sizes lays out by them', () => {
  const placement = { ...NOX_ORBIT, shells: [{ radius: 3, tilt: 0.1, speed: 0.5 }], sizes: { intro: 0.3, overview: 0.4 } };
  const orbits = PLACEMENTS.orbit.layout(3, placement, 'overview');
  expect(orbits.map(o => [o.shell, o.radius, o.tilt, o.speed, o.size])).toEqual([[0, 3, 0.1, 0.5, 0.4], [0, 3, 0.1, 0.5, 0.4], [0, 3, 0.1, 0.5, 0.4]]);
  // A taller ring reaches higher, and a centre moved up moves it up.
  const point = (p: typeof placement) => PLACEMENTS.orbit.point({ ...orbits[0], phase: Math.PI / 2, tilt: 0 }, 0, 0, new THREE.Vector3(), p);
  expect(point({ ...placement, halfHeight: 2, centreY: 1 }).y).toBeCloseTo(3, 12);
  expect(point({ ...placement, halfHeight: 1, centreY: 0 }).y).toBeCloseTo(1, 12);
  // The swell pushes it out by the placement's own fraction.
  const pushed = PLACEMENTS.orbit.point({ ...orbits[0], phase: 0, tilt: 0 }, 0, 1, new THREE.Vector3(), { ...placement, swellPush: 0.5 });
  expect(pushed.x).toBeCloseTo(4.5, 12);
});

test('the blow and the suction hold are the shared modules, reached through the tables', () => {
  const run = APPEARS.blow.createRun();
  expect(run.seconds).toBeNull();
  expect(run.done).toBe(false);
  expect(run.blowing).toBe(false);
  expect(APPEARS.blow.origin(NOX.head, NOX.face)).toEqual(blowMouth(NOX.head, NOX.face));
  // Each instance has a clock of its own.
  expect(APPEARS.blow.createRun()).not.toBe(run);
  expect(SELECTS.suctionHold.beats).toBe(HOLD_BEATS);
  // The arm's reach, the held bubble's place off the tip and where it swings round: the values Octopus and TechBubbles held.
  expect(SELECTS.suctionHold.arm).toEqual({ reach: 0.55, short: 0.2, draw: 0.5, lift: 0.16, bob: 0.04 });
  expect(SELECTS.suctionHold.offTip).toBe(1.25);
  // The swing's centre is the middle of the world's rings: Nox's is where the old constant held it (0, 0.25).
  expect(SELECTS.suctionHold.centre(NOX_ARTIFACTS.placement)).toEqual({ x: 0, y: 0.25 });
  expect(SELECTS.suctionHold.centre({ ...NOX_ORBIT, centreY: 0.6 })).toEqual({ x: 0, y: 0.6 });
  const chosen: number[] = [];
  const choreography = SELECTS.suctionHold.choreography(bubble => (chosen.push(bubble), 3));
  choreography.choose(2, 0);
  expect(chosen).toEqual([2]);
  expect(choreography.sample(1000)[0]).toMatchObject({ bubble: 2, arm: 3 });
});

test('a stage is choosable only where the world lists it; the buttons and the tray are removed there', () => {
  const both = { choosableIn: ['intro', 'overview'] } as const;
  const overviewOnly = { choosableIn: ['overview'] } as const;
  expect(choosableNow('intro', both)).toBe(true);
  expect(choosableNow('overview', both)).toBe(true);
  expect(choosableNow('intro', overviewOnly)).toBe(false);
  expect(choosableNow('overview', overviewOnly)).toBe(true);
  // The entrance, a technology focus (its own stage; the page asks about the stage it came from) and the detail never offer a choice.
  for (const stage of ['entering', 'techFocus', 'detail'] as const) expect(choosableNow(stage, both)).toBe(false);
  // Removed (nothing drawn): only a choosing stage the world does not list. The other stages keep
  // their closed, inert buttons as Nox has always had.
  expect(choiceRemoved('intro', overviewOnly)).toBe(true);
  expect(choiceRemoved('overview', overviewOnly)).toBe(false);
  for (const stage of ['entering', 'techFocus', 'detail', 'intro', 'overview'] as const) expect(choiceRemoved(stage, both)).toBe(false);
  expect(choiceRemoved('detail', overviewOnly)).toBe(false);
  // Nox lists both.
  expect(NOX_ARTIFACTS.choosableIn).toEqual(['intro', 'overview']);
  // A world that lists none offers none, in either stage.
  expect(choiceRemoved('intro', { choosableIn: [] })).toBe(true);
  expect(choiceRemoved('overview', { choosableIn: [] })).toBe(true);
});
