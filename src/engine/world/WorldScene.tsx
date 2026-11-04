import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { type AccentLink, pickAccentLights, writeAccentLights } from '../character/worldAccent';
import { useInstance } from '../host/instanceContext';
import { setReliefGate, stoneLights } from './bakedLight';
import { FarCards } from './FarCards';
import { setWorldColour } from './colour';
import { Floor } from './Floor';
import { Strands } from './Kelp';
import { LIVE_ELEMENT_IDS } from './live';
import { Kit } from './Kit';
import { KitBoundary } from './WorldBoundary';
import { useWorldKit } from './kitLoader';
import { Motes } from './Motes';
import { WORLD_BUBBLES } from './bubbleField';
import { Bubbles, Embers } from './Particles';
import { SurfaceLight, WaterEnvironment, useSurfaceLight } from './SurfaceLight';
import type { WorldConfig } from './types';
import { FarFish, GodRays, MarineSnow, WaterSky } from './Water';
import { LAST_LEVEL, type WorldLevel, worldAtLevel } from './worldLevel';
import { WORLD_TIERS, type WorldTier, reliefShown, stoneCastsShadow } from './worldTiers';
import { MotionContext, WorldTimeProvider, type WorldTimeFlags, ambientTime } from './worldTime';

/**
 * A world mounted from its config: the kit's pieces, the seabed, the water (fog, sky, light
 * shafts, snow, fish), the surface light with its caustics, and the light of the glyphs and lava:
 * baked into the near world's lightmaps when it has near.glb, else real lights with a fill. A
 * world with a far plate draws the ruin beyond the near world as transparent cards.
 * Only the kit's part (the seabed's baked light, the stone) needs a file: it is a KitBoundary of its
 * own, drawn up to `level` (worldLevel.ts), so a file that fails or hangs leaves the water, the light
 * and Nox standing. `onFail` hears of a failure, `onKitSettled` of the kit's arrival (with its level).
 * `time` says whether the world's clock runs or holds one moment. `tier` is what the quality tier draws (worldTiers.ts): fewer bubbles, embers and light shafts, a smaller
 * shadow map cast by Nox alone, no fish or motes on the lower ones. `accents` links Nox's skin: the world lights him only through
 * these capped accents, and its particles take his face glow's light through it. `solo`, for
 * measurement captures only, leaves out the bubbles. `onPlateSettled` is called once the far plate's layers have loaded or failed (with whether all loaded). `reducedMotion` holds the world's own motion
 * (floor lava pulse, coral sway, ambient bubbles) still, as `time.freeze` does. The scene around it needs shadows on and a far
 * plane past the sky sphere (100 units).
 */
export function WorldScene({ world: configured, level, onFail, onKitSettled, time, tier = WORLD_TIERS.high, accents, solo = false, reducedMotion = false, onPlateSettled }: { world: WorldConfig; level: WorldLevel; onFail: (error: unknown, level: WorldLevel) => void; onKitSettled?: (level: WorldLevel) => void; time: WorldTimeFlags; tier?: WorldTier; accents?: AccentLink; solo?: boolean; reducedMotion?: boolean; onPlateSettled?: (loaded: boolean) => void }) {
  const world = useMemo(() => worldAtLevel(configured, level), [configured, level]);
  const surface = useSurfaceLight(world, tier.shadowMap);
  useNoxAccents(world, surface, accents);
  const { live, palette, water } = world;
  const { fill } = stoneLights(world);
  const motion = useMemo(() => ({ freeze: time.freeze, reducedMotion }), [time.freeze, reducedMotion]);
  // The ambient bubbles drift on the world's clock, and hold still with the rest of its motion.
  const bubbleTime = useMemo(() => (state: { clock: { elapsedTime: number } }) => ambientTime(state.clock.elapsedTime, time, reducedMotion), [time, reducedMotion]);
  // A world without a far plate has nothing to wait for.
  useEffect(() => {
    if (!world.farPlate) onPlateSettled?.(true);
  }, [world, onPlateSettled]);
  // The stone's and seabed's relief is a uniform branch in their shaders: no rebuild on a tier change.
  const relief = reliefShown(tier);
  const { reliefGate } = useInstance();
  useLayoutEffect(() => setReliefGate(reliefGate, relief), [reliefGate, relief]);
  return (
    <MotionContext.Provider value={motion}>
    <WorldTimeProvider value={time}>
      <fogExp2 attach="fog" args={[palette.waterFar, water.fogDensity]} />
      <WaterEnvironment world={world} />
      <SurfaceLight {...surface} />
      {fill && <directionalLight color={fill.color} intensity={fill.intensity} position={[...fill.position]} />}
      <WaterSky world={world} caustics={surface.caustics.texture} opening={world.glow.top} />
      {level < LAST_LEVEL && (
        <KitBoundary level={level} onFail={onFail}>
          <KitLayer world={world} level={level} tier={tier} onSettled={onKitSettled} />
        </KitBoundary>
      )}
      {world.farPlate && <FarCards plate={world.farPlate} scale={tier.plateScale} onSettled={onPlateSettled} />}
      <GodRays colours={water.colours} amount={live.rays * tier.rays} spread={world.glow.rays} />
      <MarineSnow colour={live.colours.snow} amount={live.snow} glow={accents?.light} reach={accents?.reach} />
      {tier.fish && <FarFish colour={water.colours.fish} amount={live.fish} />}
      {tier.motes && <Motes colours={live.colours.motes} amount={live.motes} glow={accents?.light} reach={accents?.reach} />}
      {!solo && <Bubbles colours={live.colours.bubbles} density={live.bubbles * tier.particles} glow={accents?.light} reach={accents?.reach} field={WORLD_BUBBLES} time={bubbleTime} />}
      {LIVE_ELEMENT_IDS.map(id => live.elements?.[id] && <Strands key={id} id={id} config={live.elements[id]} floorY={world.layout.floorY} amount={tier.particles} />)}
      <Embers colours={live.colours.embers} density={live.embers * tier.particles} glow={accents?.light} reach={accents?.reach} scale={world.glow.embers} />
    </WorldTimeProvider>
    </MotionContext.Provider>
  );
}

/** The part of the world that needs its file: the seabed (with the baked light, when there is any) and the stone. Suspends until the file has loaded. */
function KitLayer({ world, level, tier, onSettled }: { world: WorldConfig; level: WorldLevel; tier: WorldTier; onSettled?: (level: WorldLevel) => void }) {
  const kit = useWorldKit(world);
  const stone = useRef<THREE.Group>(null);
  useStoneShadows(stone, stoneCastsShadow(tier));
  // Mounted only once the file has loaded and built: the kit is in.
  useEffect(() => onSettled?.(level), [level, onSettled]);
  return (
    <>
      <Floor world={world} baked={kit.baked} />
      <group ref={stone}>
        <Kit world={world} kit={kit} />
      </group>
    </>
  );
}

/**
 * Feeds the world's light to Nox's skin as accents: the world lights nearest his face glow each
 * frame, its warmth (`skinAccent`), the surface light's caustics (`water.causticStrength`), and the far haze: the water's colour and its fog density,
 * so beyond HAZE_FROM (18 units, only ever reached in the entrance) he fades into the water as the
 * corridor does, from his own shading. On unmount the skin goes back to no accents.
 */
function useNoxAccents(world: WorldConfig, { spot, caustics }: ReturnType<typeof useSurfaceLight>, accents: AccentLink | undefined) {
  useEffect(() => {
    if (!accents) return;
    const u = accents.uniforms;
    const { surface } = world.lights;
    setWorldColour(u.uAccentWarmth.value, world.skinAccent);
    u.uCausticMap.value = caustics.texture;
    // Three keeps the shadow matrix up to date: it projects the light's cookie, as for the stone.
    u.uCausticMatrix.value = spot.shadow.matrix;
    u.uSurfaceDir.value.set(...surface.position).sub(new THREE.Vector3(...surface.target)).normalize();
    u.uCausticLight.value.set(surface.color).multiplyScalar(world.water.causticStrength);
    u.uFarHazeColor.value.set(world.palette.waterFar);
    u.uFarHaze.value = world.water.fogDensity;
    return () => {
      u.uAccentWarmth.value.setScalar(0);
      u.uCausticMap.value = null;
      u.uCausticMatrix.value = new THREE.Matrix4();
      u.uCausticLight.value.setScalar(0);
      u.uFarHaze.value = 0;
      writeAccentLights(u, []);
    };
  }, [world, spot, caustics, accents]);
  useFrame(() => {
    if (!accents) return;
    const { at } = accents;
    writeAccentLights(accents.uniforms, pickAccentLights(world.lights.points, [at.x, at.y, at.z]));
  });
}

/**
 * Lets the ruin's stone and iron cast into the surface light's shadow map or not. Off, only Nox
 * casts (the map is smaller too, on those tiers); each mesh's own setting is kept to put back.
 */
function useStoneShadows(group: React.RefObject<THREE.Group | null>, cast: boolean) {
  useLayoutEffect(() => {
    const root = group.current;
    if (!root || cast) return;
    const turnedOff: THREE.Object3D[] = [];
    root.traverse(child => {
      if (child.castShadow) {
        child.castShadow = false;
        turnedOff.push(child);
      }
    });
    return () => turnedOff.forEach(child => { child.castShadow = true; });
  }, [group, cast]);
}
