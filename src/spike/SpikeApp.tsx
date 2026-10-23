import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Suspense, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { Nox } from './nox/Nox';
import { Backdrop } from './world/Backdrop';
import { Bubbles, Embers } from './world/Particles';

const CAMERA_Z = 12;
/** World units from stage centre to the top edge (panel 2 is 504 px = 5.04 units tall). */
const STAGE_HALF = 2.52;

function StageCamera() {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera;
  const size = useThree(s => s.size);
  useLayoutEffect(() => {
    // The square stage always fits; portrait windows widen the vertical view instead of cropping arms.
    const portrait = Math.max(1, size.height / size.width);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((STAGE_HALF * portrait) / CAMERA_Z));
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/** `?mask` draws Nox as a flat white silhouette on black, used to mask the reference for plate painting. */
const MASK = new URLSearchParams(location.search).has('mask');

function SilhouetteOnly() {
  const scene = useThree(s => s.scene);
  useLayoutEffect(() => {
    scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 'white' });
    return () => { scene.overrideMaterial = null; };
  }, [scene]);
  return null;
}

function Flame() {
  return (
    <svg viewBox="0 0 40 46" aria-hidden="true">
      <defs>
        <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a5a" />
          <stop offset="1" stopColor="#ff2440" />
        </linearGradient>
      </defs>
      <path
        fill="url(#flame)"
        d="M20 2c2 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 5-12 0 4 2 7 4 8-1-8 1-14 3-20Zm0 26c-3 3-5 5-5 8a5 5 0 0 0 10 0c0-3-2-5-5-8Z"
      />
    </svg>
  );
}

export function SpikeApp() {
  return (
    <div className="spike">
      <Canvas flat dpr={[1, 2]} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ position: [0, 0, CAMERA_Z], fov: 24, near: 0.1, far: 60 }}>
        <color attach="background" args={[MASK ? '#000000' : '#06040c']} />
        <StageCamera />
        {MASK ? (
          <>
            <SilhouetteOnly />
            <Nox />
          </>
        ) : (
          <>
            <fog attach="fog" args={['#140c28', 13, 22]} />
            <Suspense fallback={null}>
              <Backdrop />
            </Suspense>
            <Nox />
            <Bubbles />
            <Embers />
            <EffectComposer multisampling={4}>
              <Bloom mipmapBlur luminanceThreshold={0.66} luminanceSmoothing={0.25} intensity={1.05} radius={0.85} />
              <Vignette offset={0.22} darkness={0.72} />
            </EffectComposer>
          </>
        )}
      </Canvas>
      <div className="stage" hidden={MASK}>
        <p className="kicker">OCTOVERSE</p>
        <h1 className="title">
          <Flame />
          <span>
            Security <span className="lab">Lab</span>
          </span>
        </h1>
        <p className="tag">Learning. Breaking. Securing.</p>
        <p className="desc">
          A hands-on web security lab where I learn, break and
          <br />
          fix real world vulnerabilities.
        </p>
        <div className="nameplate">
          <b>Nox</b>
          <span>The Watcher</span>
        </div>
      </div>
    </div>
  );
}
