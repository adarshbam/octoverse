import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PoseBlender } from './behavior/poseBlend';
import { parseUrlState } from './behavior/urlState';
import { useStage } from './behavior/useStage';
import { Octopus } from './character/Octopus';
import { NOX } from './config/nox.character';
import { CAMERA_Z, STAGE_HALF, viewWindow } from './config/stage';
import type { StageId } from './config/types';
import { clampCharacterConfig } from './config/validate';
import { noxProject } from './content/noxProject';
import { NOX_POSES } from './poses/nox.poses';
import { POST } from './post';
import { STAGE_FRAMES, fovFor } from './stage/framing';
import { QualityProbe, usePageVisible, useQuality } from './stage/useQuality';
import { IntroOverlay } from './ui/IntroOverlay';
import { Backdrop } from './world/Backdrop';
import { ContactShadows } from './world/ContactShadows';
import { Bubbles, Embers } from './world/Particles';

const url = parseUrlState(location.search);
const MASK = new URLSearchParams(location.search).has('mask');

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
    camera.fov = reducedMotion ? target : camera.fov + (target - camera.fov) * (1 - Math.exp(-Math.min(delta, 0.05) * 6));
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
  const config = useMemo(() => clampCharacterConfig(NOX), []);
  const { state, dispatch, reducedMotion } = useStage(noxProject);
  const quality = useQuality(url);
  const visible = usePageVisible();
  const segments = quality.settings.segments;
  // A lower tier rebuilds the arms at its segment count, from the stage Nox is in.
  const blender = useMemo(() => new PoseBlender(NOX_POSES[state.stage], segments), [segments]);
  const frame = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // Every stage change sets Nox moving toward the new pose; with reduced motion it lands at
  // once and the view crossfades instead.
  useEffect(() => {
    blender.start(NOX_POSES[state.stage], performance.now(), reducedMotion ? 0 : 700);
    if (first.current) first.current = false;
    else if (reducedMotion) frame.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }, [blender, state.stage, reducedMotion]);
  // The entrance is authored in Task 23; until then it ends at once.
  useEffect(() => {
    if (state.stage === 'entering') dispatch({ type: 'ENTRANCE_DONE' });
  }, [state.stage, dispatch]);
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
    />
  );
  return (
    <div className="spike" ref={frame}>
      <Canvas
        flat
        dpr={[1, quality.settings.dpr]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, CAMERA_Z], fov: 24, near: 0.1, far: 60 }}
      >
        <color attach="background" args={[MASK ? '#000000' : '#06040c']} />
        <StageCamera stage={state.stage} reducedMotion={reducedMotion} />
        {quality.adaptive && <QualityProbe tier={quality.tier} onLower={quality.step} />}
        {MASK ? (
          <>
            <SilhouetteOnly />
            {octopus}
          </>
        ) : (
          <>
            <Suspense fallback={null}>
              <Backdrop />
            </Suspense>
            {octopus}
            <Bubbles density={quality.settings.particles} />
            <Embers density={quality.settings.particles} />
            <EffectComposer multisampling={4}>
              {quality.settings.contactShadows ? <ContactShadows settings={POST.contactShadows} /> : <></>}
              <Bloom mipmapBlur {...POST.bloom} resolutionScale={0.5 * quality.settings.bloomScale} />
              <Vignette {...POST.vignette} />
            </EffectComposer>
          </>
        )}
      </Canvas>
      {!MASK && !url.view && <IntroOverlay project={noxProject} />}
    </div>
  );
}
