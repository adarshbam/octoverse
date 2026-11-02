import { Component, type ReactNode, Suspense } from 'react';
import type { WorldLevel } from './worldLevel';

class Catch extends Component<{ level: WorldLevel; onError: (error: unknown, level: WorldLevel) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error, this.props.level);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Holds the part of the world that needs a file (the kit: near.glb or kit.glb), so that it can
 * neither take the stage down nor hide it. A file that will not load, or a kit that does not match
 * its layout, throws while it renders; `onFail` hears of it with the level it failed at, and the
 * world steps to the next poorer one: the kit without its baked light, then only the water, with
 * Nox in front of it. A file that never answers keeps this Suspense empty and nothing else: the
 * water and Nox are outside it, and the app's kit wait steps the level when it runs out. (A far
 * plate layer that fails is already left to the fog: FarCards.)
 */
export function KitBoundary({ level, onFail, children }: { level: WorldLevel; onFail: (error: unknown, level: WorldLevel) => void; children: ReactNode }) {
  // A key per level: the poorer world mounts fresh, with none of the failed one's state.
  return (
    <Catch key={level} level={level} onError={onFail}>
      <Suspense fallback={null}>{children}</Suspense>
    </Catch>
  );
}
