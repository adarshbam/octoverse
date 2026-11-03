import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { dropMips, farCardSize } from './farPlate';
import { holdKtx2Loader, ktx2Loader } from './kitLoader';
import type { WorldConfig } from './types';
import { useDisposables } from './useDisposables';

/**
 * The far plate's cards: the ruin beyond the near world as transparent cards at fixed depths,
 * rendered in Blender from the panel 2 camera (blender/security/render_far.py), farthest first.
 * (The plan names this file FarPlate.tsx; a Windows checkout cannot hold it beside farPlate.ts.)
 * The water between the pieces is empty in each, so the world's fog and sky show through and the
 * entrance swim never passes behind a card. Each card's fog is baked into its pixels, so it draws
 * with fog off.
 *
 * `scale` is the share of each layer's resolution kept: a layer is stored with its mip levels, and
 * a lower scale draws from a smaller one (a halving each; 0.75 rounds to the full size).
 *
 * `onSettled` is called once every layer has loaded or failed, with whether all of them loaded.
 *
 * The layers load on their own, outside Suspense: if one fails to load (a lost file, a GPU
 * without a compressed format) the world still draws, with that layer's range left to the fog.
 */
export function FarCards({ plate, scale = 1, onSettled }: { plate: NonNullable<WorldConfig['farPlate']>; scale?: number; onSettled?: (loaded: boolean) => void }) {
  const gl = useThree(state => state.gl);
  const drop = Math.max(0, Math.round(-Math.log2(scale)));
  const [maps, setMaps] = useState<readonly (THREE.Texture | null)[]>(() => plate.layers.map(() => null));
  useEffect(() => {
    const release = holdKtx2Loader(gl);
    let current = true;
    const loaded: THREE.Texture[] = [];
    // Every layer has either arrived or failed: the plate is as complete as it will get.
    let settled = 0;
    let failed = false;
    const settle = (ok: boolean) => {
      if (!ok) failed = true;
      if (current && ++settled === plate.layers.length) onSettled?.(!failed);
    };
    plate.layers.forEach((layer, i) => {
      ktx2Loader(gl)
        .loadAsync(layer.url)
        .then(texture => {
          if (!current) {
            texture.dispose();
            return;
          }
          dropMips(texture, drop);
          loaded.push(texture);
          setMaps(old => old.map((m, k) => (k === i ? texture : m)));
          settle(true);
        })
        .catch((error: unknown) => {
          console.warn(`far plate layer ${layer.url} did not load:`, error);
          settle(false);
        });
    });
    return () => {
      current = false;
      // The cards must stop drawing what is about to be disposed: a disposed texture that is still
      // drawn is uploaded to the GPU again, and nothing would dispose that copy.
      setMaps(old => (old.every(m => m === null) ? old : old.map(() => null)));
      loaded.forEach(texture => texture.dispose());
      release();
    };
  }, [gl, plate, drop, onSettled]);

  const cards = useMemo(() => {
    const geometries = plate.layers.map(layer => {
      const { width, height } = farCardSize(layer.z);
      return new THREE.PlaneGeometry(width, height);
    });
    return geometries;
  }, [plate]);
  useDisposables(cards);

  const materials = useMemo(
    () =>
      maps.map(map => {
        if (!map) return null;
        const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false, toneMapped: false });
        return material;
      }),
    [maps],
  );
  useDisposables(useMemo(() => materials.filter((m): m is THREE.MeshBasicMaterial => m !== null), [materials]));

  return (
    <group>
      {plate.layers.map((layer, i) => {
        const material = materials[i];
        return material ? <mesh key={layer.url} geometry={cards[i]} material={material} position={[0, 0, layer.z]} renderOrder={-10 + i} frustumCulled={false} /> : null;
      })}
    </group>
  );
}
