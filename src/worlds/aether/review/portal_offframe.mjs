// Spec 7.7 relic rule, the intro half: "the portal is out of frame in the intro". A mask test on the frozen intro.
//
// Usage (dev server running): NOX_URL=http://127.0.0.1:5196 node src/worlds/aether/review/portal_offframe.mjs [out-dir]
//
// For each viewport (desktop 1536 x 1024, 16:9 1920 x 1080, 4:3 1024 x 768, phone 390 x 844) it loads the frozen intro
// (`?world=aether&stage=intro&freeze`), waits for the ready flag, and reads the stage camera the page really drew with
// (`window.__octoverse.camera`: place, facing after the lean, field of view and lens shift). It projects the portal's
// placed pieces through that camera: every portal_* node of kit.glb (arch, steps, membrane, glyph, lanterns), its
// bounding box placed as layout.json's portal group places it. The convex hull of each projected box is a mask that
// holds every pixel the node can cover; the test clips it to the frame and counts the pixels left. Any pixel fails.
// It also prints how far outside the frame the nearest portal point lands, in pixels. With an out-dir it saves the
// desktop still (`intro-desktop-frozen.png`) as the evidence the camera was read from.
// Exit 1, with a line starting FAIL, on any portal pixel or corner in any viewport, or when the check cannot be made
// (no camera probe, an unusable camera, a portal box behind the camera or projecting to no area, too few portal nodes).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { chromium } from '@playwright/test';
import { warmFonts, waitForReady } from '../../../../scripts/capture-ready.mjs';

const base = process.env.NOX_URL ?? 'http://127.0.0.1:5196';
const outDir = process.argv[2];
const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const VIEWPORTS = [
  ['desktop', 1536, 1024],
  ['16:9', 1920, 1080],
  ['4:3', 1024, 768],
  ['phone', 390, 844],
];

// kit.glb's JSON chunk: the portal nodes' position bounds in the piece's frame (meshopt + KHR_mesh_quantization:
// normalized integers in a [-1, 1] box that the node's translation and scale put back; the nodes are not turned).
const NORMALIZED_MAX = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
const glb = readFileSync(join(ROOT, 'public/aether/world/kit.glb'));
const doc = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
const boxes = doc.nodes
  .filter(n => /^portal_/.test(n.name ?? '') && n.mesh !== undefined && !/_lod1$/.test(n.name))
  .map(n => {
    const t = n.translation ?? [0, 0, 0];
    const s = n.scale ?? [1, 1, 1];
    if (n.rotation && n.rotation.some((v, i) => v !== [0, 0, 0, 1][i])) throw new Error(`${n.name} is turned`);
    const prims = doc.meshes[n.mesh].primitives.map(p => {
      const a = doc.accessors[p.attributes.POSITION];
      const unit = a.normalized ? NORMALIZED_MAX[a.componentType] : 1;
      return { min: a.min.map((v, k) => t[k] + (s[k] * v) / unit), max: a.max.map((v, k) => t[k] + (s[k] * v) / unit) };
    });
    return { name: n.name, min: [0, 1, 2].map(k => Math.min(...prims.map(b => b.min[k]))), max: [0, 1, 2].map(k => Math.max(...prims.map(b => b.max[k]))) };
  });
if (boxes.length < 4) throw new Error(`expected the portal's nodes in kit.glb, found ${boxes.map(b => b.name)}`);
const layout = JSON.parse(readFileSync(join(ROOT, 'src/worlds/aether/place/layout.json'), 'utf8'));
const [arch] = layout.groups.portal;

/** The eight corners of a node's box, placed as the page places the arch (scale, turn about y, move). */
function corners({ min, max }) {
  const frame = new THREE.Object3D();
  frame.position.set(...arch.position);
  frame.rotation.set(0, arch.rotY ?? 0, arch.tilt ?? 0);
  frame.scale.setScalar(arch.scale ?? 1);
  frame.updateMatrixWorld(true);
  const out = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push(frame.localToWorld(new THREE.Vector3(x, y, z)));
  return out;
}

function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  const upper = [];
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** The polygon clipped to the frame [0, w] x [0, h] (Sutherland-Hodgman), and its area in pixels. */
function clippedArea(poly, w, h) {
  const edges = [[p => p[0] >= 0, (a, b) => lerpAt(a, b, 0, 0)],[p => p[0] <= w, (a, b) => lerpAt(a, b, 0, w)], [p => p[1] >= 0, (a, b) => lerpAt(a, b, 1, 0)], [p => p[1] <= h, (a, b) => lerpAt(a, b, 1, h)]];
  function lerpAt(a, b, axis, v) { const t = (v - a[axis]) / (b[axis] - a[axis]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  let out = poly;
  for (const [inside, cut] of edges) {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i], b = src[(i + 1) % src.length];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
    }
    if (!out.length) return 0;
  }
  let area = 0;
  for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; area += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(area) / 2;
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
let fail = false;
try {
  for (const [label, width, height] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await warmFonts(page, base);
    await page.goto(`${base}/?stage=intro&freeze&tier=high&kitwait=90000&world=aether`, { waitUntil: 'load' });
    await waitForReady(page, { label: `intro ${label} ` });
    const cam = await page.evaluate(() => window.__octoverse.camera);
    if (!cam) throw new Error('no camera probe (window.__octoverse.camera): a development server is needed');
    if (![cam.fov, ...cam.position, ...cam.quaternion, cam.offsetY ?? 0].every(Number.isFinite)) throw new Error(`the camera probe is not usable: ${JSON.stringify(cam)}`);
    if (outDir && label === 'desktop') await page.screenshot({ path: join(outDir, 'intro-desktop-frozen.png') });
    await page.close();
    const camera = new THREE.PerspectiveCamera(cam.fov, width / height, 0.1, 60);
    camera.position.fromArray(cam.position);
    camera.quaternion.fromArray(cam.quaternion);
    if (cam.offsetY) camera.setViewOffset(width, height, 0, cam.offsetY, width, height);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    let pixels = 0;
    let nearest = Infinity;
    for (const box of boxes) {
      const pts = corners(box).map(v => {
        const view = v.clone().applyMatrix4(camera.matrixWorldInverse);
        if (view.z >= -camera.near) throw new Error(`${box.name} reaches behind the camera: the hull test does not hold`);
        const ndc = v.clone().project(camera);
        return [((ndc.x + 1) / 2) * width, ((1 - ndc.y) / 2) * height];
      });
      if (!pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) throw new Error(`${box.name} does not project to finite pixels`);
      const shape = hull(pts);
      // A box always projects to an area: a hull of fewer than three corners means the projection went wrong, and its area of 0 would pass.
      if (shape.length < 3) throw new Error(`${box.name} projects to a degenerate hull (${shape.length} corners)`);
      const area = clippedArea(shape, width, height);
      pixels += area;
      for (const [x, y] of pts) nearest = Math.min(nearest, Math.max(-x, x - width, -y, y - height));
      if (area > 0) console.log(`  ${box.name}: ${area.toFixed(0)} px inside the ${label} frame`);
    }
    // No hull pixel in the frame, and no corner in it either (a corner inside with a zero-area hull would be a projection fault).
    const ok = pixels === 0 && nearest > 0;
    fail ||= !ok;
    console.log(`${ok ? 'ok  ' : 'MISS'} ${label} ${width}x${height}: portal pixels in the frozen intro ${pixels.toFixed(0)}; nearest portal point ${nearest.toFixed(0)} px outside the frame (camera fov ${cam.fov.toFixed(2)}, lens shift ${(cam.offsetY ?? 0).toFixed(1)} px)`);
  }
} catch (error) {
  console.log(`FAIL ${error.message.split(/\r?\n/)[0]}`);
  fail = true;
} finally {
  await browser.close();
}
if (fail) console.log('FAIL the portal is (or may be) in the frozen intro: see the lines above');
process.exit(fail ? 1 : 0);
