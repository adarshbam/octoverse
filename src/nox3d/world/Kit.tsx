import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { floorHeight } from './Floor';
import { fbm2, seeded } from './noise';
import { RUNE_SETS, glyphPanelLook, makeGlyphTexture, makeStoneMaps } from './textures';
import type { Placement, Vec3, WorldConfig } from './types';
import { useDisposables } from './useDisposables';
import { useWorldTime } from './worldTime';

/** Beyond this distance from the camera a piece draws its `_lod1`, about a quarter of the triangles. */
const KIT_LOD_DISTANCE = 14;
/** Back to full detail only inside 3% less, so a piece on the line does not flicker as the camera hovers. */
const LOD_HYSTERESIS = 0.03;

/** One KTX2 loader per renderer: it transcodes in workers, to the formats this GPU supports. */
const ktx2Loaders = new WeakMap<THREE.WebGLRenderer, KTX2Loader>();

/** The kit is compressed: meshopt geometry, KTX2 (Basis) textures with the transcoder in public/nox/basis. */
function compressedKit(gl: THREE.WebGLRenderer) {
  return (loader: GLTFLoader) => {
    let ktx2 = ktx2Loaders.get(gl);
    if (!ktx2) {
      ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}nox/basis/`).detectSupport(gl);
      ktx2Loaders.set(gl, ktx2);
    }
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);
  };
}

function applyPlacement(object: THREE.Object3D, p: Placement) {
  object.position.set(...p.position);
  object.rotation.set(0, p.rotY ?? 0, p.tilt ?? 0);
  if (typeof p.scale === 'object') object.scale.set(...p.scale);
  else object.scale.setScalar(p.scale ?? 1);
}

/** A piece at full detail near the camera and its `_lod1` beyond `KIT_LOD_DISTANCE`. */
function withLod(full: THREE.Object3D, far: THREE.Object3D) {
  const lod = new THREE.LOD();
  lod.addLevel(full, 0);
  lod.addLevel(far, KIT_LOD_DISTANCE, LOD_HYSTERESIS);
  return lod;
}

/**
 * A kit mesh as plain float geometry in its piece's own space. The compressed file stores
 * positions quantized into a [-1, 1] box and puts the scale and offset back in the node; code
 * that reads positions as stage units (the coral's sway, the chain's bending) needs them undone.
 */
function bakedGeometry(mesh: THREE.Mesh) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, source] of Object.entries(mesh.geometry.attributes)) {
    const size = source.itemSize;
    const values = new Float32Array(source.count * size);
    // getX..getW undo the normalisation of quantized attributes.
    const read = (i: number, c: number) => (c === 0 ? source.getX(i) : c === 1 ? source.getY(i) : c === 2 ? source.getZ(i) : source.getW(i));
    for (let i = 0; i < source.count; i++) for (let c = 0; c < size; c++) values[i * size + c] = read(i, c);
    geometry.setAttribute(name, new THREE.BufferAttribute(values, size));
  }
  // Its own copy: disposing this geometry must not free the cached piece's index on the GPU.
  if (mesh.geometry.index) geometry.setIndex(mesh.geometry.index.clone());
  mesh.updateWorldMatrix(true, false);
  return geometry.applyMatrix4(mesh.matrixWorld);
}

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

/** Small stones strewn over the seabed, thicker toward the pillars. */
function pebbleField(material: THREE.Material, floorY: number) {
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
    mesh.setMatrixAt(placed++, m);
  }
  mesh.count = placed;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** The ruin: pillars with glowing glyphs, boulders, coral, hanging chains and strewn stones. */
export function Kit({ world }: { world: WorldConfig }) {
  const gl = useThree(state => state.gl);
  const gltf = useLoader(GLTFLoader, world.kit.url, compressedKit(gl));
  const now = useWorldTime();
  const coralTime = useRef({ value: 0 });
  const group = useRef<THREE.Group>(null);

  const built = useMemo(() => {
    const source = gltf.scene;
    const { layout, palette } = world;
    const stoneMaps = makeStoneMaps(13, { period: 6, strength: 5, pits: 0.25 });
    const rockMaps = makeStoneMaps(29, { period: 5, strength: 9, pits: 1.1 });
    rockMaps.normal.repeat.set(0.7, 0.7);
    rockMaps.tone.repeat.set(0.7, 0.7);
    const stone = new THREE.MeshStandardMaterial({
      color: palette.stone,
      roughness: 0.62,
      vertexColors: true,
      map: stoneMaps.tone,
      normalMap: stoneMaps.normal,
      normalScale: new THREE.Vector2(1.1, 1.1),
    });
    const rock = new THREE.MeshStandardMaterial({
      color: '#22202e',
      roughness: 0.5,
      vertexColors: true,
      map: rockMaps.tone,
      normalMap: rockMaps.normal,
      normalScale: new THREE.Vector2(1.4, 1.4),
    });
    rock.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRockWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vRockWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
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
            totalEmissiveRadiance += vec3(1.0, 0.16, 0.05) * pore * (0.45 + 2.4 * low);
          }`,
        );
    };
    const pebble = new THREE.MeshStandardMaterial({ color: '#2a2a38', roughness: 0.55, normalMap: rockMaps.normal, normalScale: new THREE.Vector2(1.2, 1.2) });
    const iron = new THREE.MeshStandardMaterial({ color: '#2a2e3c', roughness: 0.38, metalness: 0.8 });
    // Coral glows from within, brightest at the tips (the baked colour), and is still shaded by
    // the light round it, so its branches read as solid.
    const coral = new THREE.MeshStandardMaterial({ vertexColors: true, color: '#7a0a18', roughness: 0.42, emissive: new THREE.Color(palette.coral).multiplyScalar(1.7) });
    coral.onBeforeCompile = shader => {
      shader.uniforms.uTime = coralTime.current;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `#include <begin_vertex>
          // Swaying in the current: more toward the tips, each clump on its own beat.
          float phase = modelMatrix[3].x * 1.7 + modelMatrix[3].z * 0.9;
          float h = max(position.y, 0.0);
          transformed.x += sin(uTime * 1.1 + phase + position.y * 2.5) * 0.05 * h * h;
          transformed.z += cos(uTime * 0.8 + phase * 1.3) * 0.03 * h * h;`,
        );
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
        material = new THREE.MeshBasicMaterial({ map, color: new THREE.Color('#ffffff').multiplyScalar(2.4 * brightness) });
        glyphMaterials.set(key, material);
      }
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
    const placedLod = (p: Placement, dress: (level: THREE.Object3D) => void) => {
      const lod = withLod(piece(p.piece).clone(true), piece(`${p.piece}_lod1`).clone(true));
      for (const { object } of lod.levels) dress(object);
      applyPlacement(lod, p);
      lod.updateMatrixWorld(true);
      return lod;
    };

    const pillars = layout.pillars.map((p, index) =>
      placedLod(p, level =>
        level.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          if (child.name.includes('glyph')) {
            child.material = glyphMaterial(child, p.runes ?? index, index);
          } else {
            child.material = stone;
            // Far down the ruin the fog hides any shadow they would throw.
            child.castShadow = p.position[2] > -12;
            child.receiveShadow = true;
          }
        }),
      ),
    );

    const rocks = layout.rocks.map(p =>
      placedLod(p, level => {
        const mesh = level as THREE.Mesh;
        mesh.material = rock;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }),
    );

    // Coral sits on whatever is under it: a boulder (at full detail) or the seabed. Its sway reads
    // positions in stage units, so it draws from baked float copies of the kit's coral.
    const coralGeometry = new Map<string, THREE.BufferGeometry>();
    const coralLevel = (name: string) => {
      let geometry = coralGeometry.get(name);
      if (!geometry) {
        geometry = bakedGeometry(piece(name) as THREE.Mesh);
        coralGeometry.set(name, geometry);
      }
      const mesh = new THREE.Mesh(geometry);
      mesh.material = coral;
      return mesh;
    };
    const rockSurfaces = rocks.map(lod => lod.levels[0].object);
    const ray = new THREE.Raycaster();
    const corals = layout.corals.map(p => {
      const object = withLod(coralLevel(p.piece), coralLevel(`${p.piece}_lod1`));
      const [x, , z] = p.position;
      ray.set(new THREE.Vector3(x, 8, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(rockSurfaces, false)[0];
      const y = Math.max(hit ? hit.point.y : -Infinity, floorHeight(x, z, layout.floorY)) - 0.04;
      applyPlacement(object, { ...p, position: [x, y, z] });
      return object;
    });

    // The kit's chain is 30 links at 0.175 each; repeats continue the links' alternation. Each
    // chain's LOD stands at its middle, so its distance is measured from there.
    const CHAIN_SCALE = 1.45;
    const links = ['chain', 'chain_lod1'].map(name => bakedGeometry(piece(name) as THREE.Mesh).scale(CHAIN_SCALE, CHAIN_SCALE, CHAIN_SCALE));
    const chains = layout.chains.map(({ from, to, sag }) => {
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

    // The near glyphs are real lights: red light falls on the stone, the seabed and Nox. The lava
    // pools low round the coral and the pillars' feet.
    const lights = world.lights.points.map(({ position, color, intensity, distance }) => {
      const light = new THREE.PointLight(color, intensity, distance, 2);
      light.position.set(...position);
      return light;
    });

    const pebbles = pebbleField(pebble, layout.floorY);

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
      pebbles.geometry,
      pebbles,
    ];

    return { pillars, rocks, corals, chains, pebbles, lights, disposables };
  }, [gltf, world]);
  useDisposables(built.disposables);

  useFrame(state => {
    coralTime.current.value = now(state);
  });

  useLayoutEffect(() => {
    group.current?.updateMatrixWorld(true);
  }, [built]);

  return (
    <group ref={group}>
      {built.pillars.map((o, i) => <primitive key={`p${i}`} object={o} />)}
      {built.rocks.map((o, i) => <primitive key={`r${i}`} object={o} />)}
      {built.corals.map((o, i) => <primitive key={`c${i}`} object={o} />)}
      {built.chains.map((o, i) => <primitive key={`ch${i}`} object={o} />)}
      {built.lights.map((o, i) => <primitive key={`l${i}`} object={o} />)}
      <primitive object={built.pebbles} />
    </group>
  );
}
