import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing';
import { type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SELECTS, choosableNow, focusStagePose, placementCapacity, selectSettleMs } from '../artifacts/strategies';
import { resolveExpressions } from '../behavior/expressions';
import { FOCUS_BEATS } from '../behavior/focusChoreography';
import { PoseBlender, STAGE_TRANSITION } from '../behavior/poseBlend';
import { type LinkStage, initialStage } from '../behavior/stageMachine';
import type { ReviewOptions } from '../behavior/urlState';
import { readEntranceSeen, readReducedMotion, requestedStage, useStage } from '../behavior/useStage';
import { Octopus } from '../character/Octopus';
import { createGlowLightUniforms } from '../character/glowLight';
import { type AccentLink, createAccentUniforms } from '../character/worldAccent';
import { CAMERA_Z, STAGE_HALF, viewWindow } from '../config/stage';
import type { StageId } from '../config/types';
import { swimDrive } from '../motion/stroke';
import { swimShapes } from '../motion/swimArms';
import type { StagePose, SwimPoseSet } from '../poses/types';
import type { EntranceFrame } from '../sequences/entrance';
import { loadWorldSequences } from '../sequences/theatre';
import { fovFor } from '../stage/framing';
import { TIER_SETTINGS } from '../stage/quality';
import { QualityProbe, startingTier, usePageVisible, useQuality } from '../stage/useQuality';
import { type FaceStage, type WorldBundle, faceAnchor } from '../types/bundle';
import { BundleProblem, checkBundle } from './bundleProblem';
import { ExitLink } from '../ui/ExitLink';
import { IntroOverlay } from '../ui/IntroOverlay';
import { type FaceSpot, bubbleDisc, faceSpot } from '../ui/OrbButtons';
import { OverviewPanel } from '../ui/OverviewPanel';
import { Poster } from '../ui/Poster';
import { ProjectDetail } from '../ui/ProjectDetail';
import { SkipEntrance } from '../ui/SkipEntrance';
import { SkipLink } from '../ui/SkipLink';
import { TechChoices } from '../ui/TechChoices';
import { TechTooltip } from '../ui/TechTooltip';
import { armBootVeilFailsafe, bootVeilHeld, hideBootVeil, noteStageDrawn, veilPlan } from '../ui/bootVeil';
import { themeVars } from '../ui/theme';
import { tooltipContent } from '../ui/tooltipContent';
import type { Disc } from '../ui/tooltipPlacement';
import { hasWebgl2, useViewport } from '../ui/useViewport';
import { ContactShadows } from '../world/ContactShadows';
import { WorldScene } from '../world/WorldScene';
import { easeHover, hoverTarget, pinnedHover, worldHover } from '../world/cameraHover';
import { leanCamera } from '../world/lensShift';
import type { Vec3, WorldConfig } from '../world/types';
import { LAST_LEVEL, type WorldLevel, stepFrom } from '../world/worldLevel';
import { worldTierFor } from '../world/worldTiers';
import { EngineInstance } from './EngineInstance';
import { entranceDebug, markReady, report, reportNew, reportWorld } from './debugHooks';
import type { InstanceState } from './instance';
import { useInstance } from './instanceContext';
import { type PreviewOptions, applyPreview, headOpens, instanceKey } from './options';
import { type InstanceApi, InstanceApiContext } from './useInstanceApi';
import { createProjectModel, createSheets, startSheetLoaders } from './instanceModel';
import { useWindowListeners } from './listeners';

// The host (spec 8): one world's page, or a preview of it, from its bundle and the page's options
// alone. It validates the bundle, mounts an engine instance keyed on the world, and draws the
// canvas (the world, the character, the effects), the overlays and the debug probes. Nothing here
// names a world: every value a world sets is read from the bundle.

/** Storyboard or missing text shows, badged, only while developing; never in the public build. */
const SHOW_PLACEHOLDERS = import.meta.env.DEV;
/** Keys that skip the entrance: any but a bare modifier. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

/** The entrance as the development build reports it, for the end-to-end tests: written by a page instance (`window.__octoverse.entrance`, and `__noxEntrance` for Nox). */
const entranceReporter = (instance: InstanceState) =>
  import.meta.env.DEV ? (frame: EntranceFrame, seconds: number) => Object.assign(entranceDebug(instance), { t: seconds, spin: frame.spin, settle: frame.settle }) : undefined;

/** The stage camera as the development build reports it, for the end-to-end tests (`window.__octoverse.camera`, and `__noxCamera` for Nox; a page instance only): where it is, which way it faces, its field of view and lens shift, the drift's amount and the clock the drift ran on. */
function reportCamera(instance: InstanceState, camera: THREE.PerspectiveCamera, drift: number, seconds: number) {
  if (instance.mode !== 'page') return;
  report(instance, 'camera', {
    position: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(),
    fov: camera.fov,
    offsetY: camera.view?.offsetY ?? 0,
    drift,
    t: seconds,
  });
}

/**
 * `?pose=swim-open` or `swim-trail` (review stills): that swim pose in place of every stage's own,
 * its arms swung back as the stroke has them, open (sweep 0) or swept back into the trail (sweep 1).
 */
const reviewSwimFor = (swim: SwimPoseSet, pose: ReviewOptions['pose']) =>
  pose
    ? pose === 'swim-open'
      ? { pose: swim.open, drive: swimDrive({ sweep: 0, straighten: 0 }) }
      : { pose: swim.trail, drive: swimDrive({ sweep: 1, straighten: 0 }) }
    : null;
type ReviewSwim = ReturnType<typeof reviewSwimFor>;
const stagePoseOf = (poses: WorldBundle['poses'], reviewSwim: ReviewSwim, stage: StageId): StagePose => reviewSwim?.pose ?? poses[stage];

/** The stage whose face anchor a stage keeps still under the lean's lens shift. */
const faceStageOf = (stage: StageId): FaceStage => (stage === 'detail' ? 'detail' : stage === 'overview' || stage === 'techFocus' ? 'overview' : 'intro');

const REST: Vec3 = [0, 0, CAMERA_Z];

/** Puts the camera where the hover has it (or back on its axis), and `rest` where the stage camera is without it. */
function placeCamera(camera: THREE.PerspectiveCamera, rest: THREE.PerspectiveCamera, lookAt: THREE.Vector3, moved: { offset: readonly number[]; look: readonly number[] } | null) {
  if (moved) {
    camera.position.set(moved.offset[0], moved.offset[1], CAMERA_Z + moved.offset[2]);
    lookAt.set(moved.offset[0] + moved.look[0], moved.offset[1] + moved.look[1], CAMERA_Z + moved.look[2]);
    camera.lookAt(lookAt);
  } else {
    camera.position.set(0, 0, CAMERA_Z);
    camera.quaternion.identity();
  }
  rest.fov = camera.fov;
  rest.aspect = camera.aspect;
  rest.updateProjectionMatrix();
  rest.position.set(0, 0, CAMERA_Z);
}

/**
 * Fits the stage's frame (easing to a new stage's frame), or the `?view` box, and optionally adds
 * an orbit camera.
 */
function StageCamera({ stage, reducedMotion, options, world }: { stage: StageId; reducedMotion: boolean; options: ReviewOptions; world: WorldConfig }) {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera;
  const size = useThree(s => s.size);
  const gl = useThree(s => s.gl);
  const instance = useInstance();
  const { liveAnchors, bundle } = instance;
  const frames = bundle.stage.frames;
  // The character's face in each stage, worked out once.
  const faces = useMemo(() => ({ intro: faceAnchor(bundle, 'intro'), overview: faceAnchor(bundle, 'overview'), detail: faceAnchor(bundle, 'detail') }), [bundle]);
  const framed = !options.view && !options.orbit;
  // The world's camera lean (its pillars converge toward the top, as in panel 2); `?tilt=<rad>` tries another.
  const tilt = options.tilt ?? world.camera.tilt;
  const target = fovFor(frames[stage], size);
  // The stage camera at rest, which the page's overlays are laid out for; and the hover's state.
  const rest = useMemo(() => new THREE.PerspectiveCamera(24, 1, 0.1, 60), []);
  const hover = useRef(0);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, delta) => {
    if (!framed) return;
    if (Math.abs(camera.fov - target) >= 1e-4) {
      // Eased at the pace of the pose blend, so the view settles with the character.
      camera.fov = reducedMotion ? target : camera.fov + (target - camera.fov) * (1 - Math.exp(-Math.min(delta, 0.05) * 2.4));
      camera.updateProjectionMatrix();
    }
    // The default hover: a slow drift of the camera, eased in and out with the stage (a bubble's
    // hover, choice or hold does not touch it; `freeze` has none unless `?hover` gives the offset).
    const pinned = options.hover ? pinnedHover(options.hover) : null;
    hover.current = reducedMotion ? 0 : easeHover(hover.current, options.freeze ? 0 : hoverTarget(stage, false), Math.min(delta, 0.05));
    const moved = pinned ?? (hover.current > 0 ? worldHover(state.clock.elapsedTime, hover.current, world.camera.hover) : null);
    placeCamera(camera, rest, lookAt, moved);
    leanCamera(camera, tilt, faces[faceStageOf(stage)], REST, { fullWidth: size.width, fullHeight: size.height, x: 0, y: 0, width: size.width, height: size.height });
    liveAnchors.set(camera, rest, size);
    if (import.meta.env.DEV) reportCamera(instance, camera, hover.current, state.clock.elapsedTime);
  });
  useLayoutEffect(() => {
    const aspect = size.width / size.height;
    camera.clearViewOffset();
    if (options.view && !options.orbit) {
      // A zoom is a window onto the unmoved stage camera, so arms in front of or behind the
      // traced plane line up exactly as they do on the stage (it has no lean: the traced stage
      // is what the zoom compares with panel 2).
      const w = viewWindow(options.view, size.width, size.height);
      camera.position.set(0, 0, CAMERA_Z);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(STAGE_HALF / CAMERA_Z));
      camera.setViewOffset(w.fullWidth, w.fullHeight, w.x, w.y, w.width, w.height);
    } else if (options.view) {
      // The orbit view circles the box instead.
      const [x0, y0, x1, y1] = options.view;
      const halfHeight = Math.max(y0 - y1, (x1 - x0) / aspect) / 2;
      camera.position.set((x0 + x1) / 2, (y0 + y1) / 2, CAMERA_Z);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight / CAMERA_Z));
    } else {
      // Tall windows widen the view instead of cropping arms.
      camera.fov = fovFor(frames[stage], size);
    }
    camera.updateProjectionMatrix();
    if (!options.orbit) return;
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(camera.position.x, camera.position.y, 0);
    controls.update();
    return () => controls.dispose();
    // The stage's frame is eased in each frame above; a resize refits it at once.
  }, [camera, size, gl]);
  return null;
}

/** How long the ready flag waits for the far plate's layers before it goes ahead without them. */
const PLATE_WAIT_MS = 20_000;

/** How long the world's kit (near.glb, then kit.glb) may take to load before the world steps down a level; `?kitwait=<ms>` shortens it while developing. */
const KIT_WAIT_MS = 15_000;

/** Frames drawn after the scene (and with it the world) has loaded before it counts as ready. */
const READY_FRAMES = 40;

/** The boot veil (index.html) goes at the latest this long after the kit's and plate's waits, whatever the world is doing. */
const bootVeilFailsafeMs = (kitWait: number) => Math.max(kitWait, PLATE_WAIT_MS) + 2_000;

/**
 * Sets the ready flag (`window.__octoverse.ready`, and `__noxReady` for Nox; a page instance only)
 * once the scene has drawn READY_FRAMES frames; `wait` holds the count until the world's kit has
 * loaded (or been given up) and the far plate's layers have loaded or failed. A frame-rate
 * measurement (scripts/perf.mjs) then starts on a settled scene. The boot veil goes with it, and the
 * entrance's clock (held until then) starts. The page has one veil, so a preview leaves it alone.
 */
function ReadyFlag({ wait }: { wait: boolean }) {
  const instance = useInstance();
  const frames = useRef(0);
  useFrame(() => {
    // The stage has drawn: the veil, once it has faded, may leave without showing the bare page.
    if (instance.mode === 'page') noteStageDrawn();
    if (wait || frames.current > READY_FRAMES) return;
    if (++frames.current === READY_FRAMES) {
      markReady(instance);
      if (instance.mode === 'page') hideBootVeil();
    }
  });
  return null;
}

/** `?mask` draws the octopus as a flat white silhouette on black, for shape comparison. */
function SilhouetteOnly() {
  const scene = useThree(s => s.scene);
  useLayoutEffect(() => {
    scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 'white' });
    return () => { scene.overrideMaterial = null; };
  }, [scene]);
  return null;
}

/** What a host page gives `WorldHost` (spec 19, amendment A2): the world, how it is drawn, and how the page hears and steers it. */
export interface HostProps {
  bundle: WorldBundle;
  /** The review and debug switches (the page parsed them from its address once). */
  options: ReviewOptions;
  mode?: 'page' | 'preview';
  /** `engine` (default): the engine's own HTML. `none`: no title, nameplate, overview panel, skip link or skip-entrance control; the page's own children read and drive the instance (`useInstanceApi`). The detail panel (reached only through the engine's own controls or `stageRequest`), the orb buttons, tray and tooltips are not part of it: the artifacts are governed by a preview's `artifacts`, and the choosable stages by the bundle. */
  ui?: 'engine' | 'none';
  /** A preview's drawing options (`mode: 'preview'` only): they replace exactly the review options they cover (stage, freeze, tier cap, world level, artifacts) and leave the rest of `options` (dev switches such as `noWebgl`) as given. They are read when the instance mounts: a later change is not applied reliably (key the host on its options to apply one). */
  preview?: PreviewOptions;
  /** The stage a page instance opens on: never the entrance or a technology focus (those are ignored). Read at mount: a parent that re-applies the same `initialStage` or last `stageRequest` after the instance remounted (a new bundle object) re-applies it. */
  initialStage?: LinkStage;
  /** Called after each change of stage (not for the one it started in). */
  onStageChange?: (stage: StageId) => void;
  /** Asks for a stage; a new `id` is a new request. It is taken as the visitor's own moves would be (the detail only from the overview). */
  stageRequest?: { id: number; stage: LinkStage };
  /** A link out of the instance, drawn in the world's theme and first in its focus order. */
  exit?: { label: string; href: string };
  /** The page's own elements: inside the instance, so `useInstanceApi()` works in them. */
  children?: ReactNode;
}

/**
 * One world's page (or a preview of it): the bundle validated (a bad one throws a BundleError
 * naming the field), and an engine instance keyed on the bundle itself, so another world, or a new
 * bundle of the same world (an edit, a creator's preview), is another instance. Reads only the
 * bundle and the host's options. An embedder keeps the bundle object stable: a new object on every
 * render remounts the instance (the canvas and the stage) every time.
 */
export function WorldHost({ bundle, options, mode = 'page', preview, ...host }: HostProps) {
  const checked = useMemo(() => checkBundle(bundle), [bundle]);
  // A bundle that cannot be drawn shows a plain message and is logged, not a blank page (the error names the field).
  useEffect(() => {
    if (checked.error) console.error(checked.error);
  }, [checked]);
  // A preview's options are the review options it covers, so the instance reads one set.
  const { stage, tierCap, motion, place, artifacts } = preview ?? {};
  const effective = useMemo(
    () => (mode === 'preview' && stage && motion && place && artifacts ? applyPreview(options, { stage, tierCap, motion, place, artifacts }) : options),
    [options, mode, stage, tierCap, motion, place, artifacts],
  );
  if (checked.error) return <BundleProblem error={checked.error} />;
  return (
    <EngineInstance key={instanceKey(bundle)} bundle={checked.valid} mode={mode}>
      <World options={effective} {...host} />
    </EngineInstance>
  );
}

function World({ options, ui = 'engine', initialStage: initial, onStageChange, stageRequest, exit, children }: Pick<HostProps, 'options' | 'ui' | 'initialStage' | 'onStageChange' | 'stageRequest' | 'exit' | 'children'>) {
  const instance = useInstance();
  const { bubbleLive, mode, bundle } = instance;
  // The character is clamped already (validateBundle).
  const { character: config, artifacts, content, place: world, poses, swim } = bundle;
  const { project, technologies } = content;
  const page = mode === 'page';
  const reportEntrance = useMemo(() => entranceReporter(instance), [instance]);
  const { state, dispatch, reducedMotion } = useStage(project, { worldId: instance.id, mode, options, choosableIn: artifacts.choosableIn, initial, request: stageRequest, onChange: onStageChange });
  const quality = useQuality(options);
  // What this instance shows of the project, and its Theatre sheets: its own, made here and not at module load.
  const model = useMemo(() => createProjectModel(project, technologies, placementCapacity(artifacts.placement)), [project, technologies, artifacts.placement]);
  const { orbs, tech, usage, order, overflow, trayItem } = model;
  // Without WebGL (or `?nowebgl`) the instance is the poster under the HTML overlays; the entrance has nothing to play on.
  const webgl = useMemo(() => !options.noWebgl && hasWebgl2(), [options.noWebgl]);
  const mask = options.mask === true;
  // A preview's artifacts are settled or hidden: either way no sheet plays (the bubbles are simply there, or not at all; the head is as the stage blend has it).
  const noSheets = options.artifacts !== undefined;
  const hideArtifacts = options.artifacts === 'hidden';
  // A project with no sections, for testing the full project view; honoured only while developing.
  const detailProject = useMemo(() => (import.meta.env.DEV && options.fixture === 'nosections' ? { ...project, sections: [] } : project), [options.fixture, project]);
  const reviewSwim = useMemo(() => reviewSwimFor(swim, options.pose), [swim, options.pose]);
  const kitWait = import.meta.env.DEV && options.kitWait ? options.kitWait : KIT_WAIT_MS;
  // The ids that tie one instance's controls to its panels: unique to it, so two instances on a page never share one.
  const tooltipId = useId();
  const detailsId = useId();
  // The sheets (the entrance's, the bubble blow's, the head swell's), loading from the first render, beside the world and the first
  // frame: nothing waits on them. The entrance's loads when the instance will open on it; the others unless motion is off
  // (`?freeze&blow=<s>` and `&swell=<s>` are stills of those moments). The swim's arm shapes are worked out as the entrance's
  // arrives, at the starting tier's segment count (a tier lowered mid-swim works out its own on its next frame), so the
  // entrance's first frame does not pay for them. Octopus starts the entrance's clock on the first frame drawn with the sheet in.
  const [sheets] = useState(() => createSheets(bundle.sequences, { blowAt: options.freeze ? options.blow : undefined, swellAt: options.freeze ? options.swell : undefined }));
  const [wants] = useState(() => ({
    entrance: webgl && initialStage({ entranceSeen: readEntranceSeen(instance.id, mode), ...requestedStage(options, initial), reducedMotion: readReducedMotion() }).stage === 'entering',
    blow: webgl && !noSheets && (sheets.blow.at !== undefined || !(options.freeze || readReducedMotion())),
    swell: webgl && !noSheets && (sheets.swell.at !== undefined || !(options.freeze || readReducedMotion())),
  }));
  useEffect(
    () =>
      startSheetLoaders(sheets, wants, () => loadWorldSequences(bundle.sequences), () => {
        swimShapes(swim, poses.intro, TIER_SETTINGS[startingTier(options).tier].segments);
        if (import.meta.env.DEV) entranceDebug(instance).loaded = true;
      }),
    [sheets, wants, options, instance, bundle, swim, poses],
  );
  // Development builds give the capture scripts the page's own loader (`window.__octoverse.sequences`): they sample the sheets with it, whatever the world.
  useEffect(() => {
    if (import.meta.env.DEV) reportNew(instance, 'sequences', () => loadWorldSequences(bundle.sequences));
  }, [instance, bundle]);
  // On a phone held upright the orbs are too small to pick out, so the tray lists every technology (as it does without WebGL).
  const viewport = useViewport();
  const phone = viewport.layout === 'phone';
  const trayAll = viewport.phonePortrait || !webgl;
  const worldTier = worldTierFor(quality.tier, phone);
  useEffect(() => {
    if (import.meta.env.DEV) report(instance, 'worldTier', worldTier);
  }, [worldTier, instance]);
  // The document's title follows the world once it is up (index.html holds a neutral one until then); a page instance only, and put back when it goes.
  useEffect(() => {
    if (!page) return;
    const before = document.title;
    document.title = bundle.theme.pageTitle;
    return () => {
      document.title = before;
    };
  }, [page, bundle.theme.pageTitle]);
  // No WebGL: no entrance to wait for.
  useEffect(() => {
    if (!webgl) dispatch({ type: 'SKIP' });
  }, [dispatch, webgl]);
  // The boot veil (index.html) stays while the entrance is waiting on the world (the ready flag takes it away), or
  // at the failsafe; a page with no entrance to hold for (skipped, past it, a still, no WebGL, motion off) drops it now.
  // The page has the one veil: a preview neither holds for it nor takes it away.
  const entering = state.stage === 'entering';
  useEffect(() => (page ? armBootVeilFailsafe(bootVeilFailsafeMs(kitWait)) : undefined), [page, kitWait]);
  useEffect(() => {
    if (!page) return;
    const plan = veilPlan({ webgl, entering, freeze: options.freeze, reducedMotion, mask });
    if (plan === 'wait') return;
    // No canvas to wait for when there is no WebGL, and the mask page draws none of the world.
    if (!webgl || mask) noteStageDrawn();
    hideBootVeil({ immediate: plan === 'now' });
  }, [entering, reducedMotion, page, webgl, mask, options.freeze]);
  // The far plate's layers load outside Suspense; the ready flag waits for them.
  const [plateReady, setPlateReady] = useState(false);
  const [plateLoaded, setPlateLoaded] = useState(false);
  const settlePlate = useCallback((loaded: boolean) => {
    setPlateLoaded(loaded);
    setPlateReady(true);
  }, []);
  // A world file that will not load steps the world down (WorldBoundary) rather than blanking the stage.
  const [worldLevel, setWorldLevel] = useState<WorldLevel>(options.worldLevel ?? 0);
  // Each failure names the level it came from, so one reported twice steps once (stepFrom).
  const failWorld = useCallback((error: unknown, failed: WorldLevel) => {
    console.warn('the world did not load; drawing less of it:', error);
    setWorldLevel(level => stepFrom(level, failed));
  }, []);
  // The level whose kit has arrived. A file that neither loads nor fails (a request left hanging)
  // would leave the world's kit out for good, so each level gets KIT_WAIT_MS before it steps down;
  // the character and the water are up the whole time (they are outside the kit's Suspense).
  const [kitLevel, setKitLevel] = useState<WorldLevel | null>(null);
  const kitDone = kitLevel === worldLevel || worldLevel === LAST_LEVEL;
  useEffect(() => {
    if (kitDone) return;
    const timer = setTimeout(() => failWorld(new Error(`the world's kit did not load in ${kitWait} ms`), worldLevel), kitWait);
    return () => clearTimeout(timer);
  }, [kitDone, worldLevel, failWorld, kitWait]);
  // A layer that neither loads nor fails (a request left hanging) must not hold the flag for good.
  useEffect(() => {
    if (plateReady) return;
    const timer = setTimeout(() => settlePlate(false), PLATE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [plateReady, settlePlate]);
  // Development builds say whether the world's files really arrived: the ready flag is also set once a wait was given up,
  // and a still taken then would lack the kit or the plate (scripts/capture-ready.mjs refuses it).
  useEffect(() => {
    if (import.meta.env.DEV) reportWorld(instance, { kit: kitLevel === 0 && worldLevel === 0, plate: plateReady && plateLoaded });
  }, [instance, kitLevel, worldLevel, plateReady, plateLoaded]);
  const visible = usePageVisible();
  // The pixels drawn per CSS pixel: the device's, up to the tier's cap, times the tier's render scale.
  const pixelRatio = Math.max(1, Math.min(window.devicePixelRatio, quality.settings.dpr)) * quality.settings.renderScale;
  const segments = quality.settings.segments;
  // A lower tier rebuilds the arms at its segment count, from the stage the character is in. On the entrance
  // the blender holds the intro pose it swims into (the swim's own arm shapes and placement come
  // from the entrance, in Octopus), so when it ends it is already there.
  // A technology focus keeps the stage it came from (the intro or the overview) for pose, framing and words.
  const shown: StageId = state.stage === 'techFocus' ? state.returnTo : state.stage;
  // The pose the character takes: the stage's own; in a technology focus, the stage it came from as
  // the world's select has it (focusStagePose: Nox keeps that pose as it is; Veyra's arm lift closes
  // the head and wears the focus pose's face, the arms staying where they were).
  const shownPose = state.stage === 'techFocus' && !reviewSwim?.pose ? focusStagePose(poses, state.returnTo, SELECTS[artifacts.select.kind]) : stagePoseOf(poses, reviewSwim, shown);
  const blender = useMemo(() => new PoseBlender(stagePoseOf(poses, reviewSwim, state.stage === 'entering' ? 'intro' : shown), segments, undefined, resolveExpressions(config)), [segments, config]);
  // In a world, the world lights the character's skin through these capped accents, from the lights nearest it.
  // The particles' reach is the character's own light distance and decay: another character's light moves them too.
  const { distance: lightDistance, decay: lightDecay } = config.glow.light;
  const accents = useMemo<AccentLink>(() => ({ uniforms: createAccentUniforms(), at: new THREE.Vector3(), light: createGlowLightUniforms(), reach: { distance: lightDistance, decay: lightDecay } }), [lightDistance, lightDecay]);
  const frame = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const prevStage = useRef(state.stage);
  // Whether the entrance ran its course (the character is then in the intro pose already).
  const entrance = useRef({ finished: false });
  // The settle has begun: the intro's words come in as the character settles (design 9.6).
  const [settling, setSettling] = useState(false);
  // Every stage change sets the character moving toward the new pose; with reduced motion it lands at
  // once and the view crossfades instead. Into and out of a technology focus, only the dome
  // moves (the arms keep their places), on the focus choreography's beats: it folds away as the
  // eyes settle, and reopens once the arm has let go.
  useEffect(() => {
    const from = prevStage.current;
    prevStage.current = state.stage;
    const opening = first.current;
    first.current = false;
    if (state.stage === 'entering') {
      // Reduced motion has no swim (the preference can change while it plays).
      if (reducedMotion) dispatch({ type: 'SKIP' });
      return;
    }
    // An entrance that ran its course has already turned the character into the intro pose.
    if (from === 'entering' && entrance.current.finished) return;
    // A skipped one lands in the intro at once, under the crossfade.
    const skipped = from === 'entering';
    const fromTech = from === 'techFocus';
    const toTech = state.stage === 'techFocus';
    const beat = toTech ? FOCUS_BEATS.dome : fromTech ? FOCUS_BEATS.domeBack : null;
    const duration = reducedMotion || skipped ? 0 : beat ? beat.ms : STAGE_TRANSITION.durationMs;
    const stagger = beat ? 0 : STAGE_TRANSITION.staggerMs;
    blender.start(shownPose, performance.now(), duration, stagger, reducedMotion || skipped || !beat ? 0 : beat.delay);
    if (!opening && (reducedMotion || skipped)) frame.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }, [blender, state.stage, shownPose, reducedMotion, dispatch]);
  // Any click or key skips the entrance (a page instance only: a preview on the page would otherwise skip another's).
  const skip = (event: Event) => {
    if (event instanceof KeyboardEvent && MODIFIER_KEYS.has(event.key)) return;
    dispatch({ type: 'SKIP' });
  };
  useWindowListeners(mode, entering ? { pointerdown: skip, keydown: skip } : {});
  // Escape steps back: a focused technology lets go, detail goes to the overview, the overview to
  // the intro. With a technology in focus, a press anywhere but one of this instance's orbs or its tooltip lets go too.
  const focusing = state.stage === 'techFocus';
  useWindowListeners(mode, {
    keydown: event => {
      if (event.key === 'Escape') dispatch({ type: focusing ? 'BLUR_TECH' : 'CLOSE' });
    },
    pointerdown: event => {
      if (!focusing) return;
      const hit = (event.target as Element | null)?.closest?.('.orb-button, .tech-tooltip, .orb-tray-item');
      if (!hit || !frame.current?.contains(hit)) dispatch({ type: 'BLUR_TECH' });
    },
  });
  const focusedTech = focusing ? state.techId : null;
  // The bubble's orbit eases to still in about 0.4 s once it is hot, and the suction hold pulls it
  // to its arm's tip, so the tooltip takes its place when it has arrived there (at once with motion
  // off): the bubble's place and the others', and the face's; it then keeps beside it as it lifts.
  const SETTLE_MS = selectSettleMs(artifacts.select);
  const settle = reducedMotion || options.freeze ? 0 : SETTLE_MS;
  // The tooltip shown, and the one before it fading out, each where it was placed.
  const [tips, setTips] = useState<{ techId: string; orb: Disc; others: Disc[]; face: FaceSpot; leaving: boolean }[]>([]);
  useEffect(() => {
    const here = focusedTech ? orbs.findIndex(o => o.techId === focusedTech) : -1;
    const live = () => !trayAll && here >= 0 && !!bubbleLive.spots[here]?.size;
    const place = () => {
      if (!focusedTech) return null;
      // No bubble to stand beside (the tray's technology, a phone in portrait, no WebGL, or the first frame not yet drawn): the tooltip
      // is described beside the tray's button, as a sheet, and a disc just under the face stands in for the orb.
      if (!live()) {
        if (webgl && !trayAll && here >= 0) return null;
        const f = faceSpot(bundle, 'overview');
        return { techId: focusedTech, orb: { x: f.x, y: f.bounds.bottom + 30, size: 44 } as Disc, others: [] as Disc[], face: f, leaving: false };
      }
      const orb = bubbleDisc(instance, here, shown === 'intro' ? 'intro' : 'overview');
      if (!orb) return null;
      return {
        techId: focusedTech,
        orb,
        others: orbs.flatMap((_, i) => { const d = i === here ? null : bubbleDisc(instance, i); return d ? [d] : []; }),
        face: faceSpot(bundle, shown === 'intro' ? 'intro' : 'overview'),
        leaving: false,
      };
    };
    let unsub = () => {};
    const show = () => {
      const tip = place();
      // The bubbles are not drawn yet: wait for their first frame.
      if (!tip && focusedTech && webgl && !trayAll) {
        unsub = bubbleLive.subscribe(() => { if (live()) { unsub(); show(); } });
        return;
      }
      setTips(list => [...list.filter(t => t.techId !== focusedTech).map(t => ({ ...t, leaving: true })), ...(tip ? [tip] : [])]);
    };
    const timer = window.setTimeout(show, settle);
    // Letting go (or moving on) starts the old tooltip fading out at once.
    setTips(list => list.some(t => t.techId !== focusedTech && !t.leaving) ? list.map(t => (t.techId === focusedTech ? t : { ...t, leaving: true })) : list);
    const gone = window.setTimeout(() => setTips(list => list.filter(tip => !tip.leaving)), 240 + settle);
    return () => {
      unsub();
      window.clearTimeout(timer);
      window.clearTimeout(gone);
    };
  }, [focusedTech, settle, shown, viewport, trayAll, instance, bubbleLive, webgl, orbs, bundle]);
  // The world's UI colours, as the `--oct-*` custom properties its stylesheets read.
  const theme = useMemo(() => themeVars(bundle.theme), [bundle]);
  const octopus = (
    <Octopus
      config={config}
      swimPoses={swim}
      introPose={poses.intro}
      artifacts={artifacts}
      blender={blender}
      stage={state.stage}
      expression={options.expression}
      freeze={options.freeze}
      reducedMotion={reducedMotion}
      silhouette={mask}
      quality={quality.settings}
      // Clicking the head swells it open; clicking it again closes it.
      onSelect={() => dispatch({ type: state.stage === 'overview' ? 'CLOSE' : 'OPEN_OVERVIEW' })}
      headOpen={headOpens(shownPose)}
      poses={poses}
      swellSheet={sheets.swell}
      orbs={orbs}
      focusTechId={focusedTech}
      blowSheet={noSheets ? undefined : sheets.blow}
      hideArtifacts={hideArtifacts}
      accents={accents}
      solo={options.solo}
      yaw={options.yaw}
      armDrive={reviewSwim?.drive}
      holdAt={options.freeze ? options.hold : undefined}
      entranceSheet={sheets.entrance}
      entranceHold={page ? bootVeilHeld : undefined}
      entranceSeconds={options.t ?? 2}
      onEntranceSettling={() => setSettling(true)}
      onEntranceDone={() => {
        entrance.current.finished = true;
        dispatch({ type: 'ENTRANCE_DONE' });
      }}
      // The sheet failed or did not come in time: land in the intro, as a skip does.
      onEntranceUnavailable={() => dispatch({ type: 'SKIP' })}
      onEntranceFrame={reportEntrance}
    />
  );
  // What the page's own elements read and drive (`useInstanceApi`): the engine's UI below makes the same moves.
  const face = useMemo(() => faceAnchor(bundle, faceStageOf(shown)), [bundle, shown]);
  const attend = useCallback<InstanceApi['attend']>(
    (target, opts) => instance.attend.set(target, opts?.reach === true),
    [instance],
  );
  const api = useMemo<InstanceApi>(
    () => ({
      stage: state.stage,
      faceAnchor: face,
      liveShift: world => instance.liveAnchors.shift(world),
      explore: () => dispatch({ type: 'OPEN_OVERVIEW' }),
      back: () => dispatch({ type: focusing ? 'BLUR_TECH' : 'CLOSE' }),
      skip: () => dispatch({ type: 'SKIP' }),
      attend,
    }),
    [state.stage, face, instance, dispatch, focusing, attend],
  );
  return (
    <InstanceApiContext.Provider value={api}>
    <div className="spike" ref={frame} style={theme}>
      {exit && <ExitLink label={exit.label} href={exit.href} />}
      {webgl && <Canvas
        flat
        dpr={pixelRatio}
        frameloop={visible ? 'always' : 'never'}
        // The world's surface light casts shadows, and its sky sphere reaches 100 units.
        shadows="percentage"
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, CAMERA_Z], fov: 24, near: 0.1, far: 140 }}
      >
        <color attach="background" args={[mask ? '#000000' : world.palette.waterFar]} />
        <StageCamera stage={shown} reducedMotion={reducedMotion} options={options} world={world} />
        {quality.adaptive && <QualityProbe tier={quality.tier} onLower={quality.step} />}
        {mask ? (
          <>
            <SilhouetteOnly />
            {octopus}
          </>
        ) : (
          <>
            {/* Nothing here waits on a file: the world's kit has a Suspense of its own, so the character and the
                water are drawn whatever the network does. */}
            <WorldScene world={world} level={worldLevel} onFail={failWorld} onKitSettled={setKitLevel} time={options} tier={worldTier} onPlateSettled={settlePlate} accents={accents} solo={options.solo} reducedMotion={reducedMotion} />
            {octopus}
            <ReadyFlag wait={!plateReady || !kitDone} />
            {/* SMAA edges, not 4x multisampling: the same look at stage size for about 40% more frame rate. */}
            <EffectComposer multisampling={0}>
              {quality.settings.contactShadows ? <ContactShadows settings={world.post.contactShadow} /> : <></>}
              <Bloom mipmapBlur {...world.post.bloom} resolutionScale={0.5 * quality.settings.bloomScale} />
              <Vignette {...world.post.vignette} />
              <SMAA />
            </EffectComposer>
          </>
        )}
      </Canvas>}
      {!webgl && <Poster image={bundle.theme.poster} />}
      {!mask && !options.view && (
        <>
          {/* `ui: 'none'` leaves out the title, nameplate, overview panel and the skip controls (spec 19, P1); the detail panel, the orb buttons, the tray and the tooltips stay (the last three go with `artifacts: 'hidden'`). */}
          {ui === 'engine' && <SkipLink target={detailsId} onSkip={() => { dispatch({ type: 'SKIP' }); dispatch({ type: 'OPEN_OVERVIEW' }); dispatch({ type: 'OPEN_DETAIL' }); }} />}
          {/* The intro's words come in as the character settles at the end of the entrance (the skip control goes then). */}
          {ui === 'engine' && <IntroOverlay project={project} hidden={shown !== 'intro' && !(entering && settling)} onExplore={api.explore} />}
          {ui === 'engine' && <SkipEntrance hidden={!entering || settling} onSkip={api.skip} />}
          {ui === 'engine' && <OverviewPanel project={project} open={state.stage === 'overview'} sheet={phone || !webgl} dispatch={dispatch} />}
          <ProjectDetail project={detailProject} technologies={technologies} open={state.stage === 'detail'} showPlaceholders={SHOW_PLACEHOLDERS} forceSheet={!webgl} panelId={detailsId} dispatch={dispatch} />
          {/* In a stage the world does not let a technology be chosen in, there are no buttons and no tray (the tooltips sit between them). A preview with its artifacts hidden has none to choose. */}
          {!hideArtifacts && <TechChoices
            stage={shown}
            artifacts={artifacts}
            buttons={{
              orbs,
              open: choosableNow(shown, artifacts) && webgl && !viewport.phonePortrait,
              focused: focusedTech,
              tooltipId,
              onChoose: id => dispatch({ type: 'FOCUS_TECH', id }),
            }}
            tray={{
              items: (trayAll ? order : overflow).map(trayItem),
              open: state.stage === 'overview' || state.stage === 'techFocus',
              all: trayAll,
              lifted: state.stage === 'overview' && (phone || !webgl),
              focused: focusedTech,
              tooltipId,
              onChoose: id => dispatch(id === focusedTech ? { type: 'BLUR_TECH' } : { type: 'FOCUS_TECH', id }),
            }}
          >
            {tips.map(tip => {
              const technology = tech.get(tip.techId);
              if (!technology) return null;
              return (
                <TechTooltip
                  key={tip.techId}
                  id={tooltipId}
                  content={tooltipContent(technology, usage.get(tip.techId), SHOW_PLACEHOLDERS)}
                  orb={tip.orb}
                  face={tip.face}
                  others={tip.others}
                  follow={trayAll ? -1 : orbs.findIndex(o => o.techId === tip.techId)}
                  delayMs={Math.max(0, FOCUS_BEATS.tooltip - settle)}
                  leaving={tip.leaving}
                />
              );
            })}
          </TechChoices>}
        </>
      )}
      {children}
    </div>
    </InstanceApiContext.Provider>
  );
}
