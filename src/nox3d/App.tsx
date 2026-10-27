import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing';
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ENTRANCE_TURN } from './behavior/entrance';
import { FOCUS_BEATS, focusReaction } from './behavior/focusChoreography';
import { PoseBlender, STAGE_TRANSITION } from './behavior/poseBlend';
import { parseUrlState } from './behavior/urlState';
import { useStage } from './behavior/useStage';
import { Octopus } from './character/Octopus';
import { createGlowLightUniforms } from './character/glowLight';
import { type AccentLink, createAccentUniforms } from './character/worldAccent';
import { NOX } from './config/nox.character';
import { withPaletteCandidate } from './config/nox.palette-candidate';
import { CAMERA_Z, STAGE_HALF, viewWindow } from './config/stage';
import type { StageId } from './config/types';
import { clampCharacterConfig } from './config/validate';
import { noxProject } from './content/noxProject';
import { NOX_POSES } from './poses/nox.poses';
import { POST } from './post';
import { STAGE_FRAMES, fovFor } from './stage/framing';
import { QualityProbe, usePageVisible, useQuality } from './stage/useQuality';
import { IntroOverlay } from './ui/IntroOverlay';
import { OverviewPanel } from './ui/OverviewPanel';
import { ProjectDetail } from './ui/ProjectDetail';
import { SkipEntrance } from './ui/SkipEntrance';
import { OrbButtons, faceSpot, orbSpots } from './ui/OrbButtons';
import { TechTooltip } from './ui/TechTooltip';
import { tooltipContent } from './ui/tooltipContent';
import { OrbTray } from './ui/OrbTray';
import { NOX_OVERVIEW_SLOTS, assignOrbs } from './artifacts/orbSlots';
import { noxTechnologies } from './content/noxTechnologies';
import { layoutFor } from './stage/framing';

import { Backdrop } from './world/Backdrop';
import { ContactShadows } from './world/ContactShadows';
import { Bubbles, Embers } from './world/Particles';
import { SECURITY_WORLD } from './world/security/config';
import { WorldScene } from './world/WorldScene';

const url = parseUrlState(location.search);
// The project's technologies in its order, each riding an orb slot; the rest go to the tray.
const ORDER = noxProject.primaryTechnologyIds ?? [];
const TECH = new Map(noxTechnologies.map(t => [t.id, t]));
const USAGE = new Map((noxProject.technologyUsages ?? []).map(u => [u.technologyId, u]));
const ASSIGNED = assignOrbs(ORDER, NOX_OVERVIEW_SLOTS);
const ORBS = ASSIGNED.placed.map(({ techId, slot }) => ({
  techId,
  slot,
  iconKey: TECH.get(techId)?.iconKey ?? techId,
  name: TECH.get(techId)?.name ?? techId,
  reaction: focusReaction(USAGE.get(techId)),
}));
/** Storyboard or missing text shows, badged, only while developing; never in the public build. */
const SHOW_PLACEHOLDERS = import.meta.env.DEV;
// On a phone held upright the orbs are too small to pick out, so the tray lists every technology.
const PHONE_PORTRAIT = layoutFor({ width: window.innerWidth, height: window.innerHeight }) === 'phone' && window.innerHeight > window.innerWidth;
const TOOLTIP_ID = 'tech-tooltip';
const trayItem = (techId: string) => ({ techId, name: TECH.get(techId)?.name ?? techId, iconKey: TECH.get(techId)?.iconKey ?? techId });
const MASK = new URLSearchParams(location.search).has('mask');
/** Keys that skip the entrance: any but a bare modifier. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta']);
// A project with no sections, for testing the full project view; honoured only while developing.
const DETAIL_PROJECT = import.meta.env.DEV && url.fixture === 'nosections' ? { ...noxProject, sections: [] } : noxProject;
// The proposed palette in place of the approved one, for the owner's A/B review; honoured only while developing.
const CHARACTER = import.meta.env.DEV && url.palette === 'candidate' ? withPaletteCandidate(NOX) : NOX;

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
  useFrame((_, delta) => {
    if (!framed || Math.abs(camera.fov - target) < 1e-4) return;
    // Eased at the pace of the pose blend, so the view settles with Nox.
    camera.fov = reducedMotion ? target : camera.fov + (target - camera.fov) * (1 - Math.exp(-Math.min(delta, 0.05) * 2.4));
    camera.updateProjectionMatrix();
  });
  useLayoutEffect(() => {
    const aspect = size.width / size.height;
    camera.clearViewOffset();
    if (url.view && !url.orbit) {
      // A zoom is a window onto the unmoved stage camera, so arms in front of or behind the
      // traced plane line up exactly as they do on the stage.
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
  const config = useMemo(() => clampCharacterConfig(CHARACTER), []);
  const { state, dispatch, reducedMotion } = useStage(noxProject);
  const quality = useQuality(url);
  const visible = usePageVisible();
  const segments = quality.settings.segments;
  // A lower tier rebuilds the arms at its segment count, from the stage Nox is in. On the entrance
  // they are laid out (cup sides and spacing) as in the intro they swim into, as on a reload.
  const blender = useMemo(() => new PoseBlender(NOX_POSES[state.stage], segments, state.stage === 'entering' ? NOX_POSES.intro : undefined), [segments]);
  // In a world, the world lights Nox's skin through these capped accents, from the lights nearest him.
  const accents = useMemo<AccentLink | undefined>(() => (url.world ? { uniforms: createAccentUniforms(), at: new THREE.Vector3(), light: createGlowLightUniforms() } : undefined), []);
  const frame = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const prevStage = useRef(state.stage);
  // The entrance's clock: when its first frame drew (Octopus), and whether it ran its course.
  const entrance = useRef({ startMs: null as number | null, finished: false });
  // As Nox slows, its arms gather into the intro pose, on the entrance's clock.
  const turnIntoIntro = useCallback(() => {
    const { startMs } = entrance.current;
    if (startMs === null) return;
    const now = performance.now();
    blender.start(NOX_POSES.intro, now, ENTRANCE_TURN.durationMs, ENTRANCE_TURN.staggerMs, startMs + ENTRANCE_TURN.delayMs - now);
  }, [blender]);
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
      // Reduced motion has no swim (the preference can change while it plays). Otherwise a
      // blender rebuilt part-way (a lower tier) picks up the turn where it was.
      if (reducedMotion) dispatch({ type: 'SKIP' });
      else turnIntoIntro();
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
    blender.start(NOX_POSES[state.stage], performance.now(), duration, stagger, reducedMotion || skipped || !beat ? 0 : beat.delay);
    if (!opening && (reducedMotion || skipped)) frame.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }, [blender, state.stage, reducedMotion, dispatch, turnIntoIntro]);
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
      if (focusing && !(event.target as Element | null)?.closest?.('.orb-button, .tech-tooltip')) dispatch({ type: 'BLUR_TECH' });
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPress);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPress);
    };
  }, [dispatch, focusing]);
  const focusedTech = focusing ? state.techId : null;
  const presented = useMemo(() => {
    const i = ORBS.findIndex(o => o.techId === focusedTech);
    return i >= 0 ? orbSpots(ORBS, true)[i] : null;
  }, [focusedTech]);
  // The other orbs, where they rest, so the tooltip finds a place clear of them.
  const others = useMemo(() => orbSpots(ORBS).filter((_, i) => ORBS[i].techId !== focusedTech), [focusedTech]);
  const face = useMemo(() => (focusedTech ? faceSpot() : { x: 0, y: 0 }), [focusedTech]);
  // The tooltip shown, and the one before it fading out, each where it was placed.
  const [tips, setTips] = useState<{ techId: string; orb: typeof presented; leaving: boolean }[]>([]);
  useEffect(() => {
    setTips(list => [
      ...list.filter(tip => tip.techId !== focusedTech).map(tip => ({ ...tip, leaving: true })),
      ...(focusedTech ? [{ techId: focusedTech, orb: presented, leaving: false }] : []),
    ]);
    const timer = window.setTimeout(() => setTips(list => list.filter(tip => !tip.leaving)), 240);
    return () => window.clearTimeout(timer);
  }, [focusedTech, presented]);
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
      onSelect={() => dispatch({ type: 'OPEN_OVERVIEW' })}
      orbs={ORBS}
      focusTechId={focusedTech}
      accents={accents}
      solo={url.solo}
      onEntranceStart={startMs => {
        entrance.current.startMs = startMs;
        turnIntoIntro();
      }}
      onEntranceDone={() => {
        entrance.current.finished = true;
        dispatch({ type: 'ENTRANCE_DONE' });
      }}
    />
  );
  return (
    <div className="spike" ref={frame}>
      <Canvas
        flat
        dpr={[1, quality.settings.dpr]}
        frameloop={visible ? 'always' : 'never'}
        // The world's surface light casts shadows, and its sky sphere reaches 100 units.
        shadows={url.world ? 'percentage' : false}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, CAMERA_Z], fov: 24, near: 0.1, far: url.world ? 140 : 60 }}
      >
        <color attach="background" args={[MASK ? '#000000' : url.world ? SECURITY_WORLD.palette.waterFar : '#06040c']} />
        <StageCamera stage={state.stage} reducedMotion={reducedMotion} />
        {quality.adaptive && <QualityProbe tier={quality.tier} onLower={quality.step} />}
        {MASK ? (
          <>
            <SilhouetteOnly />
            {octopus}
          </>
        ) : (
          <>
            {/* Nox comes in with the realm behind it, so on a first visit the swim starts with the
                plate (or the world's kit) in place rather than popping in behind it mid-swim. */}
            <Suspense fallback={null}>
              {url.world ? <WorldScene world={SECURITY_WORLD} time={url} density={quality.settings.particles} accents={accents} solo={url.solo} /> : <Backdrop />}
              {octopus}
            </Suspense>
            {!url.world && (
              <>
                <Bubbles density={quality.settings.particles} />
                <Embers density={quality.settings.particles} />
              </>
            )}
            {/* SMAA edges, not 4x multisampling: the same look at stage size for about 40% more frame rate. */}
            <EffectComposer multisampling={0}>
              {quality.settings.contactShadows ? <ContactShadows settings={POST.contactShadows} /> : <></>}
              <Bloom mipmapBlur {...POST.bloom} resolutionScale={0.5 * quality.settings.bloomScale} />
              <Vignette {...(url.world ? POST.worldVignette : POST.vignette)} />
              <SMAA />
            </EffectComposer>
          </>
        )}
      </Canvas>
      {!MASK && !url.view && (
        <>
          {/* The intro's words come in as Nox arrives: panel 1 has none. */}
          <IntroOverlay project={noxProject} hidden={state.stage !== 'intro'} onExplore={() => dispatch({ type: 'OPEN_OVERVIEW' })} />
          <SkipEntrance hidden={!entering} onSkip={() => dispatch({ type: 'SKIP' })} />
          <OverviewPanel project={noxProject} open={state.stage === 'overview'} dispatch={dispatch} />
          <ProjectDetail project={DETAIL_PROJECT} technologies={noxTechnologies} open={state.stage === 'detail'} showPlaceholders={SHOW_PLACEHOLDERS} dispatch={dispatch} />
          <OrbButtons
            orbs={ORBS}
            open={state.stage === 'overview' || focusing}
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
                face={face}
                others={others}
                delayMs={FOCUS_BEATS.tooltip}
                leaving={tip.leaving}
              />
            );
          })}
          <OrbTray
            items={(PHONE_PORTRAIT ? ORDER : ASSIGNED.overflow).map(trayItem)}
            open={state.stage === 'overview' || state.stage === 'techFocus'}
            onChoose={id => dispatch({ type: 'FOCUS_TECH', id })}
          />
        </>
      )}
    </div>
  );
}
