import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { type AccentLink, pickAccentLights, writeAccentLights } from '../character/worldAccent';
import { stoneLights } from './bakedLight';
import { Floor } from './Floor';
import { Kit } from './Kit';
import { useWorldKit } from './kitLoader';
import { Motes } from './Motes';
import { Bubbles, Embers } from './Particles';
import { SurfaceLight, WaterEnvironment, useSurfaceLight } from './SurfaceLight';
import type { WorldConfig } from './types';
import { FarFish, GodRays, MarineSnow, WaterSky } from './Water';
import { WorldTimeProvider, type WorldTimeFlags } from './worldTime';

/**
 * A world mounted from its config: the kit's pieces, the seabed, the water (fog, sky, light
 * shafts, snow, fish), the surface light with its caustics, and the light of the glyphs and lava:
 * baked into the near world's lightmaps when it has near.glb, else real lights with a fill.
 * `time` says whether the world's clock runs or holds one moment. `density` thins the bubbles and
 * embers on lower quality tiers. `accents` links Nox's skin: the world lights him only through
 * these capped accents, and its particles take his face glow's light through it. `solo`, for
 * measurement captures only, leaves out the bubbles. The scene around it needs shadows on and a far
 * plane past the sky sphere (100 units).
 */
export function WorldScene({ world, time, density = 1, accents, solo = false }: { world: WorldConfig; time: WorldTimeFlags; density?: number; accents?: AccentLink; solo?: boolean }) {
  const surface = useSurfaceLight(world);
  const kit = useWorldKit(world);
  useNoxAccents(world, surface, accents);
  const { live, palette, water } = world;
  const { fill } = stoneLights(world);
  return (
    <WorldTimeProvider value={time}>
      <fogExp2 attach="fog" args={[palette.waterFar, water.fogDensity]} />
      <WaterEnvironment world={world} />
      <SurfaceLight {...surface} />
      {fill && <directionalLight color={fill.color} intensity={fill.intensity} position={[...fill.position]} />}
      <WaterSky world={world} caustics={surface.caustics.texture} />
      <Floor world={world} baked={kit.baked} />
      <Kit world={world} kit={kit} />
      <GodRays amount={live.rays} />
      <MarineSnow amount={live.snow} glow={accents?.light} />
      <FarFish amount={live.fish} />
      <Motes amount={live.motes} glow={accents?.light} />
      {!solo && <Bubbles density={live.bubbles * density} glow={accents?.light} />}
      <Embers density={live.embers * density} glow={accents?.light} />
    </WorldTimeProvider>
  );
}

/**
 * How Nox's skin takes the world's light: warm and pink, through the flesh (the test scene's
 * balance at 0.2 of its strength). Task 5: four times Task 3's start, so the warmth reads on the
 * arms' undersides (panel 2's red band); the cap bounds the brightest patches, and the light still
 * falls off from the lava corners.
 */
const SKIN_WARMTH = new THREE.Color(0.052, 0.0252, 0.06);
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
