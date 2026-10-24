import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Suspense, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { parseUrlState } from './behavior/urlState';
import { Octopus } from './character/Octopus';
import { NOX } from './config/nox.character';
import { CAMERA_Z, STAGE_HALF, viewWindow } from './config/stage';
import { clampCharacterConfig } from './config/validate';
import { noxProject } from './content/noxProject';
import { NOX_POSES } from './poses/nox.poses';
import { POST } from './post';
import { IntroOverlay } from './ui/IntroOverlay';
import { Backdrop } from './world/Backdrop';
import { ContactShadows } from './world/ContactShadows';
import { Bubbles, Embers } from './world/Particles';

const url = parseUrlState(location.search);
const MASK = new URLSearchParams(location.search).has('mask');

/** Fits the square stage, or the `?view` box, and optionally adds an orbit camera. */
function StageCamera() {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera;
  const size = useThree(s => s.size);
  const gl = useThree(s => s.gl);
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
      // Portrait windows widen the vertical view instead of cropping arms.
      const portrait = Math.max(1, size.height / size.width);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((STAGE_HALF * portrait) / CAMERA_Z));
    }
    camera.updateProjectionMatrix();
    if (!url.orbit) return;
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(camera.position.x, camera.position.y, 0);
    controls.update();
    return () => controls.dispose();
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
  const stage = url.stage ?? 'intro';
  const pose = NOX_POSES[stage];
  const octopus = <Octopus config={config} pose={pose} expression={url.expression ?? pose.expression} freeze={url.freeze} silhouette={MASK} />;
  return (
    <div className="spike">
      <Canvas flat dpr={[1, 2]} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ position: [0, 0, CAMERA_Z], fov: 24, near: 0.1, far: 60 }}>
        <color attach="background" args={[MASK ? '#000000' : '#06040c']} />
        <StageCamera />
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
            <Bubbles />
            <Embers />
            <EffectComposer multisampling={4}>
              <ContactShadows settings={POST.contactShadows} />
              <Bloom mipmapBlur {...POST.bloom} />
              <Vignette {...POST.vignette} />
            </EffectComposer>
          </>
        )}
      </Canvas>
      {!MASK && !url.view && <IntroOverlay project={noxProject} />}
    </div>
  );
}
