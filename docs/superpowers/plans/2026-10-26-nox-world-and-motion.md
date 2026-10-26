# Nox World, Physics and Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the approved Nox into a real underwater 3D world without washing him out, give his arms water physics, make him swim like an octopus, and rebuild the entrance, technology bubbles and head swell as planned sequences.

**Architecture:**
- **Nox:** the approved code-built character stays. His skin shader gains world accents with hard caps, plus an aura and a local grade, so the world never replaces his own lighting.
- **World:** a `WorldConfig` names a Blender kit, a layout (JSON, shared by TypeScript and Blender), palette, lights, baked lightmaps and a layered far plate.
- **Arms:** a fixed-step physics layer sits between `ArmChain`'s pose and the drawn tube.
- **Motion:** big moments are Theatre.js sequences stored as JSON in the repo; small motions are code.

**Tech Stack:**
- **App:** React 19, TypeScript, Vite 8, three 0.186.1, @react-three/fiber 9, @react-three/postprocessing 3, @react-three/drei 10.7.9, @theatre/core 0.7.2 (with @theatre/studio 0.7.2 in development only).
- **Assets:** Blender 5.2 through Blender MCP, and `@gltf-transform/cli` for compression.
- **Tests:** Vitest for pure logic; Playwright on system Edge for end-to-end tests and stills.
- **Checks:** Python 3 with Pillow and NumPy.

**Spec:** `docs/superpowers/specs/2026-10-26-nox-world-and-motion-design.md`. Read it before any task.
- **Older docs:** the 2026-10-23 design and plan only list features. Method, targets and checks come from the new spec.

## Global Constraints

- **Where to work:** `C:/Users/Dell/Desktop/Vibe-coding/OctoVerse/worktrees.local/nox-3d-spike`, branch `feat/nox-3d`.
  - **Main checkout:** never edited, reset or restored. Files are only copied from it.
  - **Stash:** never use a bare `git stash`.
- **Anatomy:** exactly eight arms, T1 to T8. Technology count never determines anatomy.
- **Colour pipeline:** Canvas `flat`, no tone mapping. Bloom handles the highlights.
- **Nox's own lighting:** his neon border, glowing concave suckers, face glow, key, rim, halo and palette come from his `CharacterConfig`.
  - The world never dims, greys or tints them.
  - **World warmth:** side and underside only, so no region of Nox is more than 10% brighter in total.
  - **Caustics:** at most 5% brightness.
  - **Haze:** only beyond 18 units from the camera.
- **Colour targets** (section 9.1), checked by `python scripts/check_stage.py <capture> --world`:
  - **Silhouette mean:** within 10 RGB per channel of (119, 23, 79).
  - **Saturation:** 0.85 to 0.91. **Brightness:** 0.49 to 0.57.
  - **Region samples:** CIE76 delta E of at most 8.
- **HQ panel 2 registration:** world (x, y) maps to px (783.6 + 204.5 x, 495.4 − 204.5 y) in `public/spike/nox-panel2-hq.jpg` (1536 × 1024).
- **Physics:**
  - fixed 120 steps per second;
  - stretch at most 2%;
  - arms settle within about 1 s after Nox stops;
  - at most 1.5 ms per frame for all eight arms.
  - Freeze and still modes show the pose exactly.
- **Stroke:** recovery 0.45 to 0.6 s, power 0.18 to 0.25 s, glide 0.4 to 0.8 s. The mantle fills about 4% and squeezes about 6%.
- **Entrance beats:**

  | Time | Beat |
  |---|---|
  | 0 to 1 s | murk |
  | 1 to 4.5 s | four or five strokes |
  | 4.5 to 5.5 s | 360° spin on a golden-spiral arc |
  | 5.5 to 6.5 s | settle |

  - Skippable at any moment; plays once per session; none with reduced motion.
- **Performance:**
  - The tier picked on the owner's laptop holds at least 30 fps. Tier high is picked only where it holds at least 45 fps.
  - **Regression floors:** the intro with the full world reaches at least 27 fps at tier high and 36 fps at tier low.
  - **How to measure:** 1536 × 1024, pixel ratio 1, back to back, with the browser pane closed.
- **No videos:** no clips, frame sequences or motion contact sheets in any step.
  - Check motion with single stills (`?freeze&t=<s>`), screenshots in the browser pane, numbers and tests.
  - The owner watches motion live.
- **Owner approval:** each milestone ends with the owner's live review.
  - The next milestone starts only after approval.
  - When presenting, name the remaining weaknesses yourself.
- **Approved artwork:** any change to an approved character component goes to the owner as a component review before it lands.
- **Blender:** reach it only through Blender MCP on localhost port 9876, with telemetry off.
  - Do not use generators or asset libraries.
  - Run repo scripts with `exec(open(path, encoding="utf-8").read())`.
- **Dev server:** `preview_start` with the name `nox-3d-spike` serves the worktree on port 5191. Captures use `http://localhost:5191`.
- **Captures:** go to `spike-out/` (git-ignored). Evidence that is kept is copied to `docs/superpowers/reviews/assets/`.
- **Commits:** one per approved milestone, plus checkpoints when useful. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Discontinuities reaching the physics:** skipping mid-entrance, an instant stage change under reduced motion, a tier rebuild, or returning to a tab hidden for minutes.
   - **Expected:** the arms land in the pose. No whip, stretch or explosion.
   - **Test:** Task 14, `snaps to the pose after a jump or a stall`.
2. **Extreme window shapes with the hovering camera** (2560 × 1080, and 390 × 844 portrait).
   - **Expected:** the world fills the frame, and no plate edge or void shows at the widest hover.
   - **Tests:** Task 9, `far plate cards cover the frustum at full hover`; Task 27, `wide and tall windows show no void at full hover`.
3. **A pointer resting still while bubbles orbit under it.**
   - **Expected:** a bubble drifting under a resting pointer is not chosen. Orbits ease to still while one is hovered.
   - **Test:** Task 21, `hover intent ignores a bubble moving under a still pointer`.
4. **Rapid choosing:** bubble A, then B within 200 ms, or Escape mid-pull.
   - **Expected:** one bubble held at most. The released one returns to its orbit, and no arm is left reaching.
   - **Test:** Task 23, `retargets mid-pull and never holds two`.
5. **World assets failing to load** (404 or a slow network).
   - **Expected:** Nox, the water, the fog and every control still appear. No blank stage.
   - **Test:** Task 12, e2e `stage stays usable when world assets fail`.

---

## Pattern: milestone review (no videos)

Every milestone's last task ends with these steps.

1. **Checks:** run `npm test`, `npm run typecheck`, and `npx playwright test -c playwright.nox3d.config.ts`, plus the milestone's own measurements. All must pass.
2. **Stills:** take single frames of the moments that matter:
   - `node scripts/world-capture.mjs <stage> spike-out/<name>.png "t=<s>"`;
   - or a browser-pane screenshot.
   - Compare each against the HQ panel at the same size with `python scripts/side_by_side.py`.
3. **Owner live check:**
   - give the owner the local URLs and three to six things to look at;
   - state the known weaknesses;
   - ask: "Approve <milestone> or tell me what to change."
4. **Record** the owner's words, the date and any kept stills in `docs/superpowers/reviews/nox-world.md`, which Task 1 creates.
5. **Commit** with the milestone's message once the owner approves.

## File structure

```
src/nox3d/
  world/
    types.ts             WorldConfig, Placement, WorldLight (Task 2)
    validateWorld.ts     world config checks (Task 2)
    security/            Nox's world: config.ts, layout.json (Tasks 2, 6)
    WorldScene.tsx       mounts a WorldConfig: kit, lights, water, floor, far plate (Task 2)
    Kit.tsx  Floor.tsx  Water.tsx  Motes.tsx  SurfaceLight.tsx   ported from src/spikeEnv (Task 2)
    caustics.ts  textures.ts  noise.ts  worldTime.ts             ported (Task 2)
    cameraHover.ts                                               (Task 8)
    FarPlate.tsx  farPlate.ts                                    (Task 9)
    lensShift.ts                                                 (Task 10)
    worldTiers.ts                                                (Task 11)
  character/
    worldAccent.ts       accent caps, masks, light picking, GLSL chunk (Task 3)
    auraMaterial.ts  Aura.tsx                                    (Task 4)
  post/localGradeEffect.ts                                       (Task 4)
  physics/
    armPhysics.ts  fixedStep.ts  drawArm.ts                      (Task 13)
    useArmPhysics.ts                                             (Task 14)
  motion/
    stroke.ts  micro.ts                                          (Tasks 16, 25)
  sequences/
    theatre.ts  keys.ts  entrance.ts  bubbleBlow.ts  headSwell.ts  (Tasks 17-24)
    state/octoverse.theatre.json                                 (Task 17)
  artifacts/
    bubbleOrbits.ts  suctionHold.ts  TechBubbles.tsx             (Tasks 21-23)
  stage/liveAnchors.ts                                           (Task 8)
blender/security/  build_kit.py  bake_world.py  render_far.py    (Tasks 6, 7, 9)
public/nox/world/security/  kit.glb  near.glb  far-*.ktx2        (Tasks 6, 7, 9)
scripts/  world-capture.mjs  check_stage.py (--world)  world_samples.json  perf.mjs
          side_by_side.py  theatre-seed.mjs
```

---

## Milestone 1: Nox's look in the world (first priority)

### Task 1: The world colour check

**Files:**
- Create: `scripts/world-capture.mjs`, `scripts/world_samples.json`, `docs/superpowers/reviews/nox-world.md`
- Move: `spike-env/side_by_side.py` to `scripts/side_by_side.py`
- Modify: `scripts/check_stage.py` (add `--world`)

**Interfaces:**
- **Produces:**
  - **Capture:** `node scripts/world-capture.mjs <stage> <out.png> [extra query]`. It captures `/?stage=<stage>&freeze&world&view=-3.8318,2.4225,3.6792,-2.5848[&extra]` at 1536 × 1024, scale 1, and writes `<out>-mask.png` from the same URL plus `&mask`.
    - The view box frames exactly the HQ panel 2 image, so render px = HQ px.
    - Until Task 2, `world` is ignored and the capture shows the painted plate.
  - **Check:** `python scripts/check_stage.py <out.png> --world [--stage intro]`.
    - **Silhouette:** mean RGB, mean per-pixel HSV saturation and mean per-pixel HSV value inside `<out>-mask.png`, for both the render and the HQ panel 2 (the same mask, the same registration).
    - **Regions:** each sample in `world_samples.json` is a 7 × 7 px patch mean at the HQ px of its world point in both images, compared by CIE76 delta E (sRGB D65 to Lab). Regions are checked for `--stage intro` only.
    - Exits 1 on any miss.
  - **Samples file:** `world_samples.json` holds `{ "target": { "mean": [119, 23, 79], "meanTolerance": 10, "saturation": [0.85, 0.91], "brightness": [0.49, 0.57], "deltaE": 8 }, "regions": { "<name>": [x, y] } }`.
    - It has eight regions: `head crown`, `head middle`, `cheek glow`, `upper arm top`, `arm underside band`, `arm rim`, `suckers`, `aura outside`.

- [ ] **Step 0: Checkpoint the inputs, with the owner's OK.** If they are not committed yet, commit the approved spec, this plan, `HANDOFF.md` and the dependency additions (`@react-three/drei`, `@theatre/core`, `@theatre/studio`) as `docs(nox3d): world and motion design and plan`. Leave the test scene (`src/spikeEnv/`, `spike-env*`, `public/spike-env/`) untracked; Task 12 removes it.
- [ ] **Step 1: Trace the regions.**
  - Run `python scripts/ref_grid.py <box> spike-out/ref-<region>.png` over each region on panel 2.
  - Pick a world point that lies inside the region on both the HQ panel and the intro capture's mask, at least 4 px from its edge. `aura outside` lies 6 to 10 px outside the mask, above the head.
  - Write the eight points.
- [ ] **Step 2: Calibrate on known images.** Capture the approved stage: `node scripts/world-capture.mjs intro spike-out/approved.png`. Then run:
  - `python scripts/check_stage.py public/spike/nox-panel2-hq.jpg --world --mask spike-out/approved-mask.png`
    - **Expected:** PASS, with mean (119, 23, 79) ± 2, saturation 0.88 ± 0.02 and brightness 0.53 ± 0.02.
    - `--mask` names the mask when the image is not a capture.
  - `python scripts/check_stage.py spike-out/approved.png --world`
    - **Expected:** FAIL, with mean (137, 41, 95) ± 3 and saturation 0.76 ± 0.02 (spec section 6).
  - If the numbers differ, fix the measurement, not the targets.
- [ ] **Step 3: Create the review log** `docs/superpowers/reviews/nox-world.md`. Give it a header naming the spec and the milestone list.
- [ ] **Step 4: Commit** as `chore(nox3d): world colour check against HQ panel 2`.

### Task 2: The world in production, behind `?world`

A straight port of the test scene into `src/nox3d/world/`, driven by `WorldConfig`, with no look changes. The stage shows it instead of the painted plate when the URL has `world`.

**Files:**
- Create:
  - `src/nox3d/world/types.ts`, `validateWorld.ts`, `security/config.ts`, `security/layout.json`, `WorldScene.tsx`
  - ports of `src/spikeEnv/` (`World.tsx` as `Kit.tsx`, `Floor.tsx`, `Water.tsx`, `Motes.tsx`, `caustics.ts`, `textures.ts`, `noise.ts`, and the surface light and water environment as `SurfaceLight.tsx`)
  - `worldTime.ts`
- Copy: `public/spike-env/kit.glb` to `public/nox/world/security/kit.glb`
- Modify: `src/nox3d/App.tsx` (render `WorldScene` in place of `Backdrop`, `Bubbles` and `Embers` when `url.world`), `behavior/urlState.ts` (`world: boolean`, `t?: number`)
- Test: `src/nox3d/world/validateWorld.test.ts`, `src/nox3d/behavior/urlState.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export type Vec3 = readonly [number, number, number];
  export interface Placement { piece: string; position: Vec3; rotY?: number; tilt?: number; scale?: number | Vec3; runes?: number; light?: boolean }
  export interface WorldLight { kind: 'glyph' | 'coral' | 'lava'; position: Vec3; color: string; intensity: number; distance: number; skinRange: number }
  export interface WorldLayout { floorY: number; pillars: Placement[]; rocks: Placement[]; corals: Placement[]; chains: { from: Vec3; to: Vec3; sag: number }[]; coralLights: Vec3[] }
  export interface WorldConfig {
    id: string;
    kit: { url: string; pieces: readonly string[] };
    layout: WorldLayout;
    palette: { stone: string; glyph: string; coral: string; lava: string; waterFar: string; floor: string };
    lights: { surface: { color: string; intensity: number; position: Vec3; target: Vec3 }; fill: { color: string; intensity: number; position: Vec3 }; points: WorldLight[] };
    water: { fogDensity: number; surfaceDir: Vec3; environmentIntensity: number };
    live: { snow: number; motes: number; fish: number; rays: number; bubbles: number; embers: number };
  }
  export function validateWorld(world: WorldConfig): string[]   // problems; empty = valid
  export function worldTime(clockSeconds: number, url: { freeze: boolean; t?: number }): number   // freeze: url.t ?? 6
  export const SECURITY_WORLD: WorldConfig;
  ```
- **Layout values:** copied from `src/spikeEnv/layout.ts`. Lights and palette come from `World.tsx`: glyph `PointLight(#ff2436, 1.7, 2.1, 2)` with skinRange 4.4; coral/lava `(#ff3418, 3.4, 5, 2)` with skinRange 6; fog 0.034; environment intensity 0.4.
- **Not yet ported:** `NoxInWorld` and `noxLight.ts` stay in the spike. Task 3 replaces them.

- [ ] **Step 1: Write the failing tests.**
  - `SECURITY_WORLD is valid`: `validateWorld` returns `[]`.
  - `every placement names a kit piece`
  - `a world with an unknown piece or a light without skinRange is reported`
  - `parses world and t`: `?world&t=4.8` gives `{ world: true, t: 4.8 }`; a bad `t` is ignored.
- [ ] **Step 2: Run** `npx vitest run src/nox3d/world src/nox3d/behavior/urlState.test.ts`. **Expected:** FAIL (missing modules).
- [ ] **Step 3: Port and implement.** Keep the spike's shaders and values unchanged. Read every value from `SECURITY_WORLD`.
- [ ] **Step 4: Run the tests again.** **Expected:** PASS. Run `npm run typecheck` (clean).
- [ ] **Step 5: Parity still.** Capture both scenes:
  - `node scripts/world-capture.mjs intro spike-out/world-port.png`
  - `node spike-env/capture.mjs spike-out/spike-ref.png still baseline`
  - **Expected:** the two show the same world. The kit, fog, rays and floor match on visual inspection side by side.
- [ ] **Step 6: Commit** as `feat(nox3d): test-scene world ported behind ?world`.

### Task 3: Nox's own lighting with capped world accents

The skin shader gains world accents as compiled code, not a runtime patch. With every accent at zero, the output is identical to the approved Nox.

**Files:**
- Create: `src/nox3d/character/worldAccent.ts`
- Modify: `character/skinMaterial.ts` (uniforms and GLSL chunk), `character/Octopus.tsx` (cast shadow when in a world), `world/WorldScene.tsx` (feeds accents each frame)
- Test: `src/nox3d/character/worldAccent.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export type RGB = readonly [number, number, number];   // linear, 0..1
  export const WORLD_WARMTH_CAP = 0.1;   // no region more than 10% brighter in total
  export const CAUSTIC_CAP = 0.05;
  export const HAZE_FROM = 18;           // camera distance where depth haze may start
  export const ACCENT_LIGHTS = 8;
  /** Scales `add` so its luminance is at most `cap` times `base`'s. Mirrors the GLSL. */
  export function capAccent(base: RGB, add: RGB, cap: number): RGB
  /** 0 on the face rect, the crown (up-facing normals) and the silhouette edge (low n·v); 1 on sides and underside. */
  export function warmthMask(kind: 'HEAD' | 'ARM' | 'BODY', normalY: number, ndv: number, inFace: number): number
  /** The ACCENT_LIGHTS world lights nearest `at`, farthest first dropped. */
  export function pickAccentLights(lights: readonly WorldLight[], at: Vec3, max?: number): WorldLight[]
  export function createAccentUniforms(): AccentUniforms   // all-zero accents by default
  export const ACCENT_GLSL: string   // declarations + chunk inserted before "// Atmospheric depth"
  ```
- **Shading rules:**
  - Warmth is wrapped diffuse from the picked lights, multiplied by `warmthMask`, then capped by `capAccent(base, add, WORLD_WARMTH_CAP)`.
  - Caustics come from the surface light's cookie on up-facing skin. They are capped at `CAUSTIC_CAP` and allowed on the head top as a shimmer. This is the plan's reading of section 9.1: the crown rule covers warmth.
  - No rim-from-behind term. The spike's `envRim` tinted the neon rim, so it is dropped.
- **Exclusions:** the suckers and the halo get no accents: they are emitters.
- **Haze:** the existing haze applies only where the camera distance is beyond `HAZE_FROM`.
- **Consumes:** `WorldLight` and `Vec3` (Task 2).

- [ ] **Step 1: Write the failing tests.**
  - `capAccent leaves small accents unchanged`
  - `capAccent never adds more than 10% luminance`: over 1000 random base/add pairs, `luma(out) <= 0.1 * luma(base) + 1e-6`.
  - `caustics are capped at 5%`
  - `warmth mask is zero on the face, the crown and the rim, one on the underside`: `warmthMask('HEAD', 0.9, 0.8, 0) === 0`, `warmthMask('HEAD', -0.5, 0.8, 1) === 0`, `warmthMask('ARM', -0.6, 0.05, 0) === 0`, `warmthMask('ARM', -0.6, 0.8, 0) === 1`.
  - `picks the eight nearest lights`
  - `zero accents leave the shader output unchanged`: the GLSL chunk multiplies everything by uniforms that default to zero, as a string check.
- [ ] **Step 2: Run** `npx vitest run src/nox3d/character/worldAccent.test.ts`. **Expected:** FAIL.
- [ ] **Step 3: Implement**, mirroring `capAccent` and `warmthMask` in GLSL.
- [ ] **Step 4: Run the tests again.** **Expected:** PASS.
- [ ] **Step 5: No regression without a world:**
  - `node scripts/stage-capture.mjs intro spike-out/accent-off.png`
  - `python scripts/check_stage.py spike-out/accent-off.png --panel 2`
  - **Expected:** exit 0, with the same deltas as before the change.
- [ ] **Step 6: Measure in the world:** `node scripts/world-capture.mjs intro spike-out/accent-on.png`, then `python scripts/check_stage.py spike-out/accent-on.png --world`.
  - Record the numbers in the review log.
  - They must be no worse than the spec's "Nox unlit by the world" row (138, 42, 97 / 0.75 / 0.58). Task 5 closes the gap to the targets.
- [ ] **Step 7: Commit** as `feat(nox3d): world accents on Nox, capped, own lighting kept`.

### Task 4: The aura, Nox's light on the world, and the local grade

**Files:**
- Create: `src/nox3d/character/auraMaterial.ts`, `character/Aura.tsx`, `src/nox3d/post/localGradeEffect.ts`
- Modify:
  - `config/types.ts`: `GlowShape.aura`, `GlowShape.grade`
  - `config/nox.character.ts`
  - `config/validate.ts`
  - `character/Octopus.tsx`: mounts `Aura` and the glow point light when in a world
  - `App.tsx`: adds `LocalGrade` to the composer when in a world
- Test: `src/nox3d/character/auraMaterial.test.ts`, `src/nox3d/post/localGradeEffect.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export interface AuraSettings { inner: string; low: string; radius: number; strength: number }  // GlowShape.aura
  export interface GradeSettings { color: string; radius: number; strength: number }              // GlowShape.grade; radius 3 for Nox
  export function auraColour(dy: number, aura: AuraSettings): RGB   // magenta-violet at and above the body centre, deep red below
  export function gradeWeight(distance: number, grade: GradeSettings): number   // 1 at Nox, 0 at radius, smooth
  export class LocalGradeEffect extends Effect { constructor(grade: GradeSettings); setNox(screen: Vector2, depth: number, radiusPx: number): void }
  ```
- **Aura:** a camera-facing card behind Nox (just behind the rear arms, z −0.8 in body space), with additive blending, no depth write, moving with the body. The size and falloff are the builder's choice (spec section 12).
- **Glow light:** the spike's `PointLight('#ff4a30', 5, 6, 2)` at the face glow, offset (0, −0.42, 0.5). It lights the seabed, nearby stone, particles and bubbles.
- **Grade:** a full-screen effect. Only fragments behind Nox's depth plus 0.3 are darkened and warmed toward `grade.color`, by `gradeWeight` of their screen distance from Nox, scaled to world units at his depth.
- **Starting values for Nox:**
  - aura: inner `#c83ce8`, low `#a0102c`, radius 1.6, strength 0.5;
  - grade: color `#1c0618`, radius 3, strength 0.55.
  - Task 5 tunes them.

- [ ] **Step 1: Write the failing tests.**
  - `aura is magenta-violet above and deep red below`: hue checks on `auraColour(0.5)` and `auraColour(-1.2)`.
  - `grade weight is 1 at Nox and 0 beyond its radius, monotonic`
  - `the config validator clamps aura and grade strengths to 0..1`
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS:** `npx vitest run src/nox3d/character/auraMaterial.test.ts src/nox3d/post`
- [ ] **Step 3: Measure:** `node scripts/world-capture.mjs intro spike-out/aura.png`, then `python scripts/check_stage.py spike-out/aura.png --world`. Record the numbers.
- [ ] **Step 4: Commit** as `feat(nox3d): aura, glow light and local grade round Nox`.

### Task 5: Meet the colour targets (milestone 1 review)

**Files:**
- Modify: `config/nox.character.ts` (aura, grade, and only if needed the palette), `scripts/world_samples.json` (never the targets)

- [ ] **Step 1: Tune the background and accents, in this order.** Re-run `world-capture` and `check_stage --world` after each change.
  1. **Aura and grade:** strength, radius and colours.
  2. **Accent strengths:** within the caps.
  3. **Glow light** intensity.
- [ ] **Step 2: Only if the targets are still missed, propose a palette change.**
  - Typical change: less green in `armBody`, `headEdge`, `cheek` and the glow ramp's mid stops.
  - **Show the owner a component review:** HQ panel 2, the approved stage and the new version, side by side at the same size (`python scripts/side_by_side.py`), plus the numbers.
  - **Apply it only after approval.** The change then holds in every stage.
- [ ] **Step 3: Check every stage.**
  - **Intro:** run `check_stage --world` on `intro` with the full check.
  - **Other stages:** `overview`, `techFocus` (extra `tech=kali&solo`) and `detail` (extra `solo`) run with `--stage <id>`, which checks the mean, saturation and brightness only.
  - **Expected:** exit 0 for all four.
  - `solo` hides the bubbles and the dome glass, for measurement only. Add it to `urlState` with a test.
- [ ] **Step 4: Owner live check** (see Pattern: milestone review).
  - **URLs:** `http://localhost:5191/?world`, `?world&stage=overview` and `?world&stage=detail`.
  - **Look for:**
    - the deep violet body and saturated magenta rim against the dark red-violet glow;
    - the glowing concave suckers (bright rims, dark hollows);
    - the face glow is untouched;
    - warmth only on the sides and underside;
    - faint caustics;
    - Nox's shadow on the seabed.
- [ ] **Step 5: Record and commit** as `feat(nox3d): Nox keeps the panel 2 look in the world`.

---

## Milestone 2: The world in production

### Task 6: Shared layout, kit rebuild and compression

**Files:**
- Create:
  - `blender/security/build_kit.py`, moved from `spike-env/blender/build_kit.py` and extended
  - `src/nox3d/world/security/layout.json`, now the single source: TypeScript imports it and Blender reads it
- Modify: `world/security/config.ts`, `world/Kit.tsx` (LOD), `package.json` (devDependency `@gltf-transform/cli`)
- Output: `public/nox/world/security/kit.glb`, compressed
- Test: `src/nox3d/world/validateWorld.test.ts`

**Interfaces:**
- **Kit:**
  - **Pieces:** keep `pillar_a` to `pillar_d`, `rock_0` to `rock_4`, `coral_0` to `coral_2` and `chain`.
  - **Stone:** large carved blocks, not brickwork.
  - **Glyph panels:** their size, wear and brightness vary by a seeded hash per panel.
  - **LOD:** each piece exports `<piece>` and `<piece>_lod1` (about 25% of the triangles). `Kit.tsx` swaps to `_lod1` beyond 14 units from the camera.
- **Compression:** `npx gltf-transform optimize in.glb public/nox/world/security/kit.glb --compress meshopt --texture-compress ktx2`.
  - KTX2 needs KTX-Software (`toktx`). If it is missing, ask the owner to install it. Do not install it yourself.
  - Until it is installed, use `--texture-compress webp` and record the deviation in the review log.
- **Loader:** `GLTFLoader` with `MeshoptDecoder` and `KTX2Loader`, transcoder files under `public/nox/basis/`.
- **Size target (plan call):** all world assets together at most 6 MB transferred.

- [ ] **Step 1: Write the failing tests.**
  - `layout.json matches the WorldLayout schema`
  - `every piece has a lod1`
  - `pillars keep the open corridor: no pillar inside |x| < 2.9 for z between -30 and 2`
- [ ] **Step 2: Run, see FAIL.**
- [ ] **Step 3: Build the kit in Blender.** Run the script through Blender MCP. Check each piece with `look` at max_size 512.
- [ ] **Step 4: Export, compress and load.** Run, see PASS. Then `world-capture intro`, compared side by side with Task 2's still.
- [ ] **Step 5: Commit** as `feat(nox3d): shared world layout and compressed kit with LODs`.

### Task 7: Baked light and brighter relics

**Files:**
- Create: `blender/security/bake_world.py`. It assembles `layout.json` in Blender with the kit, glyph emitters and lava, bakes the lighting, and exports `public/nox/world/security/near.glb`.
- Modify: `world/types.ts` (`near?: { url: string }`), `world/Kit.tsx` (use `near.glb` when present), `world/security/config.ts`

**Interfaces:**
- **Bake:**
  - Cycles bakes the glyph, lava and surface light, plus ambient occlusion, into a lightmap on UV2 for each placed instance of stone, rock and coral, and for the floor.
  - Lightmap resolution is the builder's choice (spec section 12).
  - At runtime, stone materials use `lightMap` (UV2). The glyph and coral point lights no longer light stone, so their `PointLight`s are removed.
  - They remain as `WorldLight` data for Nox's accents (Task 3).
- **Real-time lights left:** only the surface spot light (its caustic cookie and Nox's shadow) and Nox's glow light. The fill is baked too.
- **Relics:** the glyph panels, rune pillars and glowing coral glow 15 to 25% more than in the test scene: emission, bloom presence and the red spill baked onto the stone. Start at 20%.

- [ ] **Step 1: Write the failing tests.**
  - `world config with near.glb lists no stone point lights`
  - `relic emission is 1.15 to 1.25 times the test scene's`: config values against the spike constants.
- [ ] **Step 2: Bake and export through Blender MCP.** Check with `look`.
- [ ] **Step 3: Run the tests.** **Expected:** PASS.
- [ ] **Step 4: Compare:** `world-capture intro`, side by side with panel 2. The relics read a little brighter and never pull attention from Nox.
- [ ] **Step 5: Re-check Nox's targets** with `check_stage --world`. **Expected:** PASS.
- [ ] **Step 6: Commit** as `feat(nox3d): baked world light, relics a little brighter`.

### Task 8: Camera hover and live anchors

**Files:**
- Create: `src/nox3d/world/cameraHover.ts`, `src/nox3d/stage/liveAnchors.ts`
- Modify: `App.tsx` (`StageCamera`), `ui/IntroOverlay.tsx`, `ui/ExploreNameplate.tsx`, `ui/OverviewPanel.tsx`, `ui/OrbButtons.tsx`, `ui/TechTooltip.tsx`, `behavior/urlState.ts` (`hover?: Vec3`, for stills)
- Test: `src/nox3d/world/cameraHover.test.ts`, `src/nox3d/stage/liveAnchors.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  /** The test scene's drift: position offset (0.9 sin 0.23t, 0.3 sin(0.17t + 1), 1.2 sin 0.11t) and look offset (0.3 sin 0.23t, -0.05, -24), times `amount`. */
  export function cameraHover(t: number, amount: number): { offset: Vec3; look: Vec3 }
  /** Target hover amount: intro and entering 1, overview 0.5, techFocus and detail 0; 0 while a bubble is hovered, and with reduced motion. */
  export function hoverTarget(stage: StageId, bubbleHovered: boolean, reducedMotion: boolean): number
  export const HOVER_EASE_S = 0.6;   // eases to a new target within this time
  /** Per-frame screen shift (CSS px) of a world anchor between the unhovered stage camera and the live camera. */
  export class LiveAnchors { set(camera: THREE.Camera, base: THREE.Camera, size: { width: number; height: number }): void; shift(world: Vec3): { dx: number; dy: number }; subscribe(cb: () => void): () => void }
  export function useAnchorShift(ref: RefObject<HTMLElement>, world: Vec3): void   // writes style.translate each frame, no React render
  ```
- **Plan call:** the entrance uses the intro's amount (1); spec section 9.2 does not list it.
- **Layout:** overlays keep today's static layout (`useStageBox`, `orbSpots`) and add the live shift, so the existing layout tests stay valid.
- **Freeze:** `freeze` gives amount 0 unless `?hover=x,y,z` sets the offset.

- [ ] **Step 1: Write the failing tests.**
  - `hover amounts by stage`
  - `hover eases to still within 0.6 s when a bubble is hovered`
  - `reduced motion has no hover`
  - `anchor shift is zero with no hover and equals the projected delta with it`
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS:** `npx vitest run src/nox3d/world/cameraHover.test.ts src/nox3d/stage/liveAnchors.test.ts`
- [ ] **Step 3: Check the overlays** in the browser pane at `?world`: the title and nameplate stay attached to Nox through the drift, judged on two screenshots taken 3 s apart.
- [ ] **Step 4: Commit** as `feat(nox3d): default camera hover with live HTML anchors`.

### Task 9: The layered far plate

**Files:**
- Create: `blender/security/render_far.py`, `src/nox3d/world/farPlate.ts`, `world/FarPlate.tsx`
- Modify: `world/types.ts` (`farPlate?: { layers: readonly { url: string; z: number }[] }`), `world/security/config.ts`
- Output: `public/nox/world/security/far-0.ktx2` to `far-2.ktx2` (or `.webp`, as in Task 6)
- Test: `src/nox3d/world/farPlate.test.ts`

**Interfaces:**
- **Layers:** three, rendered from the panel 2 camera with film transparent:
  - z −12 to −20 at z −16;
  - −20 to −34 at −27;
  - beyond −34 at −45.
- **Transparency:** only ruin pieces are opaque. The open corridor water stays transparent, so the live fog and sky show through and the entrance swim (Task 19) is never hidden behind a card.
- **Live cut:** live pieces beyond z −12 are removed from the near world.
- **Produces:**
  ```ts
  /** Card width and height at depth z so it covers the frustum with the camera displaced by up to `hover` (world units), plus `overscan`. */
  export function plateCardSize(z: number, camera: { z: number; fovDeg: number; aspect: number }, hover: Vec3, overscan?: number): { width: number; height: number }
  ```

- [ ] **Step 1: Write the failing tests.**
  - `far plate cards cover the frustum at full hover`. This is Review Focus 2: aspects 2560/1080 and 390/844, hover (0.9, 0.3, 1.2).
  - `layers are ordered far to near`
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS:** `npx vitest run src/nox3d/world/farPlate.test.ts`
- [ ] **Step 3: Render the layers through Blender MCP.**
- [ ] **Step 4: Check stills at three hover offsets** (Task 8's `?hover=` sets the offset for a still): `world-capture intro spike-out/far-<n>.png "hover=<x,y,z>"`.
  - **Expected:** layers line up with the live floor, and no seam or edge shows.
- [ ] **Step 5: Commit** as `feat(nox3d): layered far plate`.

### Task 10: Look fixes from the test scene

**Files:**
- Create: `src/nox3d/world/lensShift.ts`
- Modify:
  - `App.tsx`: `StageCamera` applies the tilt and lens shift in framed mode
  - `world/Floor.tsx`, `world/Water.tsx`, `world/security/config.ts`, `blender/security/bake_world.py`
- Test: `src/nox3d/world/lensShift.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  /** Camera pitch up by `tilt` and the vertical view offset (fraction of frame height) that keeps the point `keep` at the same screen place. */
  export function lensShift(tilt: number, keep: Vec3, camera: { position: Vec3; fovDeg: number }): { pitch: number; offsetY: number }
  ```
- **`WorldConfig.camera`:**
  - `{ tilt: number }`, starting at 0.07 rad, tuned until the pillars converge as in panel 2.
- **Fixes**, each checked against panel 2 at the same size:
  - **Lower third:** more lava glow, rock heaps lit red from behind (baked), denser embers.
  - **Top:** a brighter cyan opening and more rays fanning down.
  - **Water:** ambient bubbles drift through it (the existing `Bubbles`, scaled by `live.bubbles`).
  - **Live motion** (section 9.2, part 5): the floor lava pulses slowly and the coral sways, each with a vertex or emissive term, off under reduced motion.

- [ ] **Step 1: Write the failing tests.**
  - `lens shift keeps Nox's face at the same screen place`: within 0.5 px at 1536 × 1024.
  - `zero tilt gives zero offset`
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 3: Apply the fixes.** After each, take `world-capture intro` and run `python scripts/side_by_side.py spike-out/look.png spike-out/look-vs-p2.png`.
- [ ] **Step 4: Re-check Nox's targets.** **Expected:** `check_stage --world` PASS.
- [ ] **Step 5: Commit** as `feat(nox3d): world look fixes (lean, lava, top, stone, glyphs, bubbles)`.

### Task 11: Performance tiers for the world

**Files:**
- Create: `src/nox3d/world/worldTiers.ts`, `scripts/perf.mjs` (from `spike-env/perf.mjs`; measures `/?stage=<s>&tier=<t>` after `window.__noxReady`)
- Modify: `stage/quality.ts` (thresholds), `App.tsx` (sets `window.__noxReady` 40 frames after the world loads), the world components (read the tier)
- Test: `src/nox3d/stage/quality.test.ts`, `src/nox3d/world/worldTiers.test.ts`

**Interfaces:**
- **Thresholds:** `SLOW_MS` becomes `{ high: 22.2, medium: 33.3, low: Infinity }` (45 fps and 30 fps).
- **Produces:**
  ```ts
  export interface WorldTier { particles: number; rays: number; shadowMap: number; plateScale: number; fish: boolean; motes: boolean }
  export const WORLD_TIERS: Record<QualityTier, WorldTier>;   // high { 1, 1, 2048, 1, true, true }, medium { 0.6, 0.6, 1024, 0.75, true, false }, low { 0.35, 0.4, 1024, 0.5, false, false }
  ```
- **Budget** (section 9.13): intro with the full world at tier high at least 27 fps, tier low at least 36 fps. The tier picked on the owner's laptop must hold at least 30 fps.
- **Levers, in order:**
  1. Shadow map size, and casting from Nox only.
  2. Ray count.
  3. Particle density.
  4. Bloom resolution.
  5. Far plate resolution.
  6. LOD distance.
  7. The contact-shadow pass at tier high.

- [ ] **Step 1: Write the failing tests.**
  - `high demotes below 45 fps, medium below 30`
  - `world tiers scale down monotonically`
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 3: Measure** with the browser pane closed, back to back: `node scripts/perf.mjs "stage=intro&tier=high" "stage=intro&tier=low" "stage=overview&tier=high"`.
  - Record all numbers in the review log, including misses.
  - Apply the levers until the budget is met. Report honestly if it is not.
- [ ] **Step 4: Commit** as `perf(nox3d): world quality tiers within the laptop budget`.

### Task 12: The world becomes the stage (milestone 2 review)

**Files:**
- Modify:
  - `App.tsx`: the world is always on; `?world` is removed from `urlState`, with its test
  - `scripts/world-capture.mjs`: drop `world` from the query
  - `scripts/stage_samples.json`: panels 3 to 5 keep composition only (silhouette rows and Nox position); panel 1 is removed
- Delete:
  - `src/nox3d/world/Backdrop.tsx`, `public/spike/plate-nox.png` (if unused)
  - `src/spikeEnv/`, `spike-env.html`, `spike-env/capture.mjs`, `clip.mjs`, `perf.mjs`
  - Keep `spike-env/out/` untracked. Copy its PNGs to `docs/superpowers/reviews/assets/world-test-scene/`. The `.mp4` files stay until the owner says to delete them.
- Test: `tests/e2e/world.spec.ts`

- [ ] **Step 1: Write the failing e2e test** `stage stays usable when world assets fail` (Review Focus 5):
  - route-abort `**/nox/world/**`, then load `/`;
  - expect the canvas, the "Skip intro" button, then the intro heading;
  - `/?stage=overview` shows the orb buttons.
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS:** `npx playwright test -c playwright.nox3d.config.ts`
  - Assets load under `Suspense`, with Nox and the water outside it.
- [ ] **Step 3: Re-baseline composition.**
  - Panels 3 and 5 checks: `node scripts/stage-capture.mjs overview spike-out/p3.png`, then `python scripts/check_stage.py spike-out/p3.png --panel 3`.
  - Panel 4: `node scripts/stage-capture.mjs techFocus spike-out/p4.png "tech=kali"`, then `python scripts/check_stage.py spike-out/p4.png --panel 4`.
  - Detail: `node scripts/stage-capture.mjs detail spike-out/p5.png`, then `python scripts/check_stage.py spike-out/p5.png --panel 5`.
  - **Expected:** exit 0.
- [ ] **Step 4: Owner live check.**
  - **URL:** `http://localhost:5191/` with `?stage=intro`, `overview` and `detail`.
  - **Look for:**
    - the world reads as in the test scene, now with the pillar lean, lava, top opening, carved stone, varied glyphs and brighter relics;
    - the slow hover;
    - frame rate on the laptop.
  - Give the measured fps.
- [ ] **Step 5: Record and commit** as `feat(nox3d): every stage in the 3D world`.

---

## Milestone 3: Water physics for the arms

### Task 13: The physics core

**Files:**
- Create: `src/nox3d/physics/armPhysics.ts`, `physics/fixedStep.ts`, `physics/drawArm.ts`
- Modify: `config/types.ts` (`Personality.water`), `config/nox.character.ts`, `config/validate.ts`
- Test: `src/nox3d/physics/armPhysics.test.ts`, `fixedStep.test.ts`, `drawArm.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export interface WaterFeel { drag: number; stiffness: number; tipSoftness: number }  // Personality.water; Nox { drag: 3.2, stiffness: 140, tipSoftness: 2.2 } as a start
  export const PHYSICS_NODES = 16;
  export const PHYSICS_HZ = 120;
  /** Node positions (world space); node 0 is kinematic (the root). */
  export class ArmPhysics {
    readonly x: Float32Array; readonly y: Float32Array; readonly z: Float32Array;
    constructor(feel: WaterFeel, nodes?: number);
    snapTo(target: NodeTargets): void;
    step(target: NodeTargets, h: number): void;
  }
  export interface NodeTargets { x: Float32Array; y: Float32Array; z: Float32Array; segment: Float32Array }  // pose node positions and rest segment lengths
  /** Calls `step(h)` at PHYSICS_HZ for the elapsed time, at most 8 steps; returns 'stall' when dt > 0.25 s (the caller snaps). */
  export class FixedStepper { advance(dt: number, step: (h: number) => void): number | 'stall' }
  /** The drawn arm: the pose's 129 points plus the node displacement (physics - pose), interpolated smoothly along the arc, so it passes through every node and keeps the pose's fine curls between them. */
  export function drawArm(pose: ChainPoints, poseNodes: NodeTargets, phys: ArmPhysics, out: ChainPoints): void
  export interface ChainPoints { px: Float32Array; py: Float32Array; pz: Float32Array }
  ```
- **Integrator:** semi-implicit Euler with pose springs. Stiffness falls from root to tip as `stiffness * (1 - s)^tipSoftness + stiffness * 0.04`.
  - Linear water drag on velocity.
  - Then 4 position-based passes hold each segment at its rest length.
- **Mantle:** the node `pushOutOfMantle` keeps visible nodes (s > 0.25) outside the head ellipsoid (half-width 0.752, depth 0.62, y −1.2 to 0.255, in body space).
  - This is applied by the caller (Task 14), which owns the transform.
  - The function lives here and is tested here.

- [ ] **Step 1: Write the failing tests.**
  - `energy decays`: released 0.3 off pose with no input, the kinetic energy at 2 s is under 1% of its peak.
  - `never stretches beyond 2%`: random root jerks of up to 6 units/s for 10 s; every segment stays within ±2% of its rest length.
  - `tips trail opposite the motion`: the root moves +z at 2 units/s; the tip's z lags the pose tip by at least 0.15 and more than the middle node's.
  - `settles within about 1 s with a slight overshoot`: after the root stops, the tip crosses the pose once (overshoot at most 15% of the lag) and is within 0.01 by 1.2 s.
  - `stable at large time steps`: steps of 1/30 for 10 s stay finite and within 2% stretch.
  - `same input, same motion`
  - `at rest it adds only lag`: with the pose swaying at 0.5 Hz, the tip stays within 0.03 of the pose tip and its mean offset over 20 s is under 0.005, so no jitter and no drift.
  - `pushes visible nodes out of the mantle`
  - `fixed stepper runs 120 steps per second, at most 8 per call, and reports a stall`
  - `drawArm passes through every node and equals the pose when the physics rests on it`
- [ ] **Step 2: Run** `npx vitest run src/nox3d/physics`. **Expected:** FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run again.** **Expected:** PASS. Also run a 600-frame timing loop over 8 arms in a test, `physics for eight arms stays under 1.5 ms a frame`, with the mean asserted in Node.
- [ ] **Step 5: Commit** as `feat(nox3d): arm water physics core`.

### Task 14: Physics on every arm, in every stage (milestone 3 review)

**Files:**
- Create: `src/nox3d/physics/useArmPhysics.ts`
- Modify: `character/Octopus.tsx` (after `chain.solve` and before `tube.update`), `App.tsx` (signals a discontinuity on skip and on reduced-motion stage changes)
- Test: `src/nox3d/physics/useArmPhysics.test.ts` (logic split into a pure `ArmPhysicsRig` class)

**Interfaces:**
- **Consumes:** `ArmPhysics`, `FixedStepper`, `drawArm` (Task 13); `ArmChain.px/py/pz` and `pointAt` (existing).
- **Produces:**
  ```ts
  /** One per Octopus: eight ArmPhysics in world space. Each frame: pose nodes from the solved chains through content.matrixWorld, stepped, drawn back into each chain's px/py/pz in content space. */
  export class ArmPhysicsRig {
    constructor(chains: readonly ArmChain[], feel: WaterFeel);
    update(dt: number, toWorld: Matrix4, toLocal: Matrix4, mode: 'live' | 'pose'): void;
    snap(): void;          // next update lands on the pose
    readonly lastMs: number;   // CPU time of the last update
  }
  ```
- **Mode:** `'pose'` covers freeze, `?t` stills and the mask. It writes nothing, so the pose shows exactly.
- **Snap:** happens on a skip, a stage change with zero duration, a tier rebuild, a `'stall'`, or a root jump of more than 0.5 units in one frame.
- **Dev only:** `window.__physicsMs` holds a rolling mean of `lastMs`.

- [ ] **Step 1: Write the failing tests.**
  - `snaps to the pose after a jump or a stall` (Review Focus 1)
  - `pose mode leaves the chains untouched`
  - `a stage change shows follow-through`: during a blended intro-to-overview change, the tip's arrival lags the root's by at least 80 ms.
  - `arms keep their clearance through stage changes`: over intro to overview to detail, the minimum distance between visible nodes (s > 0.3) of different arms never drops below the unphysicked blend's minimum minus 0.05.
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 3: No regression at rest:**
  - `node scripts/world-capture.mjs intro spike-out/phys.png`, then `check_stage --world`. **Expected:** PASS.
  - Run panels 3 to 5 composition, plus `stage-capture` and `check_stage --panel 2`. **Expected:** exit 0.
- [ ] **Step 4: Measure** `__physicsMs` in the browser pane over 10 s in the intro and the overview. **Expected:** at most 1.5 ms.
- [ ] **Step 5: Owner live check.**
  - **URLs:** `/?stage=intro`, then Explore, Escape and the detail view.
  - **Look for:**
    - arms trail and follow through on stage changes;
    - a slight lag on ambient sway, never jitter or drift;
    - nothing passes through the head.
  - **Also ask the still-open question:** should each arm's cup side be fixed from the intro pose?
- [ ] **Step 6: Record and commit** as `feat(nox3d): water physics on every arm`.

---

## Milestone 4: The back view

### Task 15: Back view review and fixes (milestone 4 review)

**Files:**
- Modify:
  - `behavior/urlState.ts`: `yaw?: number`, in degrees, rotating the body for stills
  - `character/Octopus.tsx`
  - `review/components.ts` and `review/main.tsx`: component `back` shows front, three-quarter (45°), side (90°) and back (180°) side by side
  - `character/headGeometry.ts`, `character/skinMaterial.ts`, `character/haloMaterial.ts`, as the review finds
- Test: `src/nox3d/character/headGeometry.test.ts`, `skinMaterial.test.ts`

**Interfaces:**
- **Produces:**
  - **Face weight:** the face texture's projection is masked by `faceWeight(normalZ: number): number`, which is 0 for normals facing away (normalZ < 0.1). It is exported from `skinMaterial.ts`.
  - **Review URL:** `review.html?component=back`.

- [ ] **Step 1: Write the failing tests.**
  - `back silhouette is as full as the front`: head geometry half-width per row, at z behind versus in front, within 3%.
  - `face features never show on the back`: `faceWeight(-0.5) === 0`, `faceWeight(0.9) === 1`.
  - `parses yaw`
- [ ] **Step 2: Run, see FAIL.**
- [ ] **Step 3: Inspect** `review.html?component=back` in the browser pane. List what reads squashed or blank: crown sheen, speckles, arm roots, webs, halo, aura.
- [ ] **Step 4: Fix each item.** Run the tests, see PASS.
- [ ] **Step 5: No regression from the front:** `check_stage --world` and `--panel 2`, exit 0.
- [ ] **Step 6: Owner review** of `review.html?component=back`, plus the four stills: `node scripts/world-capture.mjs intro spike-out/yaw-<deg>.png "yaw=<deg>"`.
  - **Look for:** round and cute from behind, the speckles and sheen continuing, and the glow framing him.
- [ ] **Step 7: Record and commit** as `feat(nox3d): Nox reads round and cute from behind`.

---

## Milestone 5: Swimming and the entrance

### Task 16: The stroke cycle and swim drives

**Files:**
- Create: `src/nox3d/motion/stroke.ts`, `src/nox3d/poses/nox.swim.ts`
- Modify: `character/armChain.ts` (`ArmDrive.pitch`, `ArmDrive.straighten`), `config/types.ts` (`Personality.swim`), `config/nox.character.ts`
- Test: `src/nox3d/motion/stroke.test.ts`, `src/nox3d/character/armChain.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export interface StrokeTiming { recovery: number; power: number; glide: number; fill: number; squeeze: number }  // Personality.swim; Nox { 0.52, 0.21, 0.6, 0.04, 0.06 }
  export type StrokePhase = 'recovery' | 'power' | 'glide';
  export interface StrokeFrame { phase: StrokePhase; u: number; spread: number; sweep: number; straighten: number; mantle: number; thrust: number }
  /** `clock`: integer part = stroke index, fraction = progress through one cycle, split by the timing's durations. */
  export function strokeAt(clock: number, timing: StrokeTiming): StrokeFrame
  export const SWIM_POSES: { open: StagePose; trail: StagePose };   // arms spread like an opening umbrella; arms gathered in a loose trailing bundle
  ```
- **What a stroke frame means:**
  - `spread` 0 to 1 opens the arms toward `SWIM_POSES.open` in recovery.
  - `sweep` 0 to 1 closes them back toward `trail` in power.
  - `straighten` peaks at the end of power (the tips whip straight).
  - `mantle` runs from +`fill` in recovery to −`squeeze` in power.
  - `thrust` is high in power, low in recovery, and decays in glide.
- **`ArmDrive.pitch`** (radians): swings the arm out of its plane about its root, positive toward −z (behind Nox), preserving length.
- **`ArmDrive.straighten`** (0 to 1): blends the outer 40% of the arm's turn toward zero.

- [ ] **Step 1: Write the failing tests.**
  - `phase durations sit in the spec's ranges`
  - `power is the fastest phase and carries the most thrust`
  - `mantle fills 4% in recovery and squeezes 6% in power`
  - `tips straighten late in the power stroke`: `straighten` peaks in the last 30% of power.
  - `pitch preserves arm length`: within 0.1%.
  - `straighten removes tip curl`: tip curvature at 1 is under 10% of its value at 0.
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS:** `npx vitest run src/nox3d/motion src/nox3d/character/armChain.test.ts`
- [ ] **Step 3: Check stills** of `SWIM_POSES` at yaw 0 and 35°, in the browser pane through `review.html?component=full&pose=swim-open` and `swim-trail`. Add the `pose` switch to the review page for this.
- [ ] **Step 4: Commit** as `feat(nox3d): octopus stroke cycle and swim poses`.

### Task 17: Theatre.js plumbing

**Files:**
- Create:
  - `src/nox3d/sequences/theatre.ts`, `sequences/keys.ts`
  - `sequences/state/octoverse.theatre.json`
  - `scripts/theatre-seed.mjs`: writes the state JSON from `keys.ts` defaults the first time; studio exports replace it afterwards
- Modify: `behavior/urlState.ts` (`studio: boolean`, honoured only in development), `main.tsx` (dynamic `import('@theatre/studio')` under `import.meta.env.DEV && url.studio`)
- Test: `src/nox3d/sequences/theatre.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export const PROJECT_ID = 'OctoVerse';
  /** Loads the project from the repo state; resolves when ready. One sheet per sequence (section 9.11's big sequences). */
  export function loadSequences(): Promise<Sequences>
  export interface Sequences { sheet(id: SequenceId): ISheet; sample<T>(id: SequenceId, objectKey: string, seconds: number): T }
  export type SequenceId = 'entrance' | 'bubbleBlow' | 'headSwell' | 'arrival';
  /** Code defaults for each sheet's props and keyframes; theatre-seed.mjs writes them into the state JSON. */
  export const SEQUENCE_DEFAULTS: Record<SequenceId, { length: number; objects: Record<string, { props: Record<string, number>; keys: Record<string, [number, number][]> }> }>;
  ```
- **Playback:** the app drives each sequence by setting `sheet.sequence.position` from its own clock. It never uses Theatre's playback, so freeze and `?t=` work the same way.

- [ ] **Step 1: Write the failing tests.**
  - `the repo state loads in Node and samples the defaults`
  - `sampling past the end holds the last value`
  - `studio is dev only`: `parseUrlState('?studio')` gives `studio: true`, and `main.tsx` guards the import with `import.meta.env.DEV`, as a string check.
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 3: Production bundle check.** Run `npm run build`, then `grep -rl "theatre/studio\|@theatre/studio" dist/assets`. **Expected:** no match.
- [ ] **Step 4: Commit** as `feat(nox3d): Theatre.js sequences from repo state, studio in dev`.

### Task 18: The entrance path and sequence

**Files:**
- Create: `src/nox3d/sequences/entrance.ts`
- Modify: `sequences/keys.ts` (the `entrance` defaults), `sequences/state/octoverse.theatre.json` (re-seeded)
- Delete: the Entrance v1 path functions in `behavior/entrance.ts` (`entrancePath`, `entranceStartX`, `armFlare`, `ENTRANCE_PANEL_MS`), with their tests. Keep `mantleSqueeze` and `coreGlowFacing` if still used.
- Test: `src/nox3d/sequences/entrance.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export const ENTRANCE_SECONDS = 6.5;
  export interface EntranceFrame { position: Vec3; yaw: number; pitch: number; stroke: number; spin: number; settle: number; reveal: number; expression: ExpressionId }
  export function entranceFrame(seq: Sequences, seconds: number): EntranceFrame
  /** Offset of the final arc: a golden spiral in the x-z plane round the stage spot, r = r0 (phi^(-2θ/π) - phi^-4) / (1 - phi^-4), θ = 2π spin, so it reaches the spot exactly as the turn completes. */
  export function spiralOffset(spin: number, r0: number): Vec3
  /** Smallest gap between Nox's arm span (open 2.15, closed 1.2 half-span) and any pillar along the path. */
  export function pathClearance(frame: (s: number) => EntranceFrame, layout: WorldLayout, samples?: number): number
  ```
- **Default keys:**
  - **Position:** starts at (−1.0, 1.3, −34), left and deep. It passes (−0.7, 0.9, −18) and (−0.3, 0.45, −6) and reaches (0, 0, 0) plus the spiral.
  - **Easing:** fast far away, slowing on arrival, as in the spike's `1 - (1 - u)^2.2`.
  - **Strokes:** `stroke` runs 0 to 4.6 over 1 to 4.5 s, so four or five strokes.
  - **Spin:** 0 to 1 over 4.5 to 5.5 s, with `yaw` += 2π·spin; spiral r0 = 0.9.
  - **Settle:** 0 to 1 over 5.5 to 6.5 s.
  - **Reveal:** 0 to 1 over 0 to 1 s: the glow and aura first, then the shape.
  - **Pitch:** about 0.45 rad (head first) while swimming, easing to 0 by 5.5 s.
  - **Face:** the determined, happy expression from the approved set (`happy`) while swimming, landing on `gentle` at settle.

- [ ] **Step 1: Write the failing tests.**
  - `lasts 6.5 s and ends exactly at the intro spot facing the visitor`
  - `starts left of centre, deep in the corridor`: x < −0.5, z < −30.
  - `four or five strokes between 1 and 4.5 s`
  - `one full turn between 4.5 and 5.5 s along the spiral`: spiralOffset(0) has radius r0, spiralOffset(1) is (0, 0, 0), and the radius is monotonic.
  - `the path clears every pillar`: `pathClearance > 0.1` against `SECURITY_WORLD.layout`.
  - `murk first: reveal is 0 at the start`
- [ ] **Step 2: Run, see FAIL, implement, re-seed with `node scripts/theatre-seed.mjs entrance`, run, see PASS.**
- [ ] **Step 3: Commit** as `feat(nox3d): entrance sequence with strokes and spiral spin`.

### Task 19: The entrance in the stage (milestone 5 review)

**Files:**
- Modify:
  - `character/Octopus.tsx`: in `entering`, the body transform, pitch and stroke drives come from `entranceFrame`; the physics adds the trailing
  - `App.tsx`: entrance clock, `ENTRANCE_DONE` at 6.5 s, title and nameplate at settle
  - `world/Water.tsx` or the skin: haze for Nox beyond 18 units, from his own atmospheric term
  - `behavior/expressions.ts`: the slower blink while swimming, as a personality multiplier
  - `tests/e2e/entrance.spec.ts`
- Test: `tests/e2e/entrance.spec.ts`

**Interfaces:**
- **Consumes:** `entranceFrame` (Task 18), `strokeAt` and `SWIM_POSES` (Task 16), `ArmPhysicsRig.snap` (Task 14).
- **Arms:** each frame, the arm rests blend `trail` to `open` by `spread`, back by `sweep`, and to the intro pose by `settle`. The drive gets `pitch` = 0.9 × (1 − settle) + 0.4 × sweep, and `straighten` from the stroke.
- **Stills:** `?stage=entering&freeze&t=<s>` shows the entrance at `t`, with the arms in pose mode.
- **Rules:**
  - A skip at any moment lands in the intro and calls `snap()`.
  - It plays once per session (`useStage`).
  - With reduced motion, Nox is simply present in the intro pose.

- [ ] **Step 1: Update the e2e tests** to the 6.5 s entrance:
  - `first visit shows the entrance, a reload in the same session goes straight to intro`
  - `reduced motion skips the entrance`
  - `skip mid-spin lands in the intro`: at 5.0 s on the paused clock, press Escape; the intro heading shows.
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS:** `npx playwright test -c playwright.nox3d.config.ts tests/e2e/entrance.spec.ts`
- [ ] **Step 3: Stills** at t = 0.5, 2.0, 3.3, 4.9, 5.2 and 6.5: `node scripts/world-capture.mjs entering spike-out/ent-<t>.png "t=<t>"`.
  - **Check:** the path stays in the corridor; the arms trail behind and below the head and bloom open on recovery; the back shows mid-spin.
- [ ] **Step 4: Owner live check.**
  - **URL:** `http://localhost:5191/` in a fresh tab (or `?stage=entering`); add `?studio` to scrub the timings live.
  - **Look for:**
    - Nox comes out of the murk on the left and grows by perspective;
    - the strokes visibly surge, with the arms sweeping back;
    - a quick cute spin into place;
    - the settle overshoot;
    - the face looks where he is going.
- [ ] **Step 5: Record and commit** as `feat(nox3d): swimming entrance with spin` (this replaces Entrance v1).

---

## Milestone 6: Technology bubbles

### Task 20: Focus from the intro

**Files:**
- Modify: `behavior/stageMachine.ts`, `App.tsx` (bubbles and buttons open in intro and overview), `behavior/reach.ts` (pointer reach pauses while a bubble is hovered or held)
- Test: `src/nox3d/behavior/stageMachine.test.ts`, `reach.test.ts`

**Interfaces:**
- **Produces:**
  - **State:** `StageState` gains `returnTo: 'intro' | 'overview'`.
  - **Focus:** `FOCUS_TECH` works from `intro` and `overview`.
  - **Blur:** `BLUR_TECH` and `CLOSE` from `techFocus` return to `returnTo`.
  - **Reach:** `reachesForPointer(stage, orbsOut, tracking, bubbleHot: boolean)` is false while `bubbleHot`.

- [ ] **Step 1: Write the failing tests.**
  - `focus from the intro returns to the intro`
  - `focus from the overview returns to the overview`
  - `the entrance cannot focus`
  - `pointer reach pauses while a bubble is hot`
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 3: Commit** as `feat(nox3d): technology focus from the intro`.

### Task 21: Orbiting bubbles with live buttons

**Files:**
- Create: `src/nox3d/artifacts/bubbleOrbits.ts`, `artifacts/TechBubbles.tsx` (the approved glass from `orbMaterial.ts` and the logos from `logoTexture.ts`)
- Modify: `ui/OrbButtons.tsx` (buttons follow the bubbles each frame through `LiveAnchors`), `ui/hoverIntent.ts`, `App.tsx`
- Delete: `artifacts/TechOrbs.tsx`, `orbSlots.ts` and their tests, once nothing uses them (the slots and reach-to-orb are replaced)
- Test: `src/nox3d/artifacts/bubbleOrbits.test.ts`, `src/nox3d/ui/hoverIntent.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export interface Orbit { shell: number; radius: number; tilt: number; phase: number; speed: number; size: number }
  export interface Shell { radius: number; tilt: number; speed: number }   // Nox: three shells
  /** 15 bubbles over the shells, sized smaller in the intro framing. */
  export function layoutOrbits(count: number, shells: readonly Shell[], stage: 'intro' | 'overview'): Orbit[]
  /** Body-space position at time t; `swell` (0..1) pushes the radius out to clear the swollen head. */
  export function orbitPoint(o: Orbit, t: number, swell: number, out: THREE.Vector3): THREE.Vector3
  /** Orbit clock speed factor: eases to 0 within 0.4 s while any bubble is hovered or held. */
  export function orbitSpeed(hot: boolean, dt: number, state: { x: number; v: number }): number
  ```
- **Clear boxes:** the face, title and nameplate HTML boxes stay clear. The test checks them through `stageBoxFor`.
- **By stage:** none in the entrance; orbiting in the intro and the overview; hidden in detail, where the panel keeps its approved technology chips.
- **Phone:** the portrait tray is unchanged.

- [ ] **Step 1: Write the failing tests.**
  - `fifteen bubbles on two or three shells`
  - `bubbles never overlap each other`: over 60 s sampled at 10 Hz, centre distance stays at least 1.2 × (sum of radii).
  - `bubbles never cover the face, the title or the nameplate`: projected at 1536 × 1024 and 1280 × 720, intro and overview.
  - `swell pushes the orbits outward`
  - `orbits ease to still while a bubble is hot`
  - `hover intent ignores a bubble moving under a still pointer` (Review Focus 3)
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 3: e2e:** `tests/e2e/keyboard.spec.ts` still passes from the overview. Add `keyboard reaches every bubble from the intro`.
- [ ] **Step 4: Commit** as `feat(nox3d): technology bubbles orbit Nox`.

### Task 22: Blowing the bubbles

**Files:**
- Create: `src/nox3d/sequences/bubbleBlow.ts`
- Modify:
  - `behavior/expressions.ts`: `ExpressionParams.puff` and `mouthRound`, both 0 to 1
  - `character/FaceCanvas.ts`: draws the puffed cheeks and the round mouth
  - `sequences/keys.ts`: the `bubbleBlow` defaults
  - `artifacts/TechBubbles.tsx`
  - `App.tsx`: no bubbles until the entrance has settled
- Test: `src/nox3d/sequences/bubbleBlow.test.ts`, `src/nox3d/behavior/expressions.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export interface BlowFrame { puff: number; mouthRound: number; emerged: number; scale: number; wobble: number }
  /** Bubble i of n, `seconds` after the blow began: puff 0-0.25 s, pop 0.25-0.33 s, wobble-grow 0.33-0.9 s, bubbles 0.18 s apart. */
  export function blowFrame(seq: Sequences, i: number, seconds: number): BlowFrame
  ```
- **Approval gate:** the puffed cheeks and round mouth change approved face artwork. Show the owner a component review (`review.html?component=mouth&expression=blow`) before Task 22 lands.

- [ ] **Step 1: Write the failing tests.**
  - `no bubble exists before the entrance settles`
  - `each bubble emerges from the mouth and grows with a wobble to full size`
  - `bubbles are blown in order, 0.18 s apart`
  - `expressions without puff are unchanged`
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 3: Owner component review** of the puff and round mouth. Apply it after approval.
- [ ] **Step 4: Commit** as `feat(nox3d): Nox blows the technology bubbles`.

### Task 23: Suction hold (milestone 6 review)

**Files:**
- Create: `src/nox3d/artifacts/suctionHold.ts`
- Modify: `character/Octopus.tsx` (arm turn, pull and lift through `ArmDrive.reach`, with physics follow-through), `character/suckerMaterial.ts` (per-arm `uFlare`), `artifacts/TechBubbles.tsx`, `ui/TechTooltip.tsx` (placement from the held bubble's live anchor)
- Test: `src/nox3d/artifacts/suctionHold.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export const HOLD_BEATS = { turnMs: [0, 260], flareMs: [150, 420], pullMs: [260, 720], liftMs: [620, 1000], releaseMs: 600 };
  export interface Box { x0: number; y0: number; x1: number; y1: number }   // body space, z ignored
  /** The arm whose tip is nearest the bubble without its path crossing the face box. */
  export function nearestArm(tips: readonly Vec3[], bubble: Vec3, face: Box): number
  export interface HoldFrame { arm: number; turn: number; flare: number; pull: number; lift: number; release: number }
  export class HoldChoreography { choose(bubble: number | null, nowMs: number): void; sample(nowMs: number): HoldFrame[] }  // one entry per bubble in motion; at most one held
  ```
- **Kept from Tasks 20 and 21 of the old plan:** the glass look, logos, buttons, hover intent, tooltip content and placement, and the focused expression.
- **Phone:** choosing from the tray plays the same pull and hold.

- [ ] **Step 1: Write the failing tests.**
  - `chooses the nearest arm that does not cross the face`
  - `cups flare as the arm turns, then the bubble is pulled to the tip and lifted`
  - `retargets mid-pull and never holds two` (Review Focus 4)
  - `release returns the bubble to its orbit`
  - `reduced motion: the bubble moves to the tip without the pull animation`
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 3: e2e:** `tests/e2e/keyboard.spec.ts`. Focusing a bubble shows the tooltip with "Used for penetration testing" for Kali; Escape releases it.
- [ ] **Step 4: Owner live check.**
  - **URLs:** `/?stage=intro` and `/?stage=overview`.
  - **Look for:**
    - the bubbles drift and never cover the face;
    - on hover, the nearest arm turns, its cups flare, and the bubble slides to the tip;
    - the lift has follow-through;
    - the face reacts;
    - choosing another releases the first.
- [ ] **Step 5: Record and commit** as `feat(nox3d): suction hold for technology bubbles`.

---

## Milestone 7: The head swell

### Task 24: Head swell with its special-effect hook (milestone 7 review)

**Files:**
- Create: `src/nox3d/sequences/headSwell.ts`
- Modify:
  - `config/types.ts`: `CharacterConfig.headEffect: HeadEffectId | null`, with `HeadEffectId = 'none' | <Nox's>`
  - `config/nox.character.ts`
  - `character/Octopus.tsx`: `headMorph` and squeeze come from the sequence; the effect renders inside or around the dome
  - `App.tsx`
  - `sequences/keys.ts`
- Test: `src/nox3d/sequences/headSwell.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export interface SwellFrame { morph: number; squeeze: number; push: number }   // push feeds orbitPoint's swell
  /** Opening: a small squeeze (anticipation), a swell with overshoot past 1, then a settle at 1. Closing plays it in reverse. */
  export function swellFrame(seq: Sequences, seconds: number, opening: boolean): SwellFrame
  ```
- **First step:** ask the owner which special effect Nox's head swell carries. Name it in `headEffect` and implement it behind that id. `'none'` must render the dome as approved in Task 19 of the old plan.

- [ ] **Step 1: Ask the owner** for Nox's head effect. Record the answer in the review log.
- [ ] **Step 2: Write the failing tests.**
  - `the swell squeezes first, overshoots, then settles at 1`
  - `closing reverses the opening`
  - `bubbles are pushed out while swollen`
  - `headEffect none renders the approved dome`
- [ ] **Step 3: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 4: Panel 3 composition:** `stage-capture overview`, then `check_stage --panel 3`. **Expected:** exit 0.
- [ ] **Step 5: Owner live check.**
  - **URL:** `/?stage=intro`, then click the head.
  - **Look for:** anticipation, overshoot and settle; the effect; the bubbles clearing the dome; Escape reversing it.
- [ ] **Step 6: Record and commit** as `feat(nox3d): head swell with Nox's effect`.

---

## Milestone 8: Shared micro-animations and variant hooks

### Task 25: The micro-animation library

**Files:**
- Create: `src/nox3d/motion/micro.ts`
- Modify:
  - `sequences/keys.ts`: the `arrival` defaults, then re-seed with `node scripts/theatre-seed.mjs arrival`
  - `config/types.ts`: `Personality.micro`, the timings and strengths for each motion
  - `config/nox.character.ts`
  - `character/Octopus.tsx`: each motion feeds pose targets, so the physics adds follow-through
  - `behavior/ambient.ts` and `behavior/attention.ts`: read their timings from `Personality`, unchanged in value
- Test: `src/nox3d/motion/micro.test.ts`

**Interfaces:**
- **Produces**, all pure, returning offsets 0 outside their window:
  ```ts
  export function startle(t: number, p: Personality['micro']): { lift: number; armsIn: number; eyes: number }
  /** A big sequence (section 9.11): sampled from the 'arrival' sheet (Task 17), scaled by the personality. */
  export function arrivalWiggle(seq: Sequences, t: number, p: Personality['micro']): { roll: number; armWave: number }
  export function settleOvershoot(t: number, p: Personality['micro']): number
  export function idleGlance(t: number, rng: () => number, p: Personality['micro']): { x: number; y: number } | null
  ```
- **Already built and kept** (moved under `Personality` only where a value is hard-coded today): breathing, buoyant float, arm drift and curl, blinking with the double blink, the stroke cycle (Task 16), bubble blow (Task 22), suction hold (Task 23) and head swell (Task 24).
- **Triggers:** the startle plays on a sudden pointer arrival near the face. The arrival wiggle plays once after the entrance settles.

- [ ] **Step 1: Write the failing tests.**
  - `each micro-animation is zero outside its window and peaks inside it`
  - `timings come from the personality`: a doubled duration doubles the window.
  - `idle glances never repeat at a fixed interval`: over 120 s, the intervals' standard deviation is over 20% of their mean.
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 3: Commit** as `feat(nox3d): shared micro-animations from personality`.

### Task 26: Variant path proven (milestone 8 review)

**Files:**
- Create: `src/nox3d/config/fixtures/dummy.character.ts`, `src/nox3d/world/fixtures/dummy.world.ts` (test and dev only, never shipped)
- Modify: `behavior/urlState.ts` (`variant?: 'dummy'`, honoured in development only), `App.tsx` (loads the fixtures under `import.meta.env.DEV`)
- Test: `src/nox3d/config/variant.test.ts`

**Interfaces:**
- **Dummy character:** other shades, glow and aura colours, a heavier water feel, a slower stroke, and `headEffect: 'none'`.
- **Dummy world:** reuses the kit with another palette and layout.

- [ ] **Step 1: Write the failing tests.**
  - `a variant is configuration only`: the dummy passes `clampCharacterConfig` and `validateWorld`, and its config differs from Nox's in every variant field.
  - `the production build has no fixtures`: grep `dist/assets` for `dummy`.
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS.**
- [ ] **Step 3: Still:** `node scripts/world-capture.mjs intro spike-out/variant.png "variant=dummy"`. It must render with no code change outside config.
- [ ] **Step 4: Owner live check:** `/?variant=dummy` in development, plus Nox's micro-animations at `/?stage=intro`.
  - **Look for:** the startle when the pointer darts to the face, the arrival wiggle, and idle glances.
- [ ] **Step 5: Record and commit** as `feat(nox3d): personality and variant hooks`.

---

## Milestone 9: Pass across every stage

### Task 27: Phone, accessibility and fallback in the world

These are the 2026-10-23 plan's Task 25 items, rebuilt on the world.

**Files:**
- Create: `src/nox3d/ui/Poster.tsx`, `public/nox/poster-intro.webp` (captured from the approved intro in the world), `tests/e2e/responsive.spec.ts`, `tests/e2e/fallback.spec.ts`
- Modify: `App.tsx`, `ui/OrbTray.tsx`, `ui/OverviewPanel.tsx`, `ui/ProjectDetail.tsx` (bottom sheets on `phone`), `world/worldTiers.ts` (phone tier)

**Interfaces:**
- **Phone:** the tray holds all 15 buttons at 48 px; panels are bottom sheets with a close button; the world runs at tier low with no fish and no motes.
- **Skip link:** "Skip to project details" is the first focusable element.
- **No WebGL** (no `webgl2` context, or `?nowebgl`): `Poster` plus the HTML overlays; the overview and detail content are reachable.

- [ ] **Step 1: Write the failing Playwright tests.**
  - `phone overview shows a tray of 15 orb buttons at least 44 px` (390 × 844)
  - `touch tap opens a tooltip and a second tap closes it`
  - `nowebgl shows the poster and working links`
  - `resize from desktop to phone keeps the focused technology`
  - `wide and tall windows show no void at full hover` (Review Focus 2): stills at 2560 × 1080 and 390 × 844 with `hover=0.9,0.3,1.2`; edge pixels are not the clear colour.
- [ ] **Step 2: Run, see FAIL, implement, run, see PASS:** `npx playwright test -c playwright.nox3d.config.ts tests/e2e/responsive.spec.ts tests/e2e/fallback.spec.ts`
- [ ] **Step 3: Owner check** on their real phone. Report the phone's fps honestly.
- [ ] **Step 4: Commit** as `feat(nox3d): phone, accessibility and WebGL fallback in the world`.

### Task 28: Final verification (milestone 9 review)

These are the 2026-10-23 plan's Task 26 items.

**Files:**
- Delete: `src/spike/`, `spike.html`, `frames.html`, `refzoom.html`, `calib.html`, and any spike-only scripts left (`scripts/spike-capture.mjs`, `spike-frames.mjs`, `screencast.mjs`, `stepped-capture.mjs`, `motion-capture.mjs`, `transition-capture.mjs`). The video tools go with the no-video rule.
- Keep: `public/spike/Nox.jpeg` and `nox-panel2-hq.jpg` for the checks.
- Modify: `docs/superpowers/HANDOFF.md`

- [ ] **Step 1: Run everything.** Run `npm test && npm run typecheck && npx playwright test -c playwright.nox3d.config.ts`. **Expected:** all pass.
- [ ] **Step 2: Look checks.**
  - `check_stage --world` on intro, overview, techFocus and detail (Task 5's flags).
  - Composition checks for panels 3 to 5.
  - **Expected:** exit 0.
- [ ] **Step 3: Performance.** Run `node scripts/perf.mjs` on intro, overview and techFocus at tiers high and low, plus `__physicsMs`. Report the numbers against section 9.13, misses included.
- [ ] **Step 4: Owner walk-through,** live, of the whole experience:
  - the entrance;
  - the intro with its hover;
  - choosing a bubble from the intro;
  - the head swell;
  - choosing from the overview;
  - the detail view;
  - Escape back out;
  - reduced motion;
  - a phone.
- [ ] **Step 5: Update `HANDOFF.md`** to the finished state, then commit as `chore(nox3d): world and motion phase complete`.
