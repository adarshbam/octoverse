import type { ComponentType } from 'react';
import type * as THREE from 'three';
import type { ExpressionId } from '../behavior/expressions';
import { type AppearConfig, type ArmId, type ArtifactConfig, type ChoosingStage, type FaceLayout, type HeadShape, type OrbGlass, type OrbitPlacement, type PendantPlacement, type PlacementConfig, type SatellitePlacement, type SelectConfig, type StageId, isChoosingStage } from '../config/types';
import type { StagePose } from '../poses/types';
import { type BlowFrame, BlowRun, type BlowStep, blowFrame, blowMouth, blowPosition } from '../sequences/bubbleBlow';
import { ArmLiftChoreography, armLiftTarget, tracedLift } from './armLift';
import { BLOOM_SECONDS, type BloomFrame, bloomFrame, bloomLength, bloomOrigin, bloomPosition } from './bloom';
import type { Sequences } from '../sequences/theatre';
import type { Vec3 } from '../world/types';
import { type Orbit, layoutOrbits, orbitPoint, orbitSpeed } from './bubbleOrbits';
import { type ArmReader, type PendantLive, type PendantPlace, createPendantRun, layoutPendants, resetPendants, stepPendants } from './pendant';
import { SatelliteRing } from './SatelliteRing';
import { type FlightLook, layoutSatellite, satelliteCapacity, satelliteDriver, satellitePoint } from './satellite';
import { HOLD_BEATS, HoldChoreography, nearestArm, pullPosition } from './suctionHold';

// The artifact strategies (spec 9.2): where a world's artifacts sit (placement), how they appear
// once the entrance has settled (appear) and how one is chosen (select). Each is a closed table
// inside the engine, keyed by the `kind` a world's ArtifactConfig names, and the id unions follow
// the tables. Adding a kind is a module, an entry and a test, and no other shared code changes.
// The blow and the suction hold stay the shared modules they were; the tables are how TechBubbles
// and Octopus reach them.

/** The stage framings an artifact is sized and laid out for: the choosing stages. */
export type ArtifactStage = ChoosingStage;

// --- Placement -------------------------------------------------------------------------------

/**
 * What a placement's own drawing is given each frame (A1 9.2): the stage, the head's swell (0..1), and
 * whether motion is off. Any stage, not only a choosing one (the satellite's ring is drawn in the detail
 * too), so it is not the drivers' PlacementFrame.
 */
export interface PlacementFormFrame {
  stage: StageId;
  swell: number;
  still: boolean;
  /** The visitor asked for reduced motion (not only a still): a flight between forms is a crossfade. */
  reducedMotion?: boolean;
}

/** A placement's own drawing, beside the artifacts: its config, its frame, the orb glass's surroundings and the head it sits round. */
export interface PlacementFormProps<C> {
  config: C;
  frame: () => PlacementFormFrame;
  glass: OrbGlass;
  head: HeadShape;
}

export interface PlacementModule<C> {
  /** `count` artifacts' paths, sized for the stage's framing. */
  layout(count: number, config: C, stage: ArtifactStage): Orbit[];
  /** Where one is at the placement clock `t` (seconds); `swell` (0..1) pushes the paths out to clear the swollen head. Written into `out`. */
  point(orbit: Orbit, t: number, swell: number, out: THREE.Vector3, config: C): THREE.Vector3;
  /** The clock's speed factor (1 at full pace), eased to 0 while `hot` (an artifact is hovered or held). `state` carries the spring between frames. */
  pace(hot: boolean, dt: number, state: { x: number; v: number }): number;
  /** What the placement draws of its own, in the head's space (the satellite's ring); a placement without one draws only its artifacts. */
  readonly Form?: ComponentType<PlacementFormProps<C>>;
}

/** What a placement is given each frame (contract 9.2): the stage framing, the head swell (0..1), the frame time (s), whether an artifact is hovered or held and whether motion is off. */
export interface PlacementFrame {
  stage: ArtifactStage;
  swell: number;
  dt: number;
  hot: boolean;
  still: boolean;
  /** The visitor asked for reduced motion (a still alone does not): the satellite's flight is then a crossfade. */
  reducedMotion?: boolean;
  /** A technology chosen in the overview is in focus (the stage reads as the overview's): the satellite's orbs stay landed while it closes the head. */
  focused?: boolean;
  /** The arm lift's hang (pendant.ts PendantFrame.hang); a placement that does not hang pendants ignores it. */
  hang?: { at: ArrayLike<number>; weight: ArrayLike<number> };
}

/** What a driver may be told of the character it is made for: where its head's centre line is across the body (the satellite's ring is centred on it). */
export interface PlacementContext {
  headCentreX?: number;
}

/**
 * One instance's placement, as TechBubbles runs it: made once from the world's config and the
 * number of artifacts, then stepped each frame. Every kind in the table makes one, so TechBubbles
 * draws any of them the same way.
 */
export interface PlacementDriver {
  /** Advances the placement a frame; `arms` are the character's live arms, in ARM_IDS order (the orbit placement ignores them). */
  step(frame: PlacementFrame, arms: readonly ArmReader[]): void;
  /** Artifact `i`'s radius in `stage`'s framing, or null where it has no place (a placement with no places, or a stage with fewer slots than artifacts). */
  size(stage: ArtifactStage, i: number): number | null;
  /** Where artifact `i` is now (body space), written into `out`; `swell` pushes it out where the placement does that. */
  point(stage: ArtifactStage, i: number, swell: number, out: THREE.Vector3): THREE.Vector3;
  /** Forgets what the last frame left (called when the artifacts are hidden and not stepped); absent where there is nothing to forget. */
  reset?(): void;
  /** The live pendants (their threads and orbs), for a placement that hangs artifacts on threads; undefined for one that does not. */
  readonly pendants?: readonly PendantLive[];
  /**
   * For a placement whose artifacts fly between its forms (the satellite's ring and pendants):
   * artifact `i`'s flight this frame (its scale of its size, its logo's and trail's strengths, whether
   * it hangs on its thread yet, and its trail's points); absent for one whose artifacts stay in place.
   */
  flight?(i: number): FlightLook;
}

/**
 * What every entry in the PLACEMENTS table gives, whatever its own layout: its capacity, a driver
 * for TechBubbles and, for a placement that draws something of its own, that Form (mounted by
 * Octopus in the head's space).
 */
export interface PlacementEntry<C> {
  capacity(config: C): number;
  driver(config: C, count: number, context?: PlacementContext): PlacementDriver;
  readonly Form?: ComponentType<PlacementFormProps<C>>;
}

/** How many artifacts the orbit placement keeps in the air (15 fits round the title and nameplate at the stage's size). */
export const ORBIT_CAPACITY = 15;

/** Artifacts circling the character on rings (artifacts/bubbleOrbits.ts). */
const orbitPlacement = {
  layout: layoutOrbits,
  point: orbitPoint,
  pace: orbitSpeed,
  /** How many a project shows in the air (the rest go to the tray): what fits round the title and nameplate at the stage's size. */
  capacity: (): number => ORBIT_CAPACITY,
  driver(config: OrbitPlacement, count: number): PlacementDriver {
    const layouts = { intro: layoutOrbits(count, config, 'intro'), overview: layoutOrbits(count, config, 'overview') };
    const run = { clock: 0, speed: { x: 1, v: 0 } };
    return {
      // The orbit clock runs at the eased speed; motion off, it stands where it is.
      step: ({ dt, hot, still }) => {
        const pace = orbitSpeed(hot, dt, run.speed);
        if (!still) run.clock += dt * pace;
      },
      size: (stage, i) => layouts[stage][i]?.size ?? null,
      point: (stage, i, swell, out) => orbitPoint(layouts[stage][i], run.clock, swell, out, config),
    };
  },
} satisfies PlacementModule<OrbitPlacement> & { capacity(config: OrbitPlacement): number; driver(config: OrbitPlacement, count: number): PlacementDriver };

/** Artifacts hung as pendants on tethers from slots on the character's arms (artifacts/pendant.ts, tether.ts). */
const pendantPlacement = {
  layout: layoutPendants,
  /**
   * One per slot of the stage with fewer: a technology past it goes to the tray in every stage, so it is
   * never placed in one stage and neither drawn nor offered in the other (a tray is the project's, not a stage's).
   */
  capacity: (config: PendantPlacement): number => Math.min(config.slots.intro.length, config.slots.overview.length),
  driver(config: PendantPlacement, count: number): PlacementDriver {
    const places: Record<ArtifactStage, (PendantPlace | null)[]> = { intro: layoutPendants(count, config, 'intro'), overview: layoutPendants(count, config, 'overview') };
    const run = createPendantRun(count);
    return {
      // Swings advance from the arms' own motion; the swell does not move an arm, so it does not move a pendant.
      step: ({ stage, swell, dt, still, hang }, arms) => stepPendants(run, places[stage], { stage, swell, dt, reducedMotion: still, hang }, arms, config),
      size: (stage, i) => places[stage][i]?.size ?? null,
      point: (_stage, i, _swell, out) => out.set(...run.live[i].orbCentre),
      reset: () => resetPendants(run),
      pendants: run.live,
    };
  },
} satisfies { layout: typeof layoutPendants; capacity(config: PendantPlacement): number; driver(config: PendantPlacement, count: number): PlacementDriver };

/**
 * A ring of seed beads round the head at rest, whose technologies fly out as the head swells to hang
 * as pendants on the arms (artifacts/satellite.ts): its Form draws the ring, its driver the flight and the pendants.
 */
const satellitePlacement = {
  layout: layoutSatellite,
  point: satellitePoint,
  pace: orbitSpeed,
  Form: SatelliteRing,
  /** One per slot, at most two an arm (the rest go to the tray); none for a ring with no active form. */
  capacity: satelliteCapacity,
  driver: (config: SatellitePlacement, count: number, context?: PlacementContext): PlacementDriver => satelliteDriver(config, count, context),
} satisfies PlacementModule<SatellitePlacement> & PlacementEntry<SatellitePlacement>;

export const PLACEMENTS = { orbit: orbitPlacement, pendant: pendantPlacement, satellite: satellitePlacement } as const;
export type PlacementKind = keyof typeof PLACEMENTS;

/**
 * The table entry a config names, typed to take that config (its capacity, driver and Form). (One
 * cast: the table and the config union are keyed by the same kinds, which TypeScript cannot correlate
 * through a lookup.)
 */
export function placementOf(config: PlacementConfig): PlacementEntry<PlacementConfig> {
  return PLACEMENTS[config.kind] as unknown as PlacementEntry<PlacementConfig>;
}

/** The driver for a world's placement (`count` artifacts), from the table entry its `kind` names. */
export function placementDriver(config: PlacementConfig, count: number, context?: PlacementContext): PlacementDriver {
  // Each entry takes its own kind's config; the table is closed and keyed by that kind, so the pairing holds.
  return (PLACEMENTS[config.kind] as { driver(config: PlacementConfig, count: number, context?: PlacementContext): PlacementDriver }).driver(config, count, context);
}

/** How many artifacts a world's placement shows (a project's technologies beyond it go to the tray, never to extra arms). */
export function placementCapacity(config: PlacementConfig): number {
  return (PLACEMENTS[config.kind] as { capacity(config: PlacementConfig): number }).capacity(config);
}

// --- Appear ----------------------------------------------------------------------------------

/**
 * One artifact's appearance this frame (sequences/bubbleBlow.ts BlowFrame): the face's puff and round
 * mouth, how far it has travelled from its origin, its size and its squash and stretch; and, for the
 * bloom, its cup's glow, its pearl and how far its thread has drawn down (artifacts/bloom.ts).
 */
export type AppearFrame = BlowFrame & { bloom?: BloomFrame['bloom'] };

/** What an appear's clock is given each frame (sequences/bubbleBlow.ts BlowStep). */
export type AppearStep = BlowStep;

/** An appear's clock: it starts the first time the artifacts exist and plays once. */
export interface AppearRun {
  /** Seconds into the appearance; null until it starts. */
  readonly seconds: number | null;
  /** Over, given up or not wanted: the artifacts are in place. */
  readonly done: boolean;
  /** Playing (or held by a still): the artifacts and the face follow it. */
  readonly blowing: boolean;
  step(input: AppearStep): void;
}

/** What an appear reads of a world's artifact config. */
export type AppearContext = Pick<ArtifactConfig, 'appear' | 'placement'>;

export interface AppearModule {
  /** The Theatre sheet this appearance plays (every kind so far plays one; a kind without one widens this when it is built). */
  readonly sheet: string;
  /** A fresh clock for one instance of a world with this artifact config (the bloom reads its duration and the placement's reveal). */
  createRun(config?: AppearContext): AppearRun;
  /** Where the artifacts come from, in the character's body space (the blow: its mouth). */
  origin(head: HeadShape, face: FaceLayout): Vec3;
  /** Artifact `i` of `count`, `seconds` into the appearance, for a world with this artifact config. */
  frame(sequences: Sequences, i: number, seconds: number, count: number, config: AppearContext): AppearFrame;
  /** The artifact's place `emerged` (0 to 1) of the way from `origin` to its path point `target`, written into `out`. */
  position(origin: Vec3, target: THREE.Vector3, emerged: number, out: THREE.Vector3): THREE.Vector3;
}

/** The blow (design 9.8): the character blows its artifacts from its mouth, one after another. */
const blowAppear = {
  sheet: 'bubbleBlow',
  createRun: (_config?: AppearContext) => new BlowRun(),
  origin: blowMouth,
  frame: blowFrame,
  position: blowPosition,
} as const satisfies AppearModule;

/**
 * The bloom (spec 7.5, "Appearing"; artifacts/bloom.ts): each pendant grows out of a cup on its arm,
 * in a ripple from the top arms down, `appear.duration` (1.2 s) in all, or as the placement's
 * `reveal` times it. It plays the world's `bloom` sheet (G5); the run lasts the whole ripple.
 */
const bloomAppear = {
  sheet: 'bloom',
  createRun: (config?: AppearContext) => {
    const reveal = config?.placement.kind === 'pendant' ? config.placement.reveal : undefined;
    const duration = config?.appear.kind === 'bloom' ? config.appear.duration : BLOOM_SECONDS;
    return new BlowRun(count => bloomLength(count, reveal, duration));
  },
  origin: bloomOrigin,
  frame: bloomFrame,
  position: bloomPosition,
} as const satisfies AppearModule;

export const APPEARS = { blow: blowAppear, bloom: bloomAppear } as const;
export type AppearId = keyof typeof APPEARS;

// --- Select ----------------------------------------------------------------------------------

/**
 * The suction hold's arm (artifacts/suctionHold.ts), in body units: it reaches out toward the
 * artifact at most `reach` (stopping `short` shy of it), draws `draw` of that back as it pulls the
 * artifact in, and lifts its tip `lift`; the artifact rides `bob` higher on the tip.
 */
const HOLD_ARM = { reach: 0.55, short: 0.2, draw: 0.5, lift: 0.16, bob: 0.04 } as const;

/** What every select tells the host and the character, whatever its mechanics. */
interface SelectCommon {
  /** `hold`: an arm takes the artifact off its place (suctionHold); `lift`: the artifact's own arm lifts it where it hangs (armLift). */
  readonly mode: 'hold' | 'lift';
  /** The face a focus wears when the technology names no reaction of its own. */
  readonly reaction: ExpressionId;
  /**
   * The pose a technology focus shows (focusStagePose): `returnTo`, the stage it came from (Nox);
   * `focus`, that stage's arms and body with the world's techFocus head and face (Veyra: the head
   * closes and she wears the focused face, P4).
   */
  readonly focusPose: 'returnTo' | 'focus';
}

export interface SelectModule extends SelectCommon {
  readonly mode: 'hold';
  /** Ms from the choice until the artifact is where the tooltip stands beside it. */
  readonly settleMs: number;
  /** The beats of one choice, in ms from the choice (the page waits on them). */
  readonly beats: typeof HOLD_BEATS;
  /** The one timeline of choices; `armFor` picks the arm for a newly chosen artifact. */
  choreography(armFor: (artifact: number) => number): HoldChoreography;
  /** The arm nearest the artifact without its path crossing the face box. */
  nearestArm: typeof nearestArm;
  /** The held artifact's place, `pull` (0..1) of the way from its path to the arm's tip, written into `out`. */
  position: typeof pullPosition;
  /** Where it swings round while it is pulled to its arm (body space), from where the world places its artifacts. */
  centre(placement: PlacementConfig): { readonly x: number; readonly y: number };
  /** How far beyond the tip its centre sits, in artifact radii. */
  readonly offTip: number;
  /** The arm's own reach, draw and lift. */
  readonly arm: typeof HOLD_ARM;
}

export interface LiftSelectModule extends SelectCommon {
  readonly mode: 'lift';
  /** Ms from the choice until the lifted pendant is where the tooltip stands beside it: the lift's ease. */
  settleMs(config: SelectConfig): number;
  /** The one timeline of choices; `armFor` names the arm the artifact hangs from. */
  choreography(armFor: (artifact: number) => ArmId): ArmLiftChoreography;
  /** The arm's lifted shape (artifacts/armLift.ts). */
  target: typeof armLiftTarget;
  /** The world's traced lift for an arm, if any. */
  traced: typeof tracedLift;
}

/** The suction hold (design 9.8, "Choosing a bubble"): the nearest arm turns toward the artifact, pulls it to its tip and lifts it. */
const suctionSelect = {
  mode: 'hold',
  reaction: 'curious',
  focusPose: 'returnTo',
  settleMs: HOLD_BEATS.pullMs[1],
  beats: HOLD_BEATS,
  choreography: (armFor: (artifact: number) => number) => new HoldChoreography(armFor),
  nearestArm,
  position: pullPosition,
  // The middle of the orbits (or of the satellite's ring): the artifacts swing round where their rings are centred (pendants have no rings: the body's middle).
  centre: (placement: PlacementConfig) => ({ x: 0, y: placement.kind === 'orbit' ? placement.centreY : placement.kind === 'satellite' ? placement.ring.centreY : 0 }),
  // How far beyond the arm's tip a held bubble's centre sits, in bubble radii: its glass meets the tip clear of the logo.
  offTip: 1.25,
  arm: HOLD_ARM,
} as const satisfies SelectModule;

/** The arm lift (spec 7.5, "Choosing a pendant"; artifacts/armLift.ts): the pendant's own arm lifts it, root first, the orb growing and glowing, its thread shortening. */
const armLiftSelect = {
  mode: 'lift',
  reaction: 'focused',
  focusPose: 'focus',
  settleMs: (config: SelectConfig) => Math.round((config.kind === 'armLift' ? config.ease : DEFAULT_LIFT_EASE) * 1000),
  choreography: (armFor: (artifact: number) => ArmId) => new ArmLiftChoreography(armFor),
  target: armLiftTarget,
  traced: tracedLift,
} as const satisfies LiftSelectModule;

/** The arm lift's ease when a config does not carry one (spec 7.5: about 450 ms). */
const DEFAULT_LIFT_EASE = 0.45;

export const SELECTS = { suctionHold: suctionSelect, armLift: armLiftSelect } as const;
export type SelectId = keyof typeof SELECTS;

/** Ms from a choice until the tooltip may stand beside the artifact, for a world's select. */
export function selectSettleMs(config: SelectConfig): number {
  const module = SELECTS[config.kind];
  return module.mode === 'hold' ? module.settleMs : module.settleMs(config);
}

/**
 * The suction hold's module for code that runs the hold whatever the world's select is: with the
 * arm lift nothing is ever held (no choice is given to the hold), so its frames are none.
 */
export const holdModule = (select: SelectModule | LiftSelectModule): SelectModule => (select.mode === 'hold' ? select : suctionSelect);

// The config unions in config/types.ts name exactly the tables' kinds (a kind added to a table and not to its union, or the other way round, fails here).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const kindsMatch: [Same<AppearConfig['kind'], AppearId>, Same<SelectConfig['kind'], SelectId>] = [true, true];
void kindsMatch;

const focusPoses = new WeakMap<object, Map<ChoosingStage, StagePose>>();

/**
 * The pose a technology focus shows, coming from `returnTo` (contract 9.2): Nox's suction hold keeps
 * that stage's pose as it is (the same object). The arm lift keeps its arms and body (the lift moves
 * the owning arm itself) and takes the head, face and tilt of the world's `techFocus` pose (Veyra's
 * P4: the head closes, the focused face). Made once per pose set and stage, so the blender's rests
 * (cached by pose object) are worked out once.
 */
export function focusStagePose(poses: Readonly<Pick<Record<StageId, StagePose>, ChoosingStage | 'techFocus'>>, returnTo: ChoosingStage, select: Pick<SelectCommon, 'focusPose'>): StagePose {
  const from = poses[returnTo];
  if (select.focusPose === 'returnTo') return from;
  let byStage = focusPoses.get(poses);
  if (!byStage) focusPoses.set(poses, (byStage = new Map()));
  let pose = byStage.get(returnTo);
  if (!pose) {
    const focus = poses.techFocus;
    pose = { ...from, headMorph: focus.headMorph, expression: focus.expression, tilt: focus.tilt };
    byStage.set(returnTo, pose);
  }
  return pose;
}

// --- Where artifacts can be chosen -----------------------------------------------------------

/** Whether an artifact can be chosen in `stage`: a choosing stage the world lists in `choosableIn`. */
export function choosableNow(stage: StageId, config: Pick<ArtifactConfig, 'choosableIn'>): boolean {
  return isChoosingStage(stage) && config.choosableIn.includes(stage);
}

/**
 * Whether the page draws no buttons and no tray in `stage`: it is a choosing stage in which the
 * world allows no choice (a stage outside `choosableIn`). Other stages draw them, closed and inert,
 * as they always have.
 */
export function choiceRemoved(stage: StageId, config: Pick<ArtifactConfig, 'choosableIn'>): boolean {
  return isChoosingStage(stage) && !choosableNow(stage, config);
}
