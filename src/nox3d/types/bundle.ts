import { APPEARS, PLACEMENTS, SELECTS } from '../artifacts/strategies';
import { ARM_IDS, type ArtifactConfig, type CharacterConfig, STAGE_IDS, type StageId, isChoosingStage } from '../../engine/config/types';
import { clampCharacterConfig } from '../../engine/config/validate';
import type { Project, Technology } from '../content/projectTypes';
import { validateProject } from '../content/validateProject';
import type { StagePose, SwimPoseSet } from '../../engine/poses/types';
import type { SequenceSet } from '../sequences/keys';
import type { StageFrame } from '../stage/framing';
import type { UiTheme } from '../ui/theme';
import { TITLE_ICONS } from '../ui/titleIcons';
import { isColour, isWorldColour } from '../world/colour';
import type { Vec3, WorldConfig } from '../world/types';
import { validateWorld } from '../world/validateWorld';

// A world as one value (spec 6.2, trimmed to what E02 builds, spec 14.1): the character, its
// poses and swim, its artifacts and sequences, the place, the stage's framing, the content and the
// UI theme. The host (host/WorldHost.tsx) reads only this and the page's options; nothing in the
// engine imports a world's files.

/**
 * A world's id: lower case letters, digits and hyphens, starting with a letter, 2 to 32 long. The
 * `u-` prefix is reserved for creator bundles (amendment A2, P4): no shipped world uses it.
 */
export type WorldId = string;

/** The worlds that ship with the engine (their bundles are in the repo). */
export const WORLDS = ['nox'] as const satisfies readonly WorldId[];

const WORLD_ID = /^[a-z][a-z0-9-]{1,31}$/;
const CREATOR_PREFIX = 'u-';

export interface WorldBundle {
  id: WorldId;
  character: CharacterConfig;
  /** One pose per stage, each with exactly the eight arms (validateBundle checks both). */
  poses: Record<StageId, StagePose>;
  swim: SwimPoseSet;
  artifacts: ArtifactConfig;
  sequences: SequenceSet;
  place: WorldConfig;
  /** What each stage frames (stage/framing.ts `fovFor`). */
  stage: { frames: Record<StageId, StageFrame> };
  content: { project: Project; technologies: readonly Technology[] };
  theme: UiTheme;
}

/** A bundle that is not a world the engine can draw: `field` names the part that is wrong. */
export class BundleError extends Error {
  /** The bundle field that is wrong, as a path (`poses.intro.arms`, `theme.accent`). */
  readonly field: string;

  constructor(field: string, problem: string) {
    super(`WorldBundle ${field}: ${problem}`);
    this.name = 'BundleError';
    this.field = field;
  }
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The string fields of the character and the place that are not colours: ids, the arms' depth
 * layer, the head effect, file urls, kinds, and the kit's piece names. Every other string in them
 * is a colour and must parse (`isColour`): a field added later is checked as one until it is named
 * here, so a colour three would draw black never passes unnoticed. `skinAccent` has its own grammar
 * (world/colour.ts `isWorldColour`).
 */
const NOT_COLOUR = /(?:^|\.)(?:id|depth|headEffect|url|kind|piece)$|\.pieces\[\d+\]$/;

/** Every number in `value` is finite and every colour parses, or a BundleError names the field. */
function checkLeaves(value: unknown, path: string, colours: boolean) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new BundleError(path, `${value} is not a finite number`);
  } else if (typeof value === 'string') {
    if (!colours || NOT_COLOUR.test(path)) return;
    const ok = path.endsWith('.skinAccent') ? isWorldColour(value) : isColour(value);
    if (!ok) throw new BundleError(path, `"${value}" is not a colour three can read`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => checkLeaves(item, `${path}[${i}]`, colours));
  } else if (record(value)) {
    for (const [key, item] of Object.entries(value)) checkLeaves(item, `${path}.${key}`, colours);
  }
}

/**
 * Every part of the bundle the checks below (and the host) read is there, and of the form it is read
 * in, or a BundleError names the field: a missing part must not surface later as a TypeError.
 */
function checkPresent(bundle: WorldBundle) {
  const need = (field: string, value: unknown, what = 'an object') => {
    if (!record(value)) throw new BundleError(field, `is missing (the bundle needs ${what} here)`);
  };
  need('character', bundle.character);
  need('character.head', (bundle.character as Partial<CharacterConfig>)?.head);
  const arms = bundle.character.arms as readonly { id?: unknown }[] | undefined;
  if (!Array.isArray(arms)) throw new BundleError('character.arms', 'is missing (a character has exactly eight arms)');
  if (arms.length !== ARM_IDS.length || arms.some((arm, i) => arm?.id !== ARM_IDS[i])) throw new BundleError('character.arms', `needs exactly the eight arms ${ARM_IDS.join(', ')}, in order`);
  need('place', bundle.place);
  need('poses', bundle.poses);
  need('swim', bundle.swim);
  need('artifacts', bundle.artifacts);
  need('artifacts.placement', bundle.artifacts.placement);
  need('artifacts.appear', bundle.artifacts.appear);
  need('artifacts.select', bundle.artifacts.select);
  if (!Array.isArray(bundle.artifacts.choosableIn)) throw new BundleError('artifacts.choosableIn', 'is missing (the stages a technology can be chosen in, as a list)');
  need('sequences', bundle.sequences);
  need('sequences.defaults', bundle.sequences.defaults);
  need('theme', bundle.theme);
  need('stage', bundle.stage);
  need('stage.frames', bundle.stage.frames);
  need('content', bundle.content);
  need('content.project', bundle.content.project);
  if (!Array.isArray(bundle.content.technologies)) throw new BundleError('content.technologies', 'is missing (the technologies, as a list)');
}

/** Each stage has a pose, and each pose has exactly the eight arms, T1..T8. */
function checkPoses(poses: unknown) {
  if (!record(poses)) throw new BundleError('poses', 'is not an object');
  for (const stage of STAGE_IDS) {
    const pose = poses[stage];
    if (!record(pose) || !record(pose.arms)) throw new BundleError(`poses.${stage}`, 'is missing (every stage needs a pose with its arms)');
    if (!record(pose.body)) throw new BundleError(`poses.${stage}.body`, 'is missing (every pose places the body: x, y, z and scale)');
    const keys: string[] = Object.keys(pose.arms);
    const missing = ARM_IDS.filter(id => !keys.includes(id));
    if (missing.length > 0) throw new BundleError(`poses.${stage}.arms`, `is missing ${missing.join(', ')} (a pose has exactly the arms ${ARM_IDS.join(', ')})`);
    const extra = keys.filter(key => !(ARM_IDS as readonly string[]).includes(key));
    if (extra.length > 0) throw new BundleError(`poses.${stage}.arms`, `has ${extra.join(', ')}, which is not an arm (a pose has exactly the arms ${ARM_IDS.join(', ')})`);
  }
}

/**
 * The bundle checked and its character clamped, or a BundleError naming what is wrong: the id's
 * form (and the creator prefix), every stage's pose with exactly the eight arms, every stage's
 * frame, the artifact kinds and the sheets they play, the title icon, the world (validateWorld) and
 * the project (validateProject, against the bundle's technologies). Numbers that are not finite and
 * colours that do not parse are refused here, by name, before the character's clamp would quietly
 * read a default in their place. `worlds` is the list of shipped worlds (WORLDS).
 */
export function validateBundle(bundle: WorldBundle, worlds: readonly WorldId[] = WORLDS): WorldBundle {
  const { id } = bundle;
  if (typeof id !== 'string' || !WORLD_ID.test(id)) throw new BundleError('id', `"${String(id)}" is not a world id (lower case letters, digits and hyphens, starting with a letter, 2 to 32 long)`);
  if (id.startsWith(CREATOR_PREFIX) && worlds.includes(id)) throw new BundleError('id', `"${id}" is a shipped world, but the "${CREATOR_PREFIX}" prefix is reserved for creator bundles`);

  checkPresent(bundle);
  checkPoses(bundle.poses);
  for (const stage of STAGE_IDS) {
    const frame = bundle.stage.frames[stage];
    if (!frame || !(finite(frame.width) && frame.width > 0) || !(finite(frame.height) && frame.height > 0)) throw new BundleError(`stage.frames.${stage}`, 'needs a width and a height above 0');
  }
  if (!finite(bundle.swim.stretch) || !finite(bundle.swim.bodyX)) throw new BundleError('swim', 'needs a finite stretch and bodyX');

  // Every number, everywhere but the swim (its poses are built on first read) and the sequences' state (a loader).
  const { swim: _swim, sequences, ...rest } = bundle;
  const { state: _state, ...sequenceData } = sequences;
  checkLeaves(rest.character, 'character', true);
  checkLeaves(rest.place, 'place', true);
  checkLeaves(rest.poses, 'poses', false);
  checkLeaves(rest.artifacts, 'artifacts', false);
  checkLeaves(rest.stage, 'stage', false);
  checkLeaves(rest.content, 'content', false);
  checkLeaves(sequenceData, 'sequences', false);
  for (const [key, value] of Object.entries(bundle.theme)) {
    if (key === 'titleIcon') continue;
    if (!isColour(value)) throw new BundleError(`theme.${key}`, `"${String(value)}" is not a colour`);
  }
  if (!Object.hasOwn(TITLE_ICONS, bundle.theme.titleIcon)) throw new BundleError('theme.titleIcon', `"${bundle.theme.titleIcon}" is not one of the engine's title icons (${Object.keys(TITLE_ICONS).join(', ')})`);

  const { placement, appear, select, choosableIn } = bundle.artifacts;
  if (!Object.hasOwn(PLACEMENTS, placement.kind)) throw new BundleError('artifacts.placement.kind', `"${placement.kind}" is not a placement the engine has (${Object.keys(PLACEMENTS).join(', ')})`);
  if (!Object.hasOwn(APPEARS, appear.kind)) throw new BundleError('artifacts.appear.kind', `"${appear.kind}" is not an appear the engine has (${Object.keys(APPEARS).join(', ')})`);
  if (!Object.hasOwn(SELECTS, select.kind)) throw new BundleError('artifacts.select.kind', `"${select.kind}" is not a select the engine has (${Object.keys(SELECTS).join(', ')})`);
  for (const stage of choosableIn) if (!isChoosingStage(stage)) throw new BundleError('artifacts.choosableIn', `"${stage}" is not a stage a technology can be chosen in`);
  for (const sheet of ['entrance', 'headSwell', 'arrival', APPEARS[appear.kind].sheet] as const) {
    if (!sequences.defaults[sheet]) throw new BundleError(`sequences.defaults.${sheet}`, 'is missing (the engine plays this sheet)');
  }

  const world = validateWorld(bundle.place);
  if (world.length > 0) throw new BundleError('place', world.join('; '));
  const project = validateProject(bundle.content.project, { catalog: bundle.content.technologies });
  if (!project.valid) throw new BundleError('content.project', project.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));

  let character: CharacterConfig;
  try {
    character = clampCharacterConfig(bundle.character);
  } catch (error) {
    // The arms were checked above, so what the clamp throws now is about the character as a whole.
    throw new BundleError('character', error instanceof Error ? error.message : String(error));
  }
  return { ...bundle, character };
}

/** The stages a face anchor is worked out for: a technology focus keeps the overview's, the entrance lands in the intro's. */
export type FaceStage = 'intro' | 'overview' | 'detail';

/** The character's face origin in a stage, x and y on the stage plane: the pose's body plus the head's face origin. */
export function faceOrigin(bundle: Pick<WorldBundle, 'character' | 'poses'>, stage: FaceStage): readonly [number, number] {
  const { body } = bundle.poses[stage];
  const [ox, oy] = bundle.character.head.faceOrigin;
  return [body.x + ox, body.y + oy];
}

/**
 * The character's face in the intro, the overview or the detail: the point the overlays stay
 * attached to and the world camera's lens shift keeps in place, and the one the overview's face
 * spot is projected from, at the head's front. Derived from the character's head and the stage's
 * pose, so every character has its own with no second table.
 */
export function faceAnchor(bundle: Pick<WorldBundle, 'character' | 'poses'>, stage: FaceStage): Vec3 {
  const [x, y] = faceOrigin(bundle, stage);
  const { head } = bundle.character;
  return [x, y - 0.1, head.depth * head.halfWidth];
}
