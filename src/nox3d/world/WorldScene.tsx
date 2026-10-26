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
 * embers on lower quality tiers. The scene around it needs shadows on and a far plane past the
 * sky sphere (100 units).
 */
export function WorldScene({ world, time, density = 1 }: { world: WorldConfig; time: WorldTimeFlags; density?: number }) {
  const surface = useSurfaceLight(world);
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
