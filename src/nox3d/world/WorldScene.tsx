import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { type AccentLink, pickAccentLights, writeAccentLights } from '../character/worldAccent';
import { Floor } from './Floor';
import { Kit } from './Kit';
import { Motes } from './Motes';
import { Bubbles, Embers } from './Particles';
import { SurfaceLight, WaterEnvironment, useSurfaceLight } from './SurfaceLight';
import type { WorldConfig } from './types';
import { FarFish, GodRays, MarineSnow, WaterSky } from './Water';
import { WorldTimeProvider, type WorldTimeFlags } from './worldTime';

/**
 * A world mounted from its config: the kit's pieces, the seabed, the water (fog, sky, light
 * shafts, snow, fish), the surface light with its caustics, and the lights of the glyphs and lava.
 * `time` says whether the world's clock runs or holds one moment. `density` thins the bubbles and
 * embers on lower quality tiers. `accents` links Nox's skin: the world lights him only through
 * these capped accents. The scene around it needs shadows on and a far plane past the sky sphere (100 units).
 */
export function WorldScene({ world, time, density = 1, accents }: { world: WorldConfig; time: WorldTimeFlags; density?: number; accents?: AccentLink }) {
  const surface = useSurfaceLight(world);
  useNoxAccents(world, surface, accents);
  const { live, palette, water, lights } = world;
  return (
    <WorldTimeProvider value={time}>
      <fogExp2 attach="fog" args={[palette.waterFar, water.fogDensity]} />
      <WaterEnvironment world={world} />
      <SurfaceLight {...surface} />
      <directionalLight color={lights.fill.color} intensity={lights.fill.intensity} position={[...lights.fill.position]} />
      <WaterSky world={world} caustics={surface.caustics.texture} />
      <Floor world={world} />
      <Kit world={world} />
      <GodRays amount={live.rays} />
      <MarineSnow amount={live.snow} />
      <FarFish amount={live.fish} />
      <Motes amount={live.motes} />
      <Bubbles density={live.bubbles * density} />
      <Embers density={live.embers * density} />
    </WorldTimeProvider>
  );
}

/**
 * How Nox's skin takes the world's light: warm and pink, through the flesh (the test scene's
 * balance at 0.05 of its strength, so the cap bounds only the brightest patches).
 */
const SKIN_WARMTH = new THREE.Color(0.013, 0.0063, 0.015);
/** The caustics' share of the surface light on Nox's skin: the bright lines reach their cap, the gaps stay well under it. */
const CAUSTIC_STRENGTH = 0.005;

/**
 * Feeds the world's light to Nox's skin as accents: the world lights nearest his face glow each
 * frame, the surface light's caustics, and the water's colour for far haze (its density stays 0,
 * so it is off). On unmount the skin goes back to no accents.
 */
function useNoxAccents(world: WorldConfig, { spot, caustics }: ReturnType<typeof useSurfaceLight>, accents: AccentLink | undefined) {
  useEffect(() => {
    if (!accents) return;
    const u = accents.uniforms;
    const { surface } = world.lights;
    u.uAccentWarmth.value.copy(SKIN_WARMTH);
    u.uCausticMap.value = caustics.texture;
    // Three keeps the shadow matrix up to date: it projects the light's cookie, as for the stone.
    u.uCausticMatrix.value = spot.shadow.matrix;
    u.uSurfaceDir.value.set(...surface.position).sub(new THREE.Vector3(...surface.target)).normalize();
    u.uCausticLight.value.set(surface.color).multiplyScalar(CAUSTIC_STRENGTH);
    u.uFarHazeColor.value.set(world.palette.waterFar);
    return () => {
      u.uAccentWarmth.value.setScalar(0);
      u.uCausticMap.value = null;
      u.uCausticMatrix.value = new THREE.Matrix4();
      u.uCausticLight.value.setScalar(0);
      writeAccentLights(u, []);
    };
  }, [world, spot, caustics, accents]);
  useFrame(() => {
    if (!accents) return;
    const { at } = accents;
    writeAccentLights(accents.uniforms, pickAccentLights(world.lights.points, [at.x, at.y, at.z]));
  });
}
