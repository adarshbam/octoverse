import type { ComponentType } from 'react';
import type * as THREE from 'three';
import { type ArtifactConfig, type ChoosingStage, type FaceLayout, type HeadShape, type OrbGlass, type OrbitPlacement, type PlacementConfig, type SatellitePlacement, type StageId, isChoosingStage } from '../config/types';
import { type BlowFrame, BlowRun, type BlowStep, blowFrame, blowMouth, blowPosition } from '../sequences/bubbleBlow';
import type { Sequences } from '../sequences/theatre';
import type { Vec3 } from '../world/types';
import { type Orbit, layoutOrbits, orbitPoint, orbitSpeed } from './bubbleOrbits';
import { SatelliteRing } from './SatelliteRing';
import { layoutSatellite, satellitePoint } from './satellite';
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

/** What a placement's own drawing is given each frame (A1 9.2): the stage, the head's swell (0..1), and whether motion is off. */
export interface PlacementFrame {
  stage: StageId;
  swell: number;
  still: boolean;
}

/** A placement's own drawing, beside the artifacts: its config, its frame, the orb glass's surroundings and the head it sits round. */
export interface PlacementFormProps<C> {
  config: C;
  frame: () => PlacementFrame;
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

/** Artifacts circling the character on rings (artifacts/bubbleOrbits.ts). */
const orbitPlacement = {
  layout: layoutOrbits,
  point: orbitPoint,
  pace: orbitSpeed,
} satisfies PlacementModule<OrbitPlacement>;

/** A ring of seed beads round the head at rest (artifacts/satellite.ts); its active form comes with the pendant code. */
const satellitePlacement = {
  layout: layoutSatellite,
  point: satellitePoint,
  pace: orbitSpeed,
  Form: SatelliteRing,
} satisfies PlacementModule<SatellitePlacement>;

export const PLACEMENTS = { orbit: orbitPlacement, satellite: satellitePlacement } as const;
export type PlacementKind = keyof typeof PLACEMENTS;

/**
 * The placement module a config names, typed to take that config. (One cast: the table and the
 * config union are keyed by the same kinds, which TypeScript cannot correlate through a lookup.)
 */
export function placementOf(config: PlacementConfig): PlacementModule<PlacementConfig> {
  return PLACEMENTS[config.kind] as unknown as PlacementModule<PlacementConfig>;
}

// --- Appear ----------------------------------------------------------------------------------

/** One artifact's appearance this frame (sequences/bubbleBlow.ts BlowFrame): the face's puff and round mouth, how far it has travelled from its origin, its size and its squash and stretch. */
export type AppearFrame = BlowFrame;

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

export interface AppearModule {
  /** The Theatre sheet this appearance plays (every kind so far plays one; a kind without one widens this when it is built). */
  readonly sheet: string;
  /** A fresh clock for one instance. */
  createRun(): AppearRun;
  /** Where the artifacts come from, in the character's body space (the blow: its mouth). */
  origin(head: HeadShape, face: FaceLayout): Vec3;
  /** Artifact `i` of the set, `seconds` into the appearance. */
  frame(sequences: Sequences, i: number, seconds: number): AppearFrame;
  /** The artifact's place `emerged` (0 to 1) of the way from `origin` to its path point `target`, written into `out`. */
  position(origin: Vec3, target: THREE.Vector3, emerged: number, out: THREE.Vector3): THREE.Vector3;
}

/** The blow (design 9.8): the character blows its artifacts from its mouth, one after another. */
const blowAppear = {
  sheet: 'bubbleBlow',
  createRun: () => new BlowRun(),
  origin: blowMouth,
  frame: blowFrame,
  position: blowPosition,
} as const satisfies AppearModule;

export const APPEARS = { blow: blowAppear } as const;
export type AppearId = keyof typeof APPEARS;

// --- Select ----------------------------------------------------------------------------------

/**
 * The suction hold's arm (artifacts/suctionHold.ts), in body units: it reaches out toward the
 * artifact at most `reach` (stopping `short` shy of it), draws `draw` of that back as it pulls the
 * artifact in, and lifts its tip `lift`; the artifact rides `bob` higher on the tip.
 */
const HOLD_ARM = { reach: 0.55, short: 0.2, draw: 0.5, lift: 0.16, bob: 0.04 } as const;

export interface SelectModule {
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

/** The suction hold (design 9.8, "Choosing a bubble"): the nearest arm turns toward the artifact, pulls it to its tip and lifts it. */
const suctionSelect = {
  beats: HOLD_BEATS,
  choreography: armFor => new HoldChoreography(armFor),
  nearestArm,
  position: pullPosition,
  // The middle of the orbits (or of the satellite's ring): the artifacts swing round where their rings are centred.
  centre: placement => ({ x: 0, y: placement.kind === 'orbit' ? placement.centreY : placement.ring.centreY }),
  // How far beyond the arm's tip a held bubble's centre sits, in bubble radii: its glass meets the tip clear of the logo.
  offTip: 1.25,
  arm: HOLD_ARM,
} as const satisfies SelectModule;

export const SELECTS = { suctionHold: suctionSelect } as const;
export type SelectId = keyof typeof SELECTS;

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
