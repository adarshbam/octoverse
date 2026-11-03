import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FOCUS_BEATS, focusReaction } from './behavior/focusChoreography';
import { HOLD_BEATS } from './artifacts/suctionHold';
import { PoseBlender, STAGE_TRANSITION } from './behavior/poseBlend';
import { parseUrlState } from './behavior/urlState';
import { initialStage } from './behavior/stageMachine';
import { readEntranceSeen, readReducedMotion, useStage } from './behavior/useStage';
import { type EntranceSheet, Octopus } from './character/Octopus';
import { createGlowLightUniforms } from './character/glowLight';
import { type AccentLink, createAccentUniforms } from './character/worldAccent';
import { NOX } from './config/nox.character';
import { CAMERA_Z, STAGE_HALF, viewWindow } from './config/stage';
import type { StageId } from './config/types';
import { clampCharacterConfig } from './config/validate';
import { noxProject } from './content/noxProject';
import { swimDrive } from './motion/stroke';
import { NOX_POSES } from './poses/nox.poses';
import { SWIM_POSES, swimShapes } from './poses/nox.swim';
import type { StagePose } from './poses/types';
import type { EntranceFrame } from './sequences/entrance';
import type { BlowSheet } from './sequences/bubbleBlow';
import type { SwellSheet } from './sequences/headSwell';
import { loadSequences } from './sequences/theatre';
import { POST } from './post';
import { STAGE_FRAMES, fovFor } from './stage/framing';
import { liveAnchors, noxFaceAnchor } from './stage/liveAnchors';
import { bubblePointer, cameraHover, easeHover, hoverTarget, pinnedHover } from './world/cameraHover';
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
import { Poster } from './ui/Poster';
import { SkipLink } from './ui/SkipLink';
import { hasWebgl2, useViewport } from './ui/useViewport';

import { ContactShadows } from './world/ContactShadows';
import { SECURITY_WORLD } from './world/security/config';
import { worldTierFor } from './world/worldTiers';
import { LAST_LEVEL, type WorldLevel, stepFrom } from './world/worldLevel';
import { WorldScene } from './world/WorldScene';

const url = parseUrlState(location.search);
// The project's technologies in its order, each in a bubble orbiting Nox; the rest go to the tray.
const ORDER = noxProject.primaryTechnologyIds ?? [];
const TECH = new Map(noxTechnologies.map(t => [t.id, t]));
const USAGE = new Map((noxProject.technologyUsages ?? []).map(u => [u.technologyId, u]));
/** How many bubbles orbit Nox. */
const BUBBLE_COUNT = 15;
const OVERFLOW = ORDER.slice(BUBBLE_COUNT);
const ORBS = ORDER.slice(0, BUBBLE_COUNT).map(techId => ({
  techId,
  iconKey: TECH.get(techId)?.iconKey ?? techId,
  name: TECH.get(techId)?.name ?? techId,
  reaction: focusReaction(USAGE.get(techId)),
}));
/** Storyboard or missing text shows, badged, only while developing; never in the public build. */
const SHOW_PLACEHOLDERS = import.meta.env.DEV;
// Without WebGL (or `?nowebgl`) the page is the poster under the HTML overlays; the entrance has nothing to play on.
const WEBGL = !url.noWebgl && hasWebgl2();
const TOOLTIP_ID = 'tech-tooltip';
const trayItem = (techId: string) => ({ techId, name: TECH.get(techId)?.name ?? techId, iconKey: TECH.get(techId)?.iconKey ?? techId });
const MASK = new URLSearchParams(location.search).has('mask');
/** Keys that skip the entrance: any but a bare modifier. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta']);
// A project with no sections, for testing the full project view; honoured only while developing.
const DETAIL_PROJECT = import.meta.env.DEV && url.fixture === 'nosections' ? { ...noxProject, sections: [] } : noxProject;

/**
 * The entrance's sheet (the Theatre state, about 0.2 MB), loading from the moment this module runs
 * when the page will open on the entrance, beside the world and the first frame: nothing waits on
 * it. The swim's arm shapes are worked out as it arrives, at the starting tier's segment count (a
 * tier lowered mid-swim works out its own on its next frame), so the entrance's first frame does not
 * pay for them. Octopus starts the entrance's clock on the first frame drawn with the sheet in.
 */
const ENTRANCE_SHEET: EntranceSheet = { sequences: null, failed: false };
if (WEBGL && initialStage({ entranceSeen: readEntranceSeen(), requested: url.stage, reducedMotion: readReducedMotion() }).stage === 'entering') {
  loadSequences().then(
    sequences => {
      swimShapes(TIER_SETTINGS[startingTier(url).tier].segments);
      ENTRANCE_SHEET.sequences = sequences;
      if (import.meta.env.DEV) entranceDebug().loaded = true;
    },
    (error: unknown) => {
      console.warn('the entrance did not load; going straight to the intro:', error);
      ENTRANCE_SHEET.failed = true;
    },
  );
}
/**
 * The bubble blow's sheet (the same Theatre state): Nox blows the bubbles when they first appear,
 * once the entrance has settled (or as the page opens past it), so it loads from the start unless
 * motion is off. `?freeze&blow=<s>` is a still of the blow at that moment, for review.
 */
const BLOW_STILL = url.freeze && new URLSearchParams(location.search).has('blow') ? Number(new URLSearchParams(location.search).get('blow')) || 0 : undefined;
const BLOW_SHEET: BlowSheet = { sequences: null, failed: false, at: BLOW_STILL };
if (BLOW_STILL !== undefined || !(url.freeze || readReducedMotion())) {
  loadSequences().then(
    sequences => void (BLOW_SHEET.sequences = sequences),
    () => void (BLOW_SHEET.failed = true),
  );
}

/**
 * The head swell's sheet (the same Theatre state): clicking the head swells it into the overview's
 * dome. It loads from the start unless motion is off; `?freeze&swell=<s>` is a still of the opening
 * at that moment, for review.
 */
const SWELL_STILL = url.freeze && new URLSearchParams(location.search).has('swell') ? Number(new URLSearchParams(location.search).get('swell')) || 0 : undefined;
const SWELL_SHEET: SwellSheet = { sequences: null, failed: false, at: SWELL_STILL };
if (SWELL_STILL !== undefined || !(url.freeze || readReducedMotion())) {
  loadSequences().then(
    sequences => void (SWELL_SHEET.sequences = sequences),
    () => void (SWELL_SHEET.failed = true),
  );
}

/** `?freeze&hold=<ms>`: a still of the suction hold that moment after a bubble is chosen, for review. */
const HOLD_STILL = url.freeze && new URLSearchParams(location.search).has('hold') ? Number(new URLSearchParams(location.search).get('hold')) || 0 : undefined;

/** A still of the entrance (`?stage=entering&freeze`) shows `?t=<s>`, or mid-swim, 2 s in. */
const ENTRANCE_STILL_SECONDS = url.t ?? 2;

/** The entrance as the development build reports it, for the end-to-end tests (`window.__noxEntrance`). */
function entranceDebug() {
  const w = window as unknown as { __noxEntrance?: { loaded: boolean; t: number; spin: number; settle: number } };
  return (w.__noxEntrance ??= { loaded: false, t: 0, spin: 0, settle: 0 });
}
const reportEntrance = import.meta.env.DEV
  ? (frame: EntranceFrame, seconds: number) => Object.assign(entranceDebug(), { t: seconds, spin: frame.spin, settle: frame.settle })
  : undefined;

/** The world's camera lean (its pillars converge toward the top, as in panel 2); `?tilt=<rad>` tries another. */
const TILT = url.tilt ?? SECURITY_WORLD.camera.tilt;

/**
 * `?pose=swim-open` or `swim-trail` (review stills): that swim pose in place of every stage's own,
 * its arms swung back as the stroke has them, open (sweep 0) or swept back into the trail (sweep 1).
 */
const REVIEW_SWIM = url.pose
  ? url.pose === 'swim-open'
    ? { pose: SWIM_POSES.open, drive: swimDrive({ sweep: 0, straighten: 0 }) }
    : { pose: SWIM_POSES.trail, drive: swimDrive({ sweep: 1, straighten: 0 }) }
  : null;
const stagePose = (stage: StageId): StagePose => REVIEW_SWIM?.pose ?? NOX_POSES[stage];

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
function StageCamera({ stage, reducedMotion }: { stage: StageId; reducedMotion: boolean }) {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera;
  const size = useThree(s => s.size);
  const gl = useThree(s => s.gl);
  const framed = !url.view && !url.orbit;
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
    // The default hover: a slow drift of the camera, eased in and out (it holds still over a bubble,
    // and when a still is pinned: `freeze` has none unless `?hover` gives the offset).
    const pinned = url.hover ? pinnedHover(url.hover) : null;
    hover.current = reducedMotion ? 0 : easeHover(hover.current, url.freeze ? 0 : hoverTarget(stage, bubblePointer.hovered, false), Math.min(delta, 0.05));
    const moved = pinned ?? (hover.current > 0 ? cameraHover(state.clock.elapsedTime, hover.current) : null);
    placeCamera(camera, rest, lookAt, moved);
    leanCamera(camera, TILT, faceOf(stage), REST, { fullWidth: size.width, fullHeight: size.height, x: 0, y: 0, width: size.width, height: size.height });
    liveAnchors.set(camera, rest, size);
  });
  useLayoutEffect(() => {
    const aspect = size.width / size.height;
    camera.clearViewOffset();
    if (url.view && !url.orbit) {
      // A zoom is a window onto the unmoved stage camera, so arms in front of or behind the
      // traced plane line up exactly as they do on the stage (it has no lean: the traced stage
      // is what the zoom compares with panel 2).
      const w = viewWindow(url.view, size.width, size.height);
      camera.position.set(0, 0, CAMERA_Z);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(STAGE_HALF / CAMERA_Z));
      camera.setViewOffset(w.fullWidth, w.fullHeight, w.x, w.y, w.width, w.height);
    } else if (url.view) {
      // The orbit view circles the box instead.
      const [x0, y0, x1, y1] = url.view;
      const halfHeight = Math.max(y0 - y1, (x1 - x0) / aspect) / 2;
      camera.position.set((x0 + x1) / 2, (y0 + y1) / 2, CAMERA_Z);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight / CAMERA_Z));
    } else {
      // Tall windows widen the view instead of cropping arms.
      camera.fov = fovFor(STAGE_FRAMES[stage], size);
    }
    camera.updateProjectionMatrix();
    if (!url.orbit) return;
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
const KIT_WAIT = import.meta.env.DEV && url.kitWait ? url.kitWait : KIT_WAIT_MS;

/** Frames drawn after the scene (and with it the world) has loaded before it counts as ready. */
const READY_FRAMES = 40;

/**
 * Sets `window.__noxReady` once the scene has drawn READY_FRAMES frames; `wait` holds the count
 * until the world's kit has loaded (or been given up) and the far plate's layers have loaded or failed. A frame-rate
 * measurement (scripts/perf.mjs) then starts on a settled scene.
 */
function ReadyFlag({ wait }: { wait: boolean }) {
  const frames = useRef(0);
  useFrame(() => {
    if (wait || frames.current > READY_FRAMES) return;
    if (++frames.current === READY_FRAMES) (window as unknown as { __noxReady?: boolean }).__noxReady = true;
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

export function App() {
  const config = useMemo(() => clampCharacterConfig(NOX), []);
  const { state, dispatch, reducedMotion } = useStage(noxProject);
  const quality = useQuality(url);
  // On a phone held upright the orbs are too small to pick out, so the tray lists every technology (as it does without WebGL).
  const viewport = useViewport();
  const phone = viewport.layout === 'phone';
  const trayAll = viewport.phonePortrait || !WEBGL;
  const worldTier = worldTierFor(quality.tier, phone);
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __noxWorldTier?: unknown }).__noxWorldTier = worldTier;
  }, [worldTier]);
  // No WebGL: no entrance to wait for.
  useEffect(() => {
    if (!WEBGL) dispatch({ type: 'SKIP' });
  }, [dispatch]);
  // The far plate's layers load outside Suspense; `__noxReady` waits for them.
  const [plateReady, setPlateReady] = useState(false);
  const settlePlate = useCallback(() => setPlateReady(true), []);
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
    const timer = setTimeout(() => failWorld(new Error(`the world's kit did not load in ${KIT_WAIT} ms`), worldLevel), KIT_WAIT);
    return () => clearTimeout(timer);
  }, [kitDone, worldLevel, failWorld]);
  // A layer that neither loads nor fails (a request left hanging) must not hold the flag for good.
  useEffect(() => {
    if (plateReady) return;
    const timer = setTimeout(settlePlate, PLATE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [plateReady, settlePlate]);
  const visible = usePageVisible();
  // The pixels drawn per CSS pixel: the device's, up to the tier's cap, times the tier's render scale.
  const pixelRatio = Math.max(1, Math.min(window.devicePixelRatio, quality.settings.dpr)) * quality.settings.renderScale;
  const segments = quality.settings.segments;
  // A lower tier rebuilds the arms at its segment count, from the stage Nox is in. On the entrance
  // the blender holds the intro pose he swims into (the swim's own arm shapes and placement come
  // from the entrance, in Octopus), so when it ends he is already there.
  // A technology focus keeps the stage it came from (the intro or the overview) for pose, framing and words.
  const shown: StageId = state.stage === 'techFocus' ? state.returnTo : state.stage;
  const blender = useMemo(() => new PoseBlender(stagePose(state.stage === 'entering' ? 'intro' : shown), segments), [segments]);
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
    blender.start(stagePose(shown), performance.now(), duration, stagger, reducedMotion || skipped || !beat ? 0 : beat.delay);
    if (!opening && (reducedMotion || skipped)) frame.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }, [blender, state.stage, shown, reducedMotion, dispatch]);
  // Any click or key skips the entrance.
  const entering = state.stage === 'entering';
  useEffect(() => {
    if (!entering) return;
    const skip = (event: Event) => {
      if (event instanceof KeyboardEvent && MODIFIER_KEYS.has(event.key)) return;
      dispatch({ type: 'SKIP' });
    };
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [entering, dispatch]);
  // Escape steps back: a focused technology lets go, detail goes to the overview, the overview to
  // the intro. With a technology in focus, a press anywhere but an orb or its tooltip lets go too.
  const focusing = state.stage === 'techFocus';
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dispatch({ type: focusing ? 'BLUR_TECH' : 'CLOSE' });
    };
    const onPress = (event: PointerEvent) => {
      if (focusing && !(event.target as Element | null)?.closest?.('.orb-button, .tech-tooltip, .orb-tray-item')) dispatch({ type: 'BLUR_TECH' });
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPress);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPress);
    };
  }, [dispatch, focusing]);
  const focusedTech = focusing ? state.techId : null;
  // The bubble's orbit eases to still in about 0.4 s once it is hot, and the suction hold pulls it
  // to its arm's tip, so the tooltip takes its place when it has arrived there (at once with motion
  // off): the bubble's place and the others', and the face's; it then keeps beside it as it lifts.
  const SETTLE_MS = HOLD_BEATS.pullMs[1];
  const settle = reducedMotion || url.freeze ? 0 : SETTLE_MS;
  // The tooltip shown, and the one before it fading out, each where it was placed.
  const [tips, setTips] = useState<{ techId: string; orb: Disc; others: Disc[]; face: ReturnType<typeof faceSpot>; leaving: boolean }[]>([]);
  useEffect(() => {
    const here = focusedTech ? ORBS.findIndex(o => o.techId === focusedTech) : -1;
    const place = () => {
      if (!focusedTech) return null;
      // A technology with no orb (the tray's) is described beside the tray's button, as a sheet: it stands in for the orb just under Nox's face.
      if (here < 0) {
        if (!trayAll) return null;
        const f = faceSpot('overview');
        const bottom = (f as { bounds?: { bottom: number } }).bounds?.bottom ?? f.y;
        return { techId: focusedTech, orb: { x: f.x, y: bottom + 30, size: 44 } as Disc, others: [] as Disc[], face: f, leaving: false };
      }
      return {
        techId: focusedTech,
        orb: bubbleDisc(here, shown === 'intro' ? 'intro' : 'overview'),
        others: ORBS.flatMap((_, i) => (i === here ? [] : [bubbleDisc(i)])),
        face: faceSpot(shown === 'intro' ? 'intro' : 'overview'),
        leaving: false,
      };
    };
    const timer = window.setTimeout(() => {
      const tip = place();
      setTips(list => [...list.filter(t => t.techId !== focusedTech).map(t => ({ ...t, leaving: true })), ...(tip ? [tip] : [])]);
    }, settle);
    // Letting go (or moving on) starts the old tooltip fading out at once.
    setTips(list => list.some(t => t.techId !== focusedTech && !t.leaving) ? list.map(t => (t.techId === focusedTech ? t : { ...t, leaving: true })) : list);
    const gone = window.setTimeout(() => setTips(list => list.filter(tip => !tip.leaving)), 240 + settle);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(gone);
    };
  }, [focusedTech, settle, shown, viewport, trayAll]);
  const octopus = (
    <Octopus
      config={config}
      blender={blender}
      stage={state.stage}
      expression={url.expression}
      freeze={url.freeze}
      reducedMotion={reducedMotion}
      silhouette={MASK}
      quality={quality.settings}
      // Clicking the head swells it open; clicking it again closes it.
      onSelect={() => dispatch({ type: state.stage === 'overview' ? 'CLOSE' : 'OPEN_OVERVIEW' })}
      headOpen={stagePose(shown).headMorph >= 0.5}
      swellSheet={SWELL_SHEET}
      orbs={ORBS}
      focusTechId={focusedTech}
      blowSheet={BLOW_SHEET}
      accents={accents}
      solo={url.solo}
      yaw={url.yaw}
      armDrive={REVIEW_SWIM?.drive}
      holdAt={HOLD_STILL}
      entranceSheet={ENTRANCE_SHEET}
      entranceSeconds={ENTRANCE_STILL_SECONDS}
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
      {WEBGL && <Canvas
        flat
        dpr={pixelRatio}
        frameloop={visible ? 'always' : 'never'}
        // The world's surface light casts shadows, and its sky sphere reaches 100 units.
        shadows="percentage"
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, CAMERA_Z], fov: 24, near: 0.1, far: 140 }}
      >
        <color attach="background" args={[MASK ? '#000000' : SECURITY_WORLD.palette.waterFar]} />
        <StageCamera stage={shown} reducedMotion={reducedMotion} />
        {quality.adaptive && <QualityProbe tier={quality.tier} onLower={quality.step} />}
        {MASK ? (
          <>
            <SilhouetteOnly />
            {octopus}
          </>
        ) : (
          <>
            {/* Nothing here waits on a file: the world's kit has a Suspense of its own, so Nox and the
                water are drawn whatever the network does. */}
            <WorldScene world={SECURITY_WORLD} level={worldLevel} onFail={failWorld} onKitSettled={setKitLevel} time={url} tier={worldTier} onPlateSettled={settlePlate} accents={accents} solo={url.solo} reducedMotion={reducedMotion} />
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
      {!WEBGL && <Poster />}
      {!MASK && !url.view && (
        <>
          <SkipLink onSkip={() => { dispatch({ type: 'SKIP' }); dispatch({ type: 'OPEN_OVERVIEW' }); dispatch({ type: 'OPEN_DETAIL' }); }} />
          {/* The intro's words come in as Nox settles at the end of the entrance (the skip control goes then). */}
          <IntroOverlay project={noxProject} hidden={shown !== 'intro' && !(entering && settling)} onExplore={() => dispatch({ type: 'OPEN_OVERVIEW' })} />
          <SkipEntrance hidden={!entering || settling} onSkip={() => dispatch({ type: 'SKIP' })} />
          <OverviewPanel project={noxProject} open={state.stage === 'overview'} sheet={phone || !WEBGL} dispatch={dispatch} />
          <ProjectDetail project={DETAIL_PROJECT} technologies={noxTechnologies} open={state.stage === 'detail'} showPlaceholders={SHOW_PLACEHOLDERS} forceSheet={!WEBGL} dispatch={dispatch} />
          <OrbButtons
            orbs={ORBS}
            open={(shown === 'intro' || shown === 'overview') && WEBGL && !viewport.phonePortrait}
            focused={focusedTech}
            tooltipId={TOOLTIP_ID}
            onChoose={id => dispatch({ type: 'FOCUS_TECH', id })}
          />
          {tips.map(tip => {
            const technology = TECH.get(tip.techId);
            if (!technology) return null;
            return (
              <TechTooltip
                key={tip.techId}
                id={TOOLTIP_ID}
                content={tooltipContent(technology, USAGE.get(tip.techId), SHOW_PLACEHOLDERS)}
                orb={tip.orb}
                face={tip.face}
                others={tip.others}
                follow={ORBS.findIndex(o => o.techId === tip.techId)}
                delayMs={Math.max(0, FOCUS_BEATS.tooltip - settle)}
                leaving={tip.leaving}
              />
            );
          })}
          <OrbTray
            items={(trayAll ? ORDER : OVERFLOW).map(trayItem)}
            open={state.stage === 'overview' || state.stage === 'techFocus'}
            all={trayAll}
            lifted={state.stage === 'overview' && (phone || !WEBGL)}
            focused={focusedTech}
            tooltipId={TOOLTIP_ID}
            onChoose={id => dispatch(id === focusedTech ? { type: 'BLUR_TECH' } : { type: 'FOCUS_TECH', id })}
          />
        </>
      )}
    </div>
  );
}
