import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isFarChain, isFarPlacement } from './farPlate';
import { useInstance } from '../host/instanceContext';
import { type BakeRecord, type BakedLight, type Relief, lightMapOf, reliefOf, stoneLights, withBakedLight } from './bakedLight';
import { glslColour } from './colour';
import { type WorldKit, bakedGeometry } from './kitLoader';
import { type KitMaterialInstance, kitMaterialFor, makeKitMaterial } from './kitMaterials';
import { fbm2, seeded } from './noise';
import { type PropBinding, driveProps } from './props';
import { DRESSED_GROUPS, applyPlacement, coralRest, withLod } from './placement';
import { floorHeight, seabedLightUv } from './seabed';
import { RUNE_SETS, glyphPanelLook, makeGlyphTexture, makeStoneMaps } from './textures';
import type { Placement, Vec3, WorldConfig } from './types';
import { useDisposables } from './useDisposables';
import { CORAL_SWAY_GLSL, useMotionAmount } from './liveMotion';
import { useWorldTime } from './worldTime';

/** Bends a straight chain (links up its local y) along a sagging curve, repeating it to length. */
function hangChain(link: THREE.BufferGeometry, unit: number, from: Vec3, to: Vec3, sag: number) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag * 2;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const length = curve.getLength();
  const copies = Math.max(1, Math.round(length / unit));
  const parts = Array.from({ length: copies }, (_, k) => link.clone().translate(0, k * unit, 0));
  const merged = mergeGeometries(parts)!;
  const total = copies * unit;
  // A frame along the curve: across it in the plane it hangs in, and that plane's normal.
  const span = b.clone().sub(a);
  let plane = new THREE.Vector3().crossVectors(span, new THREE.Vector3(0, -1, 0));
  if (plane.lengthSq() < 1e-6) plane = new THREE.Vector3(0, 0, 1);
  plane.normalize();
  const pos = merged.attributes.position as THREE.BufferAttribute;
  const nor = merged.attributes.normal as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const across = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = THREE.MathUtils.clamp(pos.getY(i) / total, 0, 1);
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    across.crossVectors(t, plane).normalize();
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    pos.setXYZ(i, p.x + across.x * lx + plane.x * lz, p.y + across.y * lx + plane.y * lz, p.z + across.z * lx + plane.z * lz);
    n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    const nx = n.x;
    const ny = n.y;
    const nz = n.z;
    nor.setXYZ(i, across.x * nx + t.x * ny + plane.x * nz, across.y * nx + t.y * ny + plane.y * nz, across.z * nx + t.z * ny + plane.z * nz);
  }
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Small stones strewn over the seabed, thicker toward the pillars. With `lightUv`, each stone reads
 * the seabed's lightmap where it lies (one uv1 per stone).
 */
function pebbleField(material: THREE.Material, floorY: number, lightUv: boolean) {
  const base = new THREE.IcosahedronGeometry(1, 2);
  const pos = base.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = 1 + (fbm2(v.x * 1.7 + 5, v.y * 1.7 + v.z * 1.3, 3, 2) - 0.5) * 0.7;
    v.multiplyScalar(r);
    if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.2;
    pos.setXYZ(i, v.x, v.y * 0.7, v.z);
  }
  base.computeVertexNormals();
  const COUNT = 420;
  const mesh = new THREE.InstancedMesh(base, material, COUNT);
  const rand = seeded(77);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const e = new THREE.Euler();
  const uv1 = new Float32Array(COUNT * 2);
  let placed = 0;
  for (let tries = 0; tries < COUNT * 6 && placed < COUNT; tries++) {
    const x = (rand() - 0.5) * 16;
    const z = 5 - rand() * 40;
    const side = THREE.MathUtils.smoothstep(Math.abs(x), 1.0, 3.6);
    if (rand() > 0.18 + side * 0.82) continue;
    const size = (0.04 + Math.pow(rand(), 2.4) * 0.26) * (0.6 + side * 0.8);
    e.set(rand() * 0.6, rand() * Math.PI * 2, rand() * 0.6);
    q.setFromEuler(e);
    s.set(size * (0.8 + rand() * 0.5), size, size * (0.8 + rand() * 0.5));
    m.compose(new THREE.Vector3(x, floorHeight(x, z, floorY) + size * 0.1, z), q, s);
    uv1.set(seabedLightUv(x, z), placed * 2);
    mesh.setMatrixAt(placed++, m);
  }
  mesh.count = placed;
  if (lightUv) base.setAttribute('uv1', new THREE.InstancedBufferAttribute(uv1, 2));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** The ruin: pillars with glowing glyphs, boulders, coral, hanging chains and strewn stones. */
export function Kit({ world, kit }: { world: WorldConfig; kit: WorldKit }) {
  const now = useWorldTime();
  const coralTime = useRef({ value: 0 });
  const coralMotion = useRef({ value: 1 });
  const motionAmount = useMotionAmount();
  const instance = useInstance();
  const { reliefGate } = instance;
  const group = useRef<THREE.Group>(null);

  const built = useMemo(() => {
    const { scene: source, baked } = kit;
    const { layout, palette, relics } = world;
    const stoneMaps = makeStoneMaps(13, { period: 6, strength: 5, pits: 0.25 });
    const rockMaps = makeStoneMaps(29, { period: 5, strength: 9, pits: 1.1 });
    rockMaps.normal.repeat.set(0.7, 0.7);
    rockMaps.tone.repeat.set(0.7, 0.7);
    const stone = new THREE.MeshStandardMaterial({
      color: palette.stone,
      roughness: 0.62,
      envMapIntensity: 0.35,
      vertexColors: true,
      map: stoneMaps.tone,
      normalMap: stoneMaps.normal,
      normalScale: new THREE.Vector2(1.1, 1.1),
    });
    // Stone, rock and pebbles keep their normal maps' relief under the baked light, each material
    // reading the relief map beside its lightmap. A hook is made per relief: hooks of one source
    // share a program (three keys it by the hook's text), each material with its own uniforms.
    const reliefMaps = baked && { lod0: lightMapOf(baked.reliefMaps.lod0), lod1: lightMapOf(baked.reliefMaps.lod1), seabed: lightMapOf(baked.reliefMaps.seabed) };
    const relief = (atlas: keyof BakeRecord['atlases']) => (baked && reliefMaps ? reliefOf(baked, reliefMaps[atlas]) : null);
    type Hook = (relief: Relief | null) => THREE.Material['onBeforeCompile'];
    const stoneHook: Hook = r => shader => withBakedLight(shader, r, reliefGate);
    stone.onBeforeCompile = stoneHook(relief('lod0'));
    const rock = new THREE.MeshStandardMaterial({
      color: palette.rock ?? '#211a26',
      roughness: 0.5,
      envMapIntensity: 0.35,
      vertexColors: true,
      map: rockMaps.tone,
      normalMap: rockMaps.normal,
      normalScale: new THREE.Vector2(1.4, 1.4),
    });
    const rockHook: Hook = r => shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRockWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vRockWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      withBakedLight(shader, r, reliefGate);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vRockWorld;
          float rh(vec3 p) { p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
          float rn(vec3 x) {
            vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(rh(i), rh(i + vec3(1, 0, 0)), f.x), mix(rh(i + vec3(0, 1, 0)), rh(i + vec3(1, 1, 0)), f.x), f.y),
                       mix(mix(rh(i + vec3(0, 0, 1)), rh(i + vec3(1, 0, 1)), f.x), mix(rh(i + vec3(0, 1, 1)), rh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
          }`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          {
            float pore = smoothstep(0.72, 0.88, rn(vRockWorld * 14.0)) * smoothstep(0.4, 0.66, rn(vRockWorld * 2.1 + 4.0));
            float low = 1.0 - smoothstep(-2.4, -1.0, vRockWorld.y);
            totalEmissiveRadiance += ${glslColour(palette.floorGlow.pores)} * pore * (0.45 + 2.4 * low) * ${world.glow.crevice.toFixed(2)};
          }`,
        );
    };
    rock.onBeforeCompile = rockHook(relief('lod0'));
    const pebble = new THREE.MeshStandardMaterial({ color: palette.pebble ?? '#2a2230', roughness: 0.55, normalMap: rockMaps.normal, normalScale: new THREE.Vector2(1.2, 1.2) });
    pebble.onBeforeCompile = stoneHook(relief('seabed'));
    const iron = new THREE.MeshStandardMaterial({ color: '#2a2e3c', roughness: 0.38, metalness: 0.8 });
    // Coral glows from within, brightest at the tips (the baked colour), and is still shaded by
    // the light round it, so its branches read as solid. A world may give the rock, pebble and
    // coral body colours (`palette.rock`, `pebble`, `coralBody`); the literals are Nox's, for his world.
    const coral = new THREE.MeshStandardMaterial({ vertexColors: true, color: palette.coralBody ?? '#7a0a18', roughness: 0.42, emissive: new THREE.Color(palette.coral).multiplyScalar(relics.coral) });
    coral.onBeforeCompile = shader => {
      shader.uniforms.uTime = coralTime.current;
      shader.uniforms.uMotion = coralMotion.current;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uMotion;')
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `#include <begin_vertex>
          // Swaying in the current: more toward the tips, each clump on its own beat (liveMotion.ts); still when motion is held.
          ${CORAL_SWAY_GLSL}`,
        );
      withBakedLight(shader, null, reliefGate);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance *= pow(vColor.r, 1.6);`,
      );
    };

    // Glyph textures are shared by panel shape, rune and wear; materials add each panel's brightness.
    const glyphTextures = new Map<string, THREE.CanvasTexture>();
    const glyphMaterials = new Map<string, THREE.MeshBasicMaterial>();
    const glyphMaterial = (mesh: THREE.Mesh, runes: number, pillar: number) => {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox!;
      // The quantized box is the panel scaled evenly, so its shape is the panel's.
      const aspect = (box.max.y - box.min.y) / (box.max.x - box.min.x);
      const set = RUNE_SETS[runes % RUNE_SETS.length];
      const cell = Number(mesh.name.match(/glyph(\d+)/)?.[1] ?? 0);
      const rune = set[(cell + runes) % set.length];
      const { wear, brightness } = glyphPanelLook(pillar, cell);
      const textureKey = `${aspect.toFixed(2)}-${rune}-${wear}`;
      let map = glyphTextures.get(textureKey);
      if (!map) {
        map = makeGlyphTexture([rune], aspect, wear);
        glyphTextures.set(textureKey, map);
      }
      const key = `${textureKey}-${brightness}`;
      let material = glyphMaterials.get(key);
      if (!material) {
        material = new THREE.MeshBasicMaterial({ map, color: new THREE.Color('#ffffff').multiplyScalar(relics.glyph * brightness) });
        glyphMaterials.set(key, material);
      }
      return material;
    };

    // With the near world baked, each placed stone, rock and coral reads its own rect of its level's
    // lightmap atlas: a copy of its material per placement and level, sharing shader and textures.
    // With a hook, it also reads that level's relief map.
    const litMaterials: (THREE.Material | THREE.Texture)[] = reliefMaps ? Object.values(reliefMaps) : [];
    const lit = <M extends THREE.MeshStandardMaterial>(base: M, light: BakedLight | null, group: string, index: number, level: number, hook?: Hook) => {
      if (!light) return base;
      const material = base.clone() as M;
      material.onBeforeCompile = hook ? hook(relief(level === 0 ? 'lod0' : 'lod1')) : base.onBeforeCompile;
      const rects = light.record.instances[group][index];
      material.lightMap = level === 0 ? lightMapOf(light.atlases.lod0, rects.lod0) : lightMapOf(light.atlases.lod1, rects.lod1);
      material.lightMapIntensity = light.record.intensity;
      litMaterials.push(material, material.lightMap);
      return material;
    };

    source.updateMatrixWorld(true);
    const piece = (name: string) => {
      const found = source.getObjectByName(name);
      if (!found) throw new Error(`kit piece missing: ${name}`);
      return found;
    };
    // Each placed piece is a LOD holding copies of the piece and its lod1. The copies keep the
    // node transforms the compressed file gives them; the placement goes on the LOD.
    const placedLod = (p: Placement, dress: (level: THREE.Object3D, index: number) => void) => {
      const lod = withLod(piece(p.piece).clone(true), piece(`${p.piece}_lod1`).clone(true));
      lod.levels.forEach(({ object }, index) => dress(object, index));
      applyPlacement(lod, p);
      lod.updateMatrixWorld(true);
      return lod;
    };

    // With the far plate in the world, the pieces beyond its cut are the plate's: they stay in the
    // layout (the bake records their squares by index) but are not built here.
    const near = (p: Placement) => !(world.farPlate && isFarPlacement(p, world.farPlate.cutZ));

    // Nodes the world draws with a kit-material variant (`world.materials`): one material per
    // assignment, made the first time a node needs it (none for a world that assigns none, so its
    // materials are made as they always were). A placed piece with one is drawn with it, whatever
    // its group, and leaves its group's dressing.
    const kitMaterials = new Map<string, KitMaterialInstance>();
    const assigned = (name: string) => kitMaterialFor(world.materials, name) !== undefined;
    const kitMaterial = (name: string) => {
      const assignment = kitMaterialFor(world.materials, name);
      if (!assignment) return null;
      let made = kitMaterials.get(assignment.node);
      if (!made) {
        made = makeKitMaterial(assignment);
        kitMaterials.set(assignment.node, made);
      }
      return made.material;
    };

    const pillars = (layout.groups.pillars ?? []).flatMap((p, index) => {
      if (!near(p) || assigned(p.piece)) return [];
      return [placedLod(p, (level, levelIndex) => {
        const material = lit(stone, baked, 'pillars', index, levelIndex, stoneHook);
        level.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          if (child.name.includes('glyph')) {
            child.material = glyphMaterial(child, p.runes ?? index, index);
          } else {
            child.material = material;
            // Far down the ruin the fog hides any shadow they would throw.
            child.castShadow = p.position[2] > -12;
            child.receiveShadow = true;
          }
        });
      })];
    });

    const rocks = (layout.groups.rocks ?? []).flatMap((p, index) => {
      if (!near(p) || assigned(p.piece)) return [];
      return [placedLod(p, (level, levelIndex) => {
        const mesh = level as THREE.Mesh;
        mesh.material = lit(rock, baked, 'rocks', index, levelIndex, rockHook);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      })];
    });

    // Coral sits on whatever is under it: a boulder (at full detail) or the seabed. Its sway reads
    // positions in stage units, so it draws from baked float copies of the kit's coral.
    const coralGeometry = new Map<string, THREE.BufferGeometry>();
    const coralLevel = (name: string, material: THREE.Material) => {
      let geometry = coralGeometry.get(name);
      if (!geometry) {
        geometry = bakedGeometry(piece(name) as THREE.Mesh);
        coralGeometry.set(name, geometry);
      }
      return new THREE.Mesh(geometry, material);
    };
    const rockSurfaces = rocks.map(lod => lod.levels[0].object);
    const corals = (layout.groups.corals ?? []).flatMap((p, index) => {
      if (!near(p) || assigned(p.piece)) return [];
      const object = withLod(coralLevel(p.piece, lit(coral, baked, 'corals', index, 0)), coralLevel(`${p.piece}_lod1`, lit(coral, baked, 'corals', index, 1)));
      const [x, , z] = p.position;
      applyPlacement(object, { ...p, position: [x, coralRest(x, z, layout.floorY, rockSurfaces).y, z] });
      return [object];
    });

    // Any other group of the layout is plain stone: the stone material, lit from its own bake rects.
    const stoneGroups = Object.entries(layout.groups)
      .filter(([name]) => !(DRESSED_GROUPS as readonly string[]).includes(name))
      .flatMap(([name, list]) =>
        list.flatMap((p, index) => {
          if (!near(p) || assigned(p.piece)) return [];
          return [placedLod(p, (level, levelIndex) => {
            const material = lit(stone, baked, name, index, levelIndex, stoneHook);
            level.traverse(child => {
              if (!(child instanceof THREE.Mesh)) return;
              child.material = material;
              child.castShadow = p.position[2] > -12;
              child.receiveShadow = true;
            });
          })];
        }),
      );

    // Placed pieces with a kit material: drawn with it at both levels, unbaked (their light is their own).
    const placements = Object.values(layout.groups).flat();
    const glowing = placements.flatMap(p => {
      if (!near(p) || !assigned(p.piece)) return [];
      return [placedLod(p, level => {
        const material = kitMaterial(p.piece)!;
        level.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          child.material = material;
          child.castShadow = p.position[2] > -12;
          child.receiveShadow = true;
        });
      })];
    });

    // Nodes that share a piece's frame (`kit.attached`: a doorway's membrane and lock) stand in
    // each placement of that piece, as the kit file places them in it. One with a kit material is
    // drawn with it; one without keeps the material the file gives it.
    const propNodes = new Map<string, THREE.Object3D[]>();
    const attached = placements.flatMap(p => {
      const parts = (world.kit.attached ?? []).filter(a => a.piece === p.piece);
      if (!near(p) || parts.length === 0) return [];
      const frame = new THREE.Group();
      for (const { node } of parts) {
        const copy = piece(node).clone(true);
        for (const prop of (world.props ?? []).filter(pr => pr.node === node)) propNodes.set(prop.id, [...(propNodes.get(prop.id) ?? []), copy]);
        const material = kitMaterial(node);
        copy.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          if (material) child.material = material;
          child.castShadow = false;
          child.receiveShadow = material === null;
        });
        frame.add(copy);
      }
      applyPlacement(frame, p);
      frame.updateMatrixWorld(true);
      return [frame];
    });

    // The kit's chain is 30 links at 0.175 each; repeats continue the links' alternation. Each
    // chain's LOD stands at its middle, so its distance is measured from there.
    const CHAIN_SCALE = 1.45;
    // A world with no chains (an empty layout) need not carry the chain piece.
    const links = (layout.chains.length === 0 ? [] : ['chain', 'chain_lod1']).map(name => bakedGeometry(piece(name) as THREE.Mesh).scale(CHAIN_SCALE, CHAIN_SCALE, CHAIN_SCALE));
    const chains = layout.chains.filter(chain => !(world.farPlate && isFarChain(chain, world.farPlate.cutZ))).map(({ from, to, sag }) => {
      const [full, far] = links.map(link => {
        const mesh = new THREE.Mesh(hangChain(link, 30 * 0.175 * CHAIN_SCALE, from, to, sag), iron);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      });
      const middle = full.geometry.boundingSphere!.center.clone();
      for (const mesh of [full, far]) mesh.geometry.translate(-middle.x, -middle.y, -middle.z);
      const lod = withLod(full, far);
      lod.position.copy(middle);
      return lod;
    });
    const chainGeometry = chains.flatMap(lod => lod.levels.map(level => (level.object as THREE.Mesh).geometry));

    // Unbaked, the near glyphs are real lights: red light falls on the stone and the seabed, and
    // the lava pools low round the coral and the pillars' feet. Baked, that light is in the lightmaps.
    const lights = stoneLights(world).points.map(({ position, color, intensity, distance }) => {
      const light = new THREE.PointLight(color, intensity, distance, 2);
      light.position.set(...position);
      return light;
    });

    if (baked) {
      pebble.lightMap = lightMapOf(baked.atlases.seabed);
      pebble.lightMapIntensity = baked.record.intensity;
      litMaterials.push(pebble.lightMap);
    }
    const pebbles = pebbleField(pebble, layout.floorY, baked !== null);

    // What this memo made and owns. The pieces' own geometry and materials belong to the
    // useLoader cache (the clones above share them), so they are left out; the LOD objects hold
    // nothing on the GPU. The baked coral and chain geometry is this memo's own.
    const disposables = [
      stoneMaps.tone, stoneMaps.normal, rockMaps.tone, rockMaps.normal,
      stone, rock, pebble, iron, coral,
      ...glyphTextures.values(),
      ...glyphMaterials.values(),
      ...coralGeometry.values(),
      ...chainGeometry,
      ...litMaterials,
      ...[...kitMaterials.values()].map(k => k.material),
      pebbles.geometry,
      pebbles,
    ];

    // The props a sequence moves (`WorldConfig.props`): the attached nodes they name, in every placement.
    const bindings: PropBinding[] = (world.props ?? []).map(prop => ({ prop, nodes: propNodes.get(prop.id) ?? [] }));

    return { pillars, rocks, corals, stoneGroups, glowing, attached, bindings, kitMaterials: [...kitMaterials.values()], chains, pebbles, lights, disposables };
  }, [kit, world, reliefGate]);
  useDisposables(built.disposables);

  useFrame(state => {
    driveProps(built.bindings, instance.kit);
    coralTime.current.value = now(state);
    coralMotion.current.value = motionAmount;
    for (const k of built.kitMaterials) k.update(now(state), motionAmount);
  });

  useLayoutEffect(() => {
    group.current?.updateMatrixWorld(true);
  }, [built]);

  return (
    <group ref={group}>
      {built.pillars.map((o, i) => <primitive key={`p${i}`} object={o} />)}
      {built.rocks.map((o, i) => <primitive key={`r${i}`} object={o} />)}
      {[...built.corals, ...built.stoneGroups, ...built.glowing, ...built.attached].map((o, i) => <primitive key={`c${i}`} object={o} />)}
      {built.chains.map((o, i) => <primitive key={`ch${i}`} object={o} />)}
      {built.lights.map((o, i) => <primitive key={`l${i}`} object={o} />)}
      <primitive object={built.pebbles} />
    </group>
  );
}
