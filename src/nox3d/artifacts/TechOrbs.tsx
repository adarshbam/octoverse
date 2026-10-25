import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ArmChain } from '../character/armChain';
import { ARM_IDS } from '../config/types';
import { logoColour, logoTexture } from './logoTexture';
import { createOrbHaloMaterial, createOrbMaterial, ORB_HALO_SCALE } from './orbMaterial';
import { ORB_Z, type OrbSlot, orbRestPosition } from './orbSlots';

export interface PlacedOrb {
  techId: string;
  iconKey: string;
  slot: OrbSlot;
}

/** How far a focused orb rises (world units) and grows as it is presented. */
export const FOCUS_RAISE = 0.35;
export const FOCUS_GROW = 1.35;

/**
 * What the orbs need from Nox each frame: how far they are out (0..1), how far each is in focus
 * (0..1, eased) with the point it rises to, and how hard each arm is reaching (0..1).
 */
export interface OrbState {
  out: number;
  focus: Float32Array;
  anchors: THREE.Vector2[];
  armReach: Float32Array;
}

/**
 * The technology orbs, each riding a point of the arm that carries it and gently bobbing; they
 * grow in as they come out (`state().out`, 0..1). A focused orb rises to its anchor, grows and
 * glows while the others dim; orbs on an arm that is reaching hold where they were, so the reach
 * never swings them round. Lives in the space the arms are authored in.
 */
export function TechOrbs({ orbs, chains, state }: { orbs: readonly PlacedOrb[]; chains: readonly ArmChain[]; state: () => OrbState }) {
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    const sphere = new THREE.SphereGeometry(1, 48, 32);
    const plane = new THREE.PlaneGeometry(1, 1);
    return {
      sphere,
      plane,
      items: orbs.map(orb => ({
        orb,
        chain: chains[ARM_IDS.indexOf(orb.slot.armId)],
        glass: createOrbMaterial(logoColour(orb.iconKey)),
        halo: createOrbHaloMaterial(logoColour(orb.iconKey)),
        // At its plain brightness, so the bloom does not haze the glass round it.
        logo: new THREE.MeshBasicMaterial({ map: logoTexture(orb.iconKey), color: new THREE.Color(1, 1, 1), transparent: true, depthWrite: false }),
      })),
    };
  }, [orbs, chains]);

  useEffect(() => () => {
    parts.sphere.dispose();
    parts.plane.dispose();
    for (const item of parts.items) {
      item.glass.dispose();
      item.halo.dispose();
      item.logo.dispose();
    }
  }, [parts]);

  // Where each orb last rode while its arm was not reaching.
  const held = useMemo(() => orbs.map(() => new THREE.Vector2(Number.NaN, 0)), [orbs]);

  useFrame(frame => {
    const s = state();
    const shown = THREE.MathUtils.clamp(s.out, 0, 1);
    const t = frame.clock.elapsedTime;
    group.current!.visible = shown > 0.001;
    const strongest = s.focus.reduce((a, b) => Math.max(a, b * b * (3 - 2 * b)), 0);
    parts.items.forEach((item, i) => {
      const node = group.current!.children[i];
      const arm = ARM_IDS.indexOf(item.orb.slot.armId);
      const riding = orbRestPosition(item.chain, item.orb.slot);
      const reach = s.armReach[arm];
      if (reach < 0.01 || Number.isNaN(held[i].x)) held[i].set(riding.x, riding.y);
      let x = THREE.MathUtils.lerp(riding.x, held[i].x, reach);
      let y = THREE.MathUtils.lerp(riding.y, held[i].y, reach);
      const f = s.focus[i] * s.focus[i] * (3 - 2 * s.focus[i]);
      x = THREE.MathUtils.lerp(x, s.anchors[i].x, f);
      y = THREE.MathUtils.lerp(y, s.anchors[i].y, f);
      node.position.set(x, y + 0.025 * Math.sin(t * 0.9 + i * 1.7), ORB_Z + 0.14 * f);
      node.scale.setScalar(item.orb.slot.radius * (0.4 + 0.6 * shown) * (1 + (FOCUS_GROW - 1) * f));
      // The focused orb glows; the others dim subtly to 75% while something is in focus.
      const dim = 1 - 0.25 * Math.max(0, strongest - f);
      item.glass.uniforms.uOpacity.value = shown * dim;
      item.halo.uniforms.uOpacity.value = shown * dim;
      item.halo.uniforms.uFocus.value = f;
      item.glass.uniforms.uFocus.value = f;
      item.logo.opacity = shown * dim;
    });
  });

  return (
    <group ref={group} visible={false}>
      {parts.items.map(item => (
        <group key={item.orb.techId}>
          <mesh geometry={parts.sphere} material={item.halo} scale={ORB_HALO_SCALE} renderOrder={1} />
          <mesh geometry={parts.sphere} material={item.glass} renderOrder={2} />
          <mesh geometry={parts.plane} material={item.logo} scale={2.1} position={[0, 0, 0.02]} renderOrder={3} />
        </group>
      ))}
    </group>
  );
}
