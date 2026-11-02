# Task 10 report: look fixes from the test scene

Base 16e4a88, branch feat/nox-3d. Status: DONE_WITH_CONCERNS (one criterion cannot be met as written: concern 1).

## R38: clean headless rebake of the committed bake_world.py (done first)

Command (scratch wrapper only redirected the output path): `blender -b -P blender/security/bake_world.py` (Blender 5.2.2, GPU bake, KTX on PATH), 8 min.

| | committed near.glb | clean rebake |
|---|---|---|
| bytes | 3,845,832 | 3,826,720 (-19,112) |
| raw glb | 7.3 MB (T7) | 8,416,040 |
| images / meshes / nodes | 6 / 43 / 65 | 6 / 43 / 65 |
| `nox_bake` record | | identical JSON (diff empty; atlases, instances, intensity, lights, relief scale 0.5 + encoding, seabed, settings, spill) |

Per atlas, decoded KTX2 (0-255), committed vs rebake:

| atlas | lightmap mean diff / max | relief mean diff / mean abs / max |
|---|---|---|
| lod0 1024 | 0.000 / 16 (0 texels > 8) | +1.08 / 1.70 / 96 (5.7% of texels > 8) |
| lod1 512 | +0.000 / 0 | +0.91 / 1.56 / 94 (5.1%) |
| seabed 512x1024 | +0.000 / 13 (0.002% > 8) | +0.01 / 0.04 / 8 |

Finding: the script is not stale in anything that matters. Lightmaps match. The relief maps differ in the gap texels (about 19% of lod0 is neutral 127/128/128 in the committed file, about 4% of the atlas is filled by the script's `fill_gaps(v)` call, i.e. the committed file predates that call) and in 2% of covered texels by more than 8/255 (mean 1.3). No repair needed; the final near.glb of this task is a clean headless run, so provenance is restored. Details in `scratchpad/r38/`.

## TDD

- RED: `npx vitest run src/nox3d/world/lensShift.test.ts` failed with `Cannot find module './lensShift'` (after the test file was written first). GREEN: 3 tests pass: `lens shift keeps Nox's face at the same screen place` (tilts 0.03, 0.07, 0.12, 0.2, real three camera, setViewOffset, 1536x1024, < 0.5 px), the overview face / any point's height test, and `zero tilt gives zero offset`.
- `liveMotion.test.ts`: RED `Cannot find module './liveMotion'`, then GREEN (3 tests).
- `worldTime.test.ts` +1 (ambient bubbles hold with reduced motion); `farPlate.test.ts` now builds its hover cameras with the lean (it failed by 0.056 units at the far-0 card with the lean on, so `FAR_OVERSCAN` 0.25 -> 0.6 and far.json card sizes follow); `validateWorld.test.ts` covers lava rise, back lights.

## Acceptance numbers

1. **Lens shift.** `lensShift(tilt, keep, { position, fovDeg }) => { pitch, offsetY }` exactly as in the brief (`src/nox3d/world/lensShift.ts`, plus `leanCamera` that applies it). `WorldConfig.camera = { tilt: 0.07 }`. StageCamera applies it each frame in framed mode (hover and eased fov included; `rest` camera for the HTML anchors is unleaned, so anchors follow). Measured shift of the face centre at 1536x1024: **0.043 px** (y 0.000, x 0.043).
2. **Lean.** Cannot match within 2 degrees (concern 1). Panel 2 near-pillar edge lines (RANSAC on edge peaks, degrees from vertical, top leaning inward): right pillar +9.6, +8.0, +10.3; left -12.0, -8.3 (noisy, the painting's own keystone). Capture (framed): tilt 0 gives 0 +-1 (measured -0.4..+0.9); tilt 0.07 gives about 1.2 (projection model; the measured outer-right line moves +0.4..+0.8). Needed tilt for panel 2's slopes is about 0.5 to 0.65 rad. Final tilt: **0.07** (the brief's start).
3. **Lower third** (rows 700-1024 outside Nox's mask, same mask for both, panel 2 as reference):

   | | luminance ratio | mean R ratio | G | B |
   |---|---|---|---|---|
   | before (HEAD) | 1.196 | 0.995 | 1.543 | 1.306 |
   | after | **1.123** | **1.088** | 1.262 | 0.895 |

   Changes: bake lava lights x1.4 (`glow.lava`, record `lavaRise`; Nox's accent data untouched), a red light behind each front rock heap (`glow.back` 1.0, record `lights.back`), rock pore glow x1.8 (`glow.crevice`), floor lava x1.4 (`glow.floor`), embers 460 -> 1012 (**x2.2**, the first 460 identical), cooler light cut to pay for it: fill 2.2 -> 1.1, surface spot 2.2 -> 1.1, environment 0.4 -> 0.06, seabed and rock albedo less blue. R33's heap darkening is covered by the lava rise and the back lights. Outside Nox: bright red (R>0.9) share 0.86% -> 0.92%; 99.9th percentile luminance 0.778 -> 0.781; Nox's mean luminance 0.209 unchanged and relics not undone. Note the spatial pattern still differs from panel 2 (corner rocks too red, centre-low too weak); only the means are in range.
4. **Top** (rows 0-120): luminance 0.795 -> **1.088**, G 0.751 -> **1.089**, B 0.897 -> **1.018** (R 1.011 -> 1.180, not asked). Opening 1.5x and more cyan (fades in over the upper quarter, so the middle water is not brightened: mid 200-700 luminance 1.61 -> 1.73), shafts 9 -> 14 (`glow.rays` 1.6) in a cyan tint.
5. **Water and live motion.**
   - Ambient bubbles: the world's `Bubbles` now fill the corridor (70 bubbles over x +-4.5, z -12 to +2, y -2.4 to 4.2; `WORLD_BUBBLES`, scaled by `live.bubbles * density`, on the world clock, so `?freeze` holds them; reduced motion holds them at one moment).
   - Floor lava pulse: **period 6.98 s** (0.9 rad/s), 0.72 +- 0.28 of its strength; coral sway: **0.05 along x, 0.03 along z** at the tip of a clump of height 1 (quadratic in height). Both are one `uMotion` uniform (`liveMotion.ts`): 0 under `?freeze` and under reduced motion (`WorldScene reducedMotion` prop), where the pulse sits at its mean 0.72. Tested by `liveMotion.test.ts` (amplitude 0 and constant output for freeze, reduced motion, both; shaders carry the uniform). No Playwright reduced-motion check added.
6. **Stone and glyphs.** Kit unchanged: no measurable miss. Glyph panels (bright red blobs outside Nox at 768x512): panel 2 76 blobs, area CV 2.28, width CV 1.42, mean-R CV 0.42; capture before 103, 2.03, 1.03, 0.36; after the same kit. Panel sizes come from `PANEL_W/PANEL_H` (0.42-0.64 x 0.5-0.78 units, hashed per panel), wear and brightness steps 0.7 to 1.3 (`glyphPanelLook`), blocks 0.4-0.78 high with x/y splits. Not rebuilt.
7. **Nox** (`world-capture intro`, then `check_stage --world --stage intro`): mean **(127, 29, 79)**, saturation 0.834 (HEAD measured 0.835 this session), brightness 0.570, mask 195,033 px identical; crown 6.4, middle 7.9, upper arm 6.8, band 6.9, suckers 4.3, aura 7.9 ok; misses: saturation, cheek 9.5, rim 40.7 (the accepted ones; brightness is printed as MISS at 0.570 at HEAD as well). The lean does not show in `view=` captures by design (concern 1), so these are the unleaned numbers; the e2e silhouette test depends on that.
8. **GPU** (intro frozen, 1536x1024, DPR 1, headless Edge, timer queries, 8 interleaved cycles of 8 s, HEAD from `git archive` on its own vite port, dev servers): before median 52.22 ms (p10 median 48.29), after **52.59 ms (p10 49.72)**: **+0.63 ms (+1.2%)** paired median, p10 +1.43 ms (+3.0%). Within 5%. No new passes.
9. **Download** (visitor, R35): near.glb 3,872,468 + transcoder 584,862 + far 160,949 = **4,618,279 B = 4.40 MiB** (limit 6 MiB). near.glb was rebaked headless from the edited script; `render_far.py` rerun after the relight (2 m 34 s): far-0 12,445 B, far-1 32,889 B, far-2 115,615 B, total 160,949 (HEAD 171,159). Far cards grew 0.7 units (overscan 0.6, covers the lean; far.json updated).
10. **Checks.** `npm test` 56 files, 334 tests pass (327 at HEAD); `tsc -p tsconfig.nox3d.json` and `tsc -p tsconfig.app.json` exit 0; oxlint on changed files: same warning counts as HEAD (App 7, Floor 1, Kit 6, Particles 1, Water 6, WorldScene 1; new files none); `npx playwright test -c playwright.nox3d.config.ts` 8 passed.

## Images looked at

Two: the side-by-side before (HEAD, `spike-out/t10/before-vs-p2.png`) and after (`spike-out/look-vs-p2.png`, a framed capture so the lean is in it, overlays hidden). After: brighter cyan opening with more fanned shafts, glowing lava floor and many more embers, rocks darker, coral red; pillars show a faint lean. Rock heaps are still dark masses at the corners, not yet the panel's lava-veined heaps; the owner judges live. Not an approval.

## Files changed

- New: `src/nox3d/world/lensShift.ts`, `lensShift.test.ts`, `liveMotion.ts`, `liveMotion.test.ts`, `bubbleField.ts`.
- Modified: `App.tsx`, `stage/liveAnchors.ts` (face anchor for detail), `world/{Floor,Kit,Particles,Water,WorldScene,bakedLight,farPlate,types,worldTime}.ts(x)`, `world/security/{config.ts,far.json}`, tests `farPlate.test.ts`, `validateWorld.test.ts`, `worldTime.test.ts`; `blender/security/bake_world.py`; assets `near.glb`, `far-0..2.ktx2`.
- Tools left in `spike-out/t10/` (measure.py, grid.py, edges.py, glyphs.py, framed.mjs; spike-out is not tracked).

## Self-review

- Lean only in framed mode (as the brief says); `view=` zoom stays the traced stage so check_stage and the e2e silhouette equality hold.
- The first lean in view mode broke the e2e silhouette test and Nox's arm band and aura samples; moving it to framed mode fixed both.
- Config `glow` and the record fields `lavaRise`, `backRise`, `lights.back` are checked by validateWorld.test against near.glb.
- The temporary debug switches in WorldScene.tsx were removed before commit.

## Concerns

1. **Lean cannot meet 2 degrees and keep Nox.** Panel 2's slopes (8 to 12 degrees) need a pitch of about 0.5 to 0.65 rad with a 24 degree lens; the lens shift fixes only the face, so Nox's traced arms slide: Nox's silhouette area changes by +2.2% (0.07), +3.7% (0.10), +10.9% (0.2), +30.6% (0.35), +66.8% (0.5), and his sample patches fail (band deltaE 15.8 and aura 11.8 at 0.07; 8.5 / 7.7 even at 0.02). At 0.07 the lean is about 1.2 degrees, a hint. Owner decision at M2: tilt is one constant (`camera.tilt`); alternatives: a lean of the near pillars' placements, or a vertex lean on world materials only.
2. Lower third matches in means only (luminance +12%, R +9%); the red sits at the front corners (rock heaps R 100 against panel 2's 23) while panel 2 has it low in the centre. Spot, fill and environment were cut to pay for the red (fill 1.1, spot 1.1, environment 0.06), so stone and pillars lose most of their blue sheen; mid region (200-700) is still 1.7x panel 2's luminance.
3. Aura outside Nox is borderline (7.9 against 8).
4. Dev-server GPU timings drift between runs; only the paired difference counts.
5. `validateWorld.test.ts` is Windows-1252; edited byte-safe.

## Fix round 1

1. **Wiring test** (`tests/e2e/worldMotion.spec.ts`, Playwright; vitest runs in node with no GL/DOM, so the real uniforms can only be read in a browser). It opens `/?stage=intro&world`, hooks three's `__THREE_DEVTOOLS__` to get the renderer and scenes, and reads the uniforms the GPU is given: the floor's `uMotionV.x` and every coral `uMotion`. Motion allowed: all 1. Reduced motion (emulated media) and `&freeze`: all 0; each case also asserts the uniforms were found (so a renamed uniform cannot pass vacuously). Passes at HEAD (29 s).
   - RED 1: Floor.tsx `motion.set(motionAmount, 0)` commented out -> `Error: reduced motion: lava, Expected: true Received: false`.
   - RED 2: Kit.tsx `coralMotion.current.value = motionAmount` commented out -> `Error: reduced motion: coral ... Received: false`.
   - Both restored; GREEN again. (Dropping `MotionContext` gives the default flags, motion 1, so it fails the same assertions.)
2. **Stuck bubble hover** (`OrbButtons.tsx`): an effect clears `bubblePointer.hovered`, the hover id and its timer when `open` goes false. No test: the repo has no DOM test environment (vitest is node-only), so a component test is not possible without adding jsdom.
3. **TechTooltip.tsx**: `TOOLTIP_ANCHOR` moved above the component's JSDoc.
4. **Floor.tsx**: comment above `floorGlsl` explaining `#define uMotion uMotionV.x` (the shared lava term reads `uMotion`, the floor uniform is a vec2). It sits in JS, not in GLSL text; no shader text changed.

Commands: `npm test` 57 files, 338 tests pass (was 334 files count 56/334 at Task 10; no new vitest file); `tsc -p tsconfig.nox3d.json` and `tsc -p tsconfig.app.json` exit 0; oxlint on OrbButtons, TechTooltip, Floor, the spec: 4 warnings, identical to HEAD (OrbButtons 3, Floor 1); `npx playwright test -c playwright.nox3d.config.ts`: 9 passed (8 + the new one).
