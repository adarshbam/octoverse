// Colour calibration: four known sRGB swatches through the same post chain as the spike.
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';

const SWATCHES = ['#808080', '#fb5254', '#45133e', '#0a0d2c'];
const mode = new URLSearchParams(location.search).get('mode') ?? 'full';

function Swatches() {
  return (
    <>
      {SWATCHES.map((hex, i) => (
        <mesh key={hex} position={[-1.5 + i, 0, 0]}>
          <planeGeometry args={[1, 2]} />
          <shaderMaterial
            uniforms={{ uColor: { value: new THREE.Color(hex) } }}
            vertexShader="void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
            fragmentShader="uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }"
          />
        </mesh>
      ))}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <Canvas flat orthographic camera={{ zoom: 100, position: [0, 0, 5] }} style={{ width: 400, height: 200 }}>
    <Swatches />
    {mode !== 'raw' && (
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.62} luminanceSmoothing={0.25} intensity={mode === 'nobloom' || mode === 'notone' ? 0 : 1.1} radius={0.75} />
        {mode !== 'notone' ? <ToneMapping mode={ToneMappingMode.NEUTRAL} /> : <></>}
        <Vignette offset={0.25} darkness={mode === 'full' ? 0.75 : 0} />
      </EffectComposer>
    )}
  </Canvas>,
);
