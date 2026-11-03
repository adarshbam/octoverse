import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FOCUS_BEATS } from './behavior/focusChoreography';
import { HOLD_BEATS } from './artifacts/suctionHold';
import { PoseBlender, STAGE_TRANSITION } from './behavior/poseBlend';
import type { ReviewOptions } from './behavior/urlState';
import { initialStage } from './behavior/stageMachine';
import { readEntranceSeen, readReducedMotion, useStage } from './behavior/useStage';
import { Octopus } from './character/Octopus';
import { createGlowLightUniforms } from './character/glowLight';
import { type AccentLink, createAccentUniforms } from './character/worldAccent';
import { NOX } from './config/nox.character';
import { CAMERA_Z, STAGE_HALF, viewWindow } from './config/stage';
import type { CharacterConfig, StageId } from './config/types';
import { clampCharacterConfig } from './config/validate';
import { noxProject } from './content/noxProject';
import { swimDrive } from './motion/stroke';
import { NOX_POSES } from './poses/nox.poses';
import { SWIM_POSES, swimShapes } from './poses/nox.swim';
import type { StagePose } from './poses/types';
import type { EntranceFrame } from './sequences/entrance';
import { POST } from './post';
import { STAGE_FRAMES, fovFor } from './stage/framing';
import { noxFaceAnchor } from './stage/liveAnchors';
import { EngineInstance } from './host/EngineInstance';
import type { InstanceState } from './host/instance';
import { debugWindow, entranceDebug, markReady, reportWorld } from './host/debugHooks';
import { useInstance } from './host/instanceContext';
import { createProjectModel, createSheets, startSheetLoaders } from './host/instanceModel';
import { useWindowListeners } from './host/listeners';
import { cameraHover, easeHover, hoverTarget, pinnedHover } from './world/cameraHover';
import { leanCamera } from './world/lensShift';
import type { Vec3 } from './world/types';
import { QualityProbe, startingTier, usePageVisible, useQuality } from './stage/useQuality';
import { TIER_SETTINGS } from './stage/quality';
import { IntroOverlay } from './ui/IntroOverlay';
import { OverviewPanel } from './ui/OverviewPanel';
import { ProjectDetail } from './ui/ProjectDetail';
import { SkipEntrance } from './ui/SkipEntrance';
import { OrbButtons, bubbleDisc, faceSpot } from './ui/OrbButtons';
import { TechTooltip } from './ui/TechTooltip';
import type { Disc } from './ui/tooltipPlacement';
import { tooltipContent } from './ui/tooltipContent';
import { OrbTray } from './ui/OrbTray';
import { noxTechnologies } from './content/noxTechnologies';
import { armBootVeilFailsafe, bootVeilHeld, hideBootVeil, noteStageDrawn, veilPlan } from './ui/bootVeil';
import { Poster } from './ui/Poster';
import { SkipLink } from './ui/SkipLink';
import { hasWebgl2, useViewport } from './ui/useViewport';

import { ContactShadows } from './world/ContactShadows';
import { SECURITY_WORLD } from './world/security/config';
import type { WorldConfig } from './world/types';
import { worldTierFor } from './world/worldTiers';
import { LAST_LEVEL, type WorldLevel, stepFrom } from './world/worldLevel';
import { WorldScene } from './world/WorldScene';

/** Storyboard or missing text shows, badged, only while developing; never in the public build. */
const SHOW_PLACEHOLDERS = import.meta.env.DEV;
/** Keys that skip the entrance: any but a bare modifier. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

/** The entrance as the development build reports it, for the end-to-end tests: written by a page instance (`window.__octoverse.entrance`, and `__noxEntrance` for Nox). */
const entranceReporter = (instance: InstanceState) =>
  import.meta.env.DEV ? (frame: EntranceFrame, seconds: number) => Object.assign(entranceDebug(instance), { t: seconds, spin: frame.spin, settle: frame.settle }) : undefined;

/** The stage camera as the development build reports it, for the end-to-end tests (`window.__noxCamera`, a page instance only): where it is, which way it faces, its field of view and lens shift, the drift's amount and the clock the drift ran on. */
function reportCamera(instance: InstanceState, camera: THREE.PerspectiveCamera, drift: number, seconds: number) {
  const w = debugWindow(instance);
  if (!w) return;
  w.__noxCamera = {
    position: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(),
    fov: camera.fov,
    offsetY: camera.view?.offsetY ?? 0,
    drift,
    t: seconds,
  };
}

/**
 * `?pose=swim-open` or `swim-trail` (review stills): that swim pose in place of every stage's own,
 * its arms swung back as the stroke has them, open (sweep 0) or swept back into the trail (sweep 1).
 */
const reviewSwimFor = (pose: ReviewOptions['pose']) =>
  pose
    ? pose === 'swim-open'
      ? { pose: SWIM_POSES.open, drive: swimDrive({ sweep: 0, straighten: 0 }) }
      : { pose: SWIM_POSES.trail, drive: swimDrive({ sweep: 1, straighten: 0 }) }
    : null;
type ReviewSwim = ReturnType<typeof reviewSwimFor>;
const stagePoseOf = (reviewSwim: ReviewSwim, stage: StageId): StagePose => reviewSwim?.pose ?? NOX_POSES[stage];

/** Nox's face in a stage: the point the lean's lens shift keeps where it was. */
const faceOf = (stage: StageId) => noxFaceAnchor(stage === 'detail' ? 'detail' : stage === 'overview' || stage === 'techFocus' ? 'overview' : 'intro');

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
function StageCamera({ stage, reducedMotion, options }: { stage: StageId; reducedMotion: boolean; options: ReviewOptions }) {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera;
  const size = useThree(s => s.size);
  const gl = useThree(s => s.gl);
  const instance = useInstance();
  const { liveAnchors } = instance;
  const framed = !options.view && !options.orbit;
  // The world's camera lean (its pillars converge toward the top, as in panel 2); `?tilt=<rad>` tries another.
  const tilt = options.tilt ?? SECURITY_WORLD.camera.tilt;
  const target = fovFor(STAGE_FRAMES[stage], size);
  // The stage camera at rest, which the page's overlays are laid out for; and the hover's state.
  const rest = useMemo(() => new THREE.PerspectiveCamera(24, 1, 0.1, 60), []);
  const hover = useRef(0);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, delta) => {
    if (!framed) return;
    if (Math.abs(camera.fov - target) >= 1e-4) {
      // Eased at the pace of the pose blend, so the view settles with Nox.
      camera.fov = reducedMotion ? target : camera.fov + (target - camera.fov) * (1 - Math.exp(-Math.min(delta, 0.05) * 2.4));
      camera.updateProjectionMatrix();
    }
    // The default hover: a slow drift of the camera, eased in and out with the stage (a bubble's
    // hover, choice or hold does not touch it; `freeze` has none unless `?hover` gives the offset).
    const pinned = options.hover ? pinnedHover(options.hover) : null;
    hover.current = reducedMotion ? 0 : easeHover(hover.current, options.freeze ? 0 : hoverTarget(stage, false), Math.min(delta, 0.05));
    const moved = pinned ?? (hover.current > 0 ? cameraHover(state.clock.elapsedTime, hover.current) : null);
    placeCamera(camera, rest, lookAt, moved);
    leanCamera(camera, tilt, faceOf(stage), REST, { fullWidth: size.width, fullHeight: size.height, x: 0, y: 0, width: size.width, height: size.height });
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
      camera.fov = fovFor(STAGE_FRAMES[stage], size);
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

/** How long `__noxReady` waits for the far plate's layers before it goes ahead without them. */
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

/**
 * `?variant=dummy` (development only): the dummy character and world, config alone. The dynamic
 * import sits behind the literal DEV check, so the production bundle holds neither fixture.
 */
export function App({ options, mode = 'page' }: { options: ReviewOptions; mode?: 'page' | 'preview' }) {
  const [variant, setVariant] = useState<{ character: CharacterConfig; world: WorldConfig } | null>(null);
  const wantsVariant = import.meta.env.DEV && options.variant === 'dummy';
  useEffect(() => {
    if (import.meta.env.DEV && options.variant === 'dummy') {
      void Promise.all([import('./config/fixtures/dummy.character'), import('./world/fixtures/dummy.world')]).then(([c, w]) => setVariant({ character: c.DUMMY, world: w.DUMMY_WORLD }));
    }
  }, [options.variant]);
  if (wantsVariant) return variant ? <EngineInstance id="nox" mode={mode}><NoxApp character={variant.character} world={variant.world} options={options} /></EngineInstance> : null;
  return <EngineInstance id="nox" mode={mode}><NoxApp character={NOX} world={SECURITY_WORLD} options={options} /></EngineInstance>;
}

function NoxApp({ character, world, options }: { character: CharacterConfig; world: WorldConfig; options: ReviewOptions }) {
  const instance = useInstance();
  const { bubbleLive, mode } = instance;
  const page = mode === 'page';
  const reportEntrance = useMemo(() => entranceReporter(instance), [instance]);
  const config = useMemo(() => clampCharacterConfig(character), [character]);
  const { state, dispatch, reducedMotion } = useStage(noxProject, { worldId: instance.id, mode, options });
  const quality = useQuality(options);
  // What this instance shows of the project, and its Theatre sheets: its own, made here and not at module load.
  const model = useMemo(() => createProjectModel(noxProject, noxTechnologies), []);
  const { orbs, tech, usage, order, overflow, trayItem } = model;
  // Without WebGL (or `?nowebgl`) the instance is the poster under the HTML overlays; the entrance has nothing to play on.
  const webgl = useMemo(() => !options.noWebgl && hasWebgl2(), [options.noWebgl]);
  const mask = options.mask === true;
  // A project with no sections, for testing the full project view; honoured only while developing.
  const detailProject = useMemo(() => (import.meta.env.DEV && options.fixture === 'nosections' ? { ...noxProject, sections: [] } : noxProject), [options.fixture]);
  const reviewSwim = useMemo(() => reviewSwimFor(options.pose), [options.pose]);
  const kitWait = import.meta.env.DEV && options.kitWait ? options.kitWait : KIT_WAIT_MS;
  // The ids that tie one instance's controls to its panels: unique to it, so two instances on a page never share one.
  const tooltipId = useId();
  const detailsId = useId();
  // The sheets (the entrance's, the bubble blow's, the head swell's), loading from the first render, beside the world and the first
  // frame: nothing waits on them. The entrance's loads when the instance will open on it; the others unless motion is off
  // (`?freeze&blow=<s>` and `&swell=<s>` are stills of those moments). The swim's arm shapes are worked out as the entrance's
  // arrives, at the starting tier's segment count (a tier lowered mid-swim works out its own on its next frame), so the
  // entrance's first frame does not pay for them. Octopus starts the entrance's clock on the first frame drawn with the sheet in.
  const [sheets] = useState(() => createSheets({ blowAt: options.freeze ? options.blow : undefined, swellAt: options.freeze ? options.swell : undefined }));
  const [wants] = useState(() => ({
    entrance: webgl && initialStage({ entranceSeen: readEntranceSeen(instance.id, mode), requested: options.stage, reducedMotion: readReducedMotion() }).stage === 'entering',
    blow: webgl && (sheets.blow.at !== undefined || !(options.freeze || readReducedMotion())),
    swell: webgl && (sheets.swell.at !== undefined || !(options.freeze || readReducedMotion())),
  }));
  useEffect(
    () =>
      startSheetLoaders(sheets, wants, () => {
        swimShapes(TIER_SETTINGS[startingTier(options).tier].segments);
        if (import.meta.env.DEV) entranceDebug(instance).loaded = true;
      }),
    [sheets, wants, options, instance],
  );
  // On a phone held upright the orbs are too small to pick out, so the tray lists every technology (as it does without WebGL).
  const viewport = useViewport();
  const phone = viewport.layout === 'phone';
  const trayAll = viewport.phonePortrait || !webgl;
  const worldTier = worldTierFor(quality.tier, phone);
  useEffect(() => {
    const w = debugWindow(instance);
    if (import.meta.env.DEV && w) w.__noxWorldTier = worldTier;
  }, [worldTier, instance]);
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
  // The far plate's layers load outside Suspense; `__noxReady` waits for them.
  const [plateReady, setPlateReady] = useState(false);
  const [plateLoaded, setPlateLoaded] = useState(false);
  const settlePlate = useCallback((loaded: boolean) => {
    setPlateLoaded(loaded);
    setPlateReady(true);
  }, []);
  // A world file that will not load steps the world down (WorldBoundary) rather than blanking the stage.
  const [worldLevel, setWorldLevel] = useState<WorldLevel>(0);
  // Each failure names the level it came from, so one reported twice steps once (stepFrom).
  const failWorld = useCallback((error: unknown, failed: WorldLevel) => {
    console.warn('the world did not load; drawing less of it:', error);
    setWorldLevel(level => stepFrom(level, failed));
  }, []);
  // The level whose kit has arrived. A file that neither loads nor fails (a request left hanging)
  // would leave the world's kit out for good, so each level gets KIT_WAIT_MS before it steps down;
  // Nox and the water are up the whole time (they are outside the kit's Suspense).
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
  // Development builds say whether the world's files really arrived: `__noxReady` is also set once a wait was given up,
  // and a still taken then would lack the kit or the plate (scripts/capture-ready.mjs refuses it).
  useEffect(() => {
    if (import.meta.env.DEV) reportWorld(instance, { kit: kitLevel === 0 && worldLevel === 0, plate: plateReady && plateLoaded });
  }, [instance, kitLevel, worldLevel, plateReady, plateLoaded]);
  const visible = usePageVisible();
  // The pixels drawn per CSS pixel: the device's, up to the tier's cap, times the tier's render scale.
  const pixelRatio = Math.max(1, Math.min(window.devicePixelRatio, quality.settings.dpr)) * quality.settings.renderScale;
  const segments = quality.settings.segments;
  // A lower tier rebuilds the arms at its segment count, from the stage Nox is in. On the entrance
  // the blender holds the intro pose he swims into (the swim's own arm shapes and placement come
  // from the entrance, in Octopus), so when it ends he is already there.
  // A technology focus keeps the stage it came from (the intro or the overview) for pose, framing and words.
  const shown: StageId = state.stage === 'techFocus' ? state.returnTo : state.stage;
  const blender = useMemo(() => new PoseBlender(stagePoseOf(reviewSwim, state.stage === 'entering' ? 'intro' : shown), segments), [segments]);
  // In a world, the world lights Nox's skin through these capped accents, from the lights nearest him.
  const accents = useMemo<AccentLink>(() => ({ uniforms: createAccentUniforms(), at: new THREE.Vector3(), light: createGlowLightUniforms() }), []);
  const frame = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const prevStage = useRef(state.stage);
  // Whether the entrance ran its course (Nox is then in the intro pose already).
  const entrance = useRef({ finished: false });
  // The settle has begun: the intro's words come in as Nox settles (design 9.6).
  const [settling, setSettling] = useState(false);
  // Every stage change sets Nox moving toward the new pose; with reduced motion it lands at
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
    // An entrance that ran its course has already turned Nox into the intro pose.
    if (from === 'entering' && entrance.current.finished) return;
    // A skipped one lands in the intro at once, under the crossfade.
    const skipped = from === 'entering';
    const fromTech = from === 'techFocus';
    const toTech = state.stage === 'techFocus';
    const beat = toTech ? FOCUS_BEATS.dome : fromTech ? FOCUS_BEATS.domeBack : null;
    const duration = reducedMotion || skipped ? 0 : beat ? beat.ms : STAGE_TRANSITION.durationMs;
    const stagger = beat ? 0 : STAGE_TRANSITION.staggerMs;
    blender.start(stagePoseOf(reviewSwim, shown), performance.now(), duration, stagger, reducedMotion || skipped || !beat ? 0 : beat.delay);
    if (!opening && (reducedMotion || skipped)) frame.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }, [blender, state.stage, shown, reducedMotion, dispatch, reviewSwim]);
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
  const SETTLE_MS = HOLD_BEATS.pullMs[1];
  const settle = reducedMotion || options.freeze ? 0 : SETTLE_MS;
  // The tooltip shown, and the one before it fading out, each where it was placed.
  const [tips, setTips] = useState<{ techId: string; orb: Disc; others: Disc[]; face: ReturnType<typeof faceSpot>; leaving: boolean }[]>([]);
  useEffect(() => {
    const here = focusedTech ? orbs.findIndex(o => o.techId === focusedTech) : -1;
    const live = () => !trayAll && here >= 0 && !!bubbleLive.spots[here]?.size;
    const place = () => {
      if (!focusedTech) return null;
      // No bubble to stand beside (the tray's technology, a phone in portrait, no WebGL, or the first frame not yet drawn): the tooltip
      // is described beside the tray's button, as a sheet, and a disc just under Nox's face stands in for the orb.
      if (!live()) {
        if (webgl && !trayAll && here >= 0) return null;
        const f = faceSpot('overview');
        return { techId: focusedTech, orb: { x: f.x, y: f.bounds.bottom + 30, size: 44 } as Disc, others: [] as Disc[], face: f, leaving: false };
      }
      const orb = bubbleDisc(instance, here, shown === 'intro' ? 'intro' : 'overview');
      if (!orb) return null;
      return {
        techId: focusedTech,
        orb,
        others: orbs.flatMap((_, i) => { const d = i === here ? null : bubbleDisc(instance, i); return d ? [d] : []; }),
        face: faceSpot(shown === 'intro' ? 'intro' : 'overview'),
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
  }, [focusedTech, settle, shown, viewport, trayAll, instance, bubbleLive, webgl, orbs]);
  const octopus = (
    <Octopus
      config={config}
      blender={blender}
      stage={state.stage}
      expression={options.expression}
      freeze={options.freeze}
      reducedMotion={reducedMotion}
      silhouette={mask}
      quality={quality.settings}
      // Clicking the head swells it open; clicking it again closes it.
      onSelect={() => dispatch({ type: state.stage === 'overview' ? 'CLOSE' : 'OPEN_OVERVIEW' })}
      headOpen={stagePoseOf(reviewSwim, shown).headMorph >= 0.5}
      swellSheet={sheets.swell}
      orbs={orbs}
      focusTechId={focusedTech}
      blowSheet={sheets.blow}
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
  return (
    <div className="spike" ref={frame}>
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
        <StageCamera stage={shown} reducedMotion={reducedMotion} options={options} />
        {quality.adaptive && <QualityProbe tier={quality.tier} onLower={quality.step} />}
        {mask ? (
          <>
            <SilhouetteOnly />
            {octopus}
          </>
        ) : (
          <>
            {/* Nothing here waits on a file: the world's kit has a Suspense of its own, so Nox and the
                water are drawn whatever the network does. */}
            <WorldScene world={world} level={worldLevel} onFail={failWorld} onKitSettled={setKitLevel} time={options} tier={worldTier} onPlateSettled={settlePlate} accents={accents} solo={options.solo} reducedMotion={reducedMotion} />
            {octopus}
            <ReadyFlag wait={!plateReady || !kitDone} />
            {/* SMAA edges, not 4x multisampling: the same look at stage size for about 40% more frame rate. */}
            <EffectComposer multisampling={0}>
              {quality.settings.contactShadows ? <ContactShadows settings={POST.contactShadows} /> : <></>}
              <Bloom mipmapBlur {...POST.bloom} resolutionScale={0.5 * quality.settings.bloomScale} />
              <Vignette {...POST.worldVignette} />
              <SMAA />
            </EffectComposer>
          </>
        )}
      </Canvas>}
      {!webgl && <Poster />}
      {!mask && !options.view && (
        <>
          <SkipLink target={detailsId} onSkip={() => { dispatch({ type: 'SKIP' }); dispatch({ type: 'OPEN_OVERVIEW' }); dispatch({ type: 'OPEN_DETAIL' }); }} />
          {/* The intro's words come in as Nox settles at the end of the entrance (the skip control goes then). */}
          <IntroOverlay project={noxProject} hidden={shown !== 'intro' && !(entering && settling)} onExplore={() => dispatch({ type: 'OPEN_OVERVIEW' })} />
          <SkipEntrance hidden={!entering || settling} onSkip={() => dispatch({ type: 'SKIP' })} />
          <OverviewPanel project={noxProject} open={state.stage === 'overview'} sheet={phone || !webgl} dispatch={dispatch} />
          <ProjectDetail project={detailProject} technologies={noxTechnologies} open={state.stage === 'detail'} showPlaceholders={SHOW_PLACEHOLDERS} forceSheet={!webgl} panelId={detailsId} dispatch={dispatch} />
          <OrbButtons
            orbs={orbs}
            open={(shown === 'intro' || shown === 'overview') && webgl && !viewport.phonePortrait}
            focused={focusedTech}
            tooltipId={tooltipId}
            onChoose={id => dispatch({ type: 'FOCUS_TECH', id })}
          />
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
          <OrbTray
            items={(trayAll ? order : overflow).map(trayItem)}
            open={state.stage === 'overview' || state.stage === 'techFocus'}
            all={trayAll}
            lifted={state.stage === 'overview' && (phone || !webgl)}
            focused={focusedTech}
            tooltipId={tooltipId}
            onChoose={id => dispatch(id === focusedTech ? { type: 'BLUR_TECH' } : { type: 'FOCUS_TECH', id })}
          />
        </>
      )}
    </div>
  );
}
