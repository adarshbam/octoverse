import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ArmChain } from '../character/armChain';
import { ARM_IDS } from '../config/types';
import { logoColour, logoTexture } from './logoTexture';
import { createOrbMaterial } from './orbMaterial';
import { ORB_Z, type OrbSlot, orbRestPosition } from './orbSlots';

export interface PlacedOrb {
  techId: string;
  iconKey: string;
  slot: OrbSlot;
}

/**
 * The technology orbs, each riding a point of the arm that carries it and gently bobbing; they
 * grow in as Nox's head opens (`open()`, 0..1). Lives in the space the arms are authored in.
 */
export function TechOrbs({ orbs, chains, open }: { orbs: readonly PlacedOrb[]; chains: readonly ArmChain[]; open: () => number }) {
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
        // Brighter than the plain logo, so the bloom catches it and it glows as in the painting.
        logo: new THREE.MeshBasicMaterial({ map: logoTexture(orb.iconKey), color: new THREE.Color(1.35, 1.35, 1.35), transparent: true, depthWrite: false }),
      })),
    };
  }, [orbs, chains]);

  useEffect(() => () => {
    parts.sphere.dispose();
    parts.plane.dispose();
    for (const item of parts.items) {
      item.glass.dispose();
      item.logo.dispose();
    }
  }, [parts]);

  useFrame(state => {
    const shown = THREE.MathUtils.clamp(open(), 0, 1);
    const t = state.clock.elapsedTime;
    group.current!.visible = shown > 0.001;
    parts.items.forEach((item, i) => {
      const node = group.current!.children[i];
      const { x, y } = orbRestPosition(item.chain, item.orb.slot);
      node.position.set(x, y + 0.025 * Math.sin(t * 0.9 + i * 1.7), ORB_Z);
      node.scale.setScalar(item.orb.slot.radius * (0.4 + 0.6 * shown));
      item.glass.uniforms.uOpacity.value = shown;
      item.logo.opacity = shown;
    });
  });

  return (
    <group ref={group} visible={false}>
      {parts.items.map(item => (
        <group key={item.orb.techId}>
          <mesh geometry={parts.sphere} material={item.glass} renderOrder={2} />
          <mesh geometry={parts.plane} material={item.logo} scale={1.8} position={[0, 0, 0.02]} renderOrder={3} />
        </group>
      ))}
    </group>
  );
}
