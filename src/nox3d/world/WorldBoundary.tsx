import { Component, type ReactNode, useEffect, useMemo } from 'react';
import type { WorldConfig } from './types';
import { LAST_LEVEL, type WorldLevel, worldAtLevel } from './worldLevel';
import { WorldScene } from './WorldScene';

class Catch extends Component<{ onError: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The world, which must never take the stage down with it. A file that will not load (near.glb,
 * kit.glb) or a kit that does not match its layout throws while the world renders; this steps to
 * the next poorer world instead: the kit without its baked light, then only the water's fog, with
 * Nox in front of it. (A far plate layer that fails is already left to the fog: FarCards.)
 */
export function WorldBoundary({ world, level, onFail, ...rest }: { world: WorldConfig; level: WorldLevel; onFail: (error: unknown) => void } & Omit<Parameters<typeof WorldScene>[0], 'world'>) {
  const shown = useMemo(() => worldAtLevel(world, level), [world, level]);
  if (level === LAST_LEVEL) return <FogOnly world={world} onSettled={rest.onPlateSettled} />;
  // A key per level: the poorer world mounts fresh, with none of the failed one's state.
  return (
    <Catch key={level} onError={onFail}>
      <WorldScene world={shown} {...rest} />
    </Catch>
  );
}

/** What is left when the kit cannot load: the water's fog over the background colour. */
function FogOnly({ world, onSettled }: { world: WorldConfig; onSettled?: () => void }) {
  useEffect(() => onSettled?.(), [onSettled]);
  return <fogExp2 attach="fog" args={[world.palette.waterFar, world.water.fogDensity]} />;
}


